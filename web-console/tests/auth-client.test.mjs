import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../auth-client.js', import.meta.url), 'utf8');

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

function loadClient({ storage, fetch, timers = { setTimeout, clearTimeout }, DateImpl = Date }) {
  const events = [];
  class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  }
  const window = {
    sessionStorage: storage,
    dispatchEvent(event) { events.push(event); return true; },
  };
  const context = vm.createContext({
    window,
    fetch,
    CustomEvent,
    AbortController,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    Date: DateImpl,
  });
  vm.runInContext(source, context, { filename: 'auth-client.js' });
  return { auth: window.__1122_AUTH__, events };
}

test('a late restored token cannot overwrite a newly completed login', async () => {
  const storage = createStorage({
    '1122.web-console.access-session.v1': JSON.stringify({ token: 'old-token', expires_at: '2099-09-18T01:00:00.000Z', scope: ['console:read'] }),
  });
  let resolveRestore;
  const restoreRequest = new Promise((resolve) => { resolveRestore = resolve; });
  const fetch = async (_url, options = {}) => {
    if (options.method === 'GET') return restoreRequest;
    if (options.method === 'POST') {
      return response({
        success: true,
        session: {
          token: 'new-token',
          expires_at: '2099-09-18T02:00:00.000Z',
          scope: ['console:read', 'research:execute', 'ads:campaign-state'],
        },
      });
    }
    throw new Error(`unexpected method ${options.method}`);
  };
  const { auth } = loadClient({ storage, fetch });

  const login = auth.login('new-password');
  await login;
  resolveRestore(response({
    success: true,
    session: { expires_at: '2099-09-18T01:00:00.000Z', scope: ['console:read'] },
  }));
  await auth.ready;

  assert.equal(auth.isAuthenticated(), true);
  assert.equal(auth.authorizationHeaders().Authorization, 'Bearer new-token');
  assert.equal(auth.getState().expiresAt, '2099-09-18T02:00:00.000Z');
  assert.match(storage.getItem('1122.web-console.access-session.v1'), /new-token/);
});

test('logout invalidates an in-flight login response', async () => {
  const storage = createStorage();
  let resolveLogin;
  const loginRequest = new Promise((resolve) => { resolveLogin = resolve; });
  const fetch = async (_url, options = {}) => {
    if (options.method === 'POST') return loginRequest;
    return response({ success: false }, 401);
  };
  const { auth } = loadClient({ storage, fetch });
  await auth.ready;

  const login = auth.login('new-password');
  auth.logout();
  resolveLogin(response({
    success: true,
    session: { token: 'should-not-win', expires_at: '2099-09-18T02:00:00.000Z', scope: ['console:read'] },
  }));

  await assert.rejects(login, { message: 'SESSION_SUPERSEDED' });
  assert.equal(auth.isAuthenticated(), false);
  assert.equal(storage.getItem('1122.web-console.access-session.v1'), null);
});

test('the client proactively logs out when a signed session reaches expiry', async () => {
  let now = Date.parse('2099-09-18T00:00:00.000Z');
  class ClockDate extends Date {}
  ClockDate.now = () => now;
  ClockDate.parse = Date.parse;
  let timer = null;
  const timers = {
    setTimeout(callback, delay) {
      timer = { callback, delay, unref() {} };
      return timer;
    },
    clearTimeout(handle) {
      if (timer === handle) timer = null;
    },
  };
  const { auth } = loadClient({
    storage: createStorage(),
    timers,
    DateImpl: ClockDate,
    fetch: async (_url, options = {}) => {
      assert.equal(options.method, 'POST');
      return response({
        success: true,
        session: {
          token: 'short-lived-token',
          expires_at: '2099-09-18T00:00:05.000Z',
          scope: ['console:read'],
        },
      });
    },
  });
  await auth.ready;
  await auth.login('new-password');
  assert.equal(auth.isAuthenticated(), true);
  assert.equal(timer?.delay, 5_000);

  now += 5_001;
  timer.callback();
  assert.equal(auth.isAuthenticated(), false);
  assert.equal(Object.keys(auth.authorizationHeaders()).length, 0);
});
