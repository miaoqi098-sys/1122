(() => {
  const ACCESS_ENDPOINT = 'https://sif-api.sorilo-uk.com/access/session';
  const STORAGE_KEY = '1122.web-console.access-session.v1';
  const EVENT_NAME = '1122:auth-state';
  const REQUEST_TIMEOUT_MS = 7000;
  const MAX_TIMER_DELAY_MS = 2_147_483_647;
  let state = { status: 'checking', token: '', expiresAt: '', scope: [] };
  let authenticationGate = null;
  let mutationVersion = 0;
  let expiryTimer = null;

  function deferred() {
    let resolve;
    const promise = new Promise((next) => { resolve = next; });
    return { promise, resolve };
  }

  function resetAuthenticationGate() {
    authenticationGate = deferred();
  }

  resetAuthenticationGate();

  function publicState() {
    return {
      status: state.status,
      authenticated: state.status === 'authenticated',
      expiresAt: state.expiresAt || null,
      scope: [...state.scope],
    };
  }

  function clearExpiryTimer() {
    if (expiryTimer !== null) clearTimeout(expiryTimer);
    expiryTimer = null;
  }

  function expiresAtMs(value = state.expiresAt) {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function sessionExpired() {
    return state.status === 'authenticated' && (!expiresAtMs() || expiresAtMs() <= Date.now());
  }

  function scheduleSessionExpiry() {
    clearExpiryTimer();
    const schedule = () => {
      const remaining = expiresAtMs() - Date.now();
      if (remaining <= 0) {
        logout();
        return;
      }
      expiryTimer = setTimeout(schedule, Math.min(remaining, MAX_TIMER_DELAY_MS));
      // Keeps browser behavior unchanged while allowing the Node contract test
      // to complete without retaining a multi-hour event-loop handle.
      expiryTimer?.unref?.();
    };
    schedule();
  }

  function publish() {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: publicState() }));
  }

  function clearStoredSession() {
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch {}
  }

  function writeStoredSession(session) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        token: session.token,
        expires_at: session.expires_at,
        scope: session.scope,
      }));
    } catch {
      // A private browsing policy can deny sessionStorage. The in-memory
      // session remains usable for this tab, but is deliberately not retried.
    }
  }

  function readStoredSession() {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed.token === 'string' ? parsed : null;
    } catch {
      clearStoredSession();
      return null;
    }
  }

  function setAuthenticated(session) {
    const expiresAt = session.expires_at || '';
    if (!expiresAtMs(expiresAt) || expiresAtMs(expiresAt) <= Date.now()) {
      const error = new Error('SESSION_EXPIRED');
      error.code = 'SESSION_EXPIRED';
      throw error;
    }
    clearExpiryTimer();
    state = {
      status: 'authenticated',
      token: session.token,
      expiresAt,
      scope: Array.isArray(session.scope) ? session.scope.filter(value => typeof value === 'string') : [],
    };
    writeStoredSession(session);
    authenticationGate.resolve(publicState());
    scheduleSessionExpiry();
    publish();
    return publicState();
  }

  function requestError(payload, response) {
    const error = new Error(payload?.error?.message || payload?.message || `HTTP_${response.status}`);
    error.httpStatus = response.status;
    error.code = payload?.error?.code || `HTTP_${response.status}`;
    return error;
  }

  async function request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        ...options,
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
        headers: { Accept: 'application/json', ...(options.headers || {}) },
      });
      let payload;
      try {
        payload = await response.json();
      } catch {
        const error = new Error('INVALID_AUTH_RESPONSE');
        error.httpStatus = response.status;
        throw error;
      }
      if (!response.ok || payload?.success !== true) throw requestError(payload, response);
      return payload;
    } catch (cause) {
      if (cause?.name === 'AbortError') {
        const error = new Error('AUTH_REQUEST_TIMEOUT');
        error.code = 'AUTH_REQUEST_TIMEOUT';
        throw error;
      }
      throw cause;
    } finally {
      clearTimeout(timer);
    }
  }

  async function validate(token) {
    const payload = await request(ACCESS_ENDPOINT, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!payload?.session || !Array.isArray(payload.session.scope) || typeof payload.session.expires_at !== 'string') {
      throw new Error('INVALID_AUTH_RESPONSE');
    }
    return { token, ...payload.session };
  }

  async function restore() {
    const version = mutationVersion;
    const stored = readStoredSession();
    if (!stored?.token) {
      if (version === mutationVersion) {
        state = { status: 'anonymous', token: '', expiresAt: '', scope: [] };
        publish();
      }
      return publicState();
    }
    try {
      const session = await validate(stored.token);
      return version === mutationVersion ? setAuthenticated(session) : publicState();
    } catch {
      if (version === mutationVersion) {
        clearStoredSession();
        state = { status: 'anonymous', token: '', expiresAt: '', scope: [] };
        publish();
      }
      return publicState();
    }
  }

  async function login(password) {
    if (typeof password !== 'string' || !password) {
      const error = new Error('请输入访问密码。');
      error.code = 'PASSWORD_REQUIRED';
      throw error;
    }
    const version = mutationVersion;
    const payload = await request(ACCESS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!payload?.session || typeof payload.session.token !== 'string' || !Array.isArray(payload.session.scope)) {
      throw new Error('INVALID_AUTH_RESPONSE');
    }
    if (version !== mutationVersion) {
      const error = new Error('SESSION_SUPERSEDED');
      error.code = 'SESSION_SUPERSEDED';
      throw error;
    }
    mutationVersion += 1;
    return setAuthenticated(payload.session);
  }

  function logout() {
    mutationVersion += 1;
    clearExpiryTimer();
    clearStoredSession();
    state = { status: 'anonymous', token: '', expiresAt: '', scope: [] };
    resetAuthenticationGate();
    publish();
  }

  function authorizationHeaders() {
    return isAuthenticated() ? { Authorization: `Bearer ${state.token}` } : {};
  }

  function isAuthenticated() {
    if (sessionExpired()) {
      logout();
      return false;
    }
    return state.status === 'authenticated' && Boolean(state.token);
  }

  function getState() {
    isAuthenticated();
    return publicState();
  }

  window.__1122_AUTH__ = Object.freeze({
    ready: restore(),
    login,
    logout,
    validate: () => state.token ? validate(state.token) : Promise.reject(new Error('SESSION_REQUIRED')),
    whenAuthenticated: () => isAuthenticated() ? Promise.resolve(publicState()) : authenticationGate.promise,
    authorizationHeaders,
    isAuthenticated,
    getState,
  });
})();
