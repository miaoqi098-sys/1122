(() => {
  const fallback = window.__1122_DATA__ || {navigation:[],apr:[],aom:[],apb:[],domains:[]};
  const endpoint = 'https://1122-data-layer.zhangshuaibing01.workers.dev/api/v1/ui/bootstrap';
  // Only these bridges currently understand the signed console session and
  // explicitly allow Authorization in their CORS policy. Keeping this list
  // narrow prevents the public read-only bridges from receiving a header that
  // would turn ordinary GETs into failing preflight requests.
  const sessionAwareOrigins = new Set([
    'https://sif-api.sorilo-uk.com',
    'https://1122-amazon-ads-bridge.zhangshuaibing01.workers.dev'
  ]);

  function accessHeadersFor(url){
    try {
      const origin = new URL(url, window.location.href).origin;
      return sessionAwareOrigins.has(origin)
        ? (window.__1122_AUTH__?.authorizationHeaders?.() || {})
        : {};
    } catch {
      return {};
    }
  }

  // Shared, read-only transport for every external connector. It intentionally
  // has a bounded retry budget and never converts an unknown response to success.
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function fetchJson(url, {timeoutMs=4500, retries=1, validate=() => true, method='GET', body=null, headers={}}={}){
    let lastError;
    for(let attempt=0; attempt<=retries; attempt++){
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const accessHeaders = accessHeadersFor(url);
        const res = await fetch(url, {method,body,mode:'cors',credentials:'omit',headers:{Accept:'application/json',...headers,...accessHeaders},cache:'no-store',signal:controller.signal});
        let payload;
        try { payload = await res.json(); } catch { throw new Error('INVALID_JSON'); }
        if(!res.ok){
          const requestError = new Error(typeof payload?.error?.message === 'string' ? payload.error.message : `HTTP_${res.status}`);
          requestError.httpStatus = res.status;
          requestError.code = payload?.error?.code || `HTTP_${res.status}`;
          requestError.responsePayload = payload;
          if (res.status === 401 && /^SESSION_/.test(requestError.code)) window.__1122_AUTH__?.logout?.();
          throw requestError;
        }
        if(!validate(payload)) throw new Error('INVALID_SHAPE');
        return payload;
      } catch(error) {
        lastError = error?.name === 'AbortError' ? new Error('TIMEOUT') : error;
        const retryable = /^(TIMEOUT|INVALID_JSON|HTTP_5)/.test(String(lastError?.message || '')) || Number(lastError?.httpStatus) >= 500 || lastError instanceof TypeError;
        if(!retryable || attempt === retries) break;
        await sleep(250 * (attempt + 1));
      } finally { clearTimeout(timeout); }
    }
    throw lastError || new Error('REQUEST_FAILED');
  }
  window.__1122_FETCH_JSON__ = fetchJson;

  function isValidShape(x){
    const arrays = ['apr','aom','apb','domains','products','agents','tasks','sandbox_runs'];
    return x && typeof x === 'object' && arrays.every(key => Array.isArray(x[key])) &&
      x.source_status && typeof x.source_status === 'object' &&
      x.knowledge && typeof x.knowledge === 'object';
  }

  async function load(){
    // The UI data request starts only after a successful 1122 login. This
    // avoids downloading the normal dashboard payload behind the access gate.
    const auth = window.__1122_AUTH__;
    if (!auth?.whenAuthenticated) {
      return {
        ...fallback,
        __source:{mode:'ACCESS_GATE_UNAVAILABLE',endpoint,live_data_verified:false,loaded_at:new Date().toISOString(),reason:'AUTH_CLIENT_NOT_AVAILABLE'}
      };
    }
    await auth.whenAuthenticated();
    try {
      const remote = await fetchJson(endpoint, {timeoutMs:3500,retries:1,validate:isValidShape});
      return {
        ...fallback,
        ...remote,
        navigation:Array.isArray(remote.navigation) && remote.navigation.length ? remote.navigation : fallback.navigation,
        __source:{
          mode:'API',
          endpoint,
          live_data_verified:remote.live_data_verified === true,
          source_status:remote.source_status || {},
          loaded_at:new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        ...fallback,
        __source:{mode:'SNAPSHOT_FALLBACK',endpoint,live_data_verified:false,loaded_at:new Date().toISOString(),reason:String(error && error.message || error)}
      };
    }
  }

  window.__1122_DATA_READY__ = load();
})();
