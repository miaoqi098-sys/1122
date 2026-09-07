(() => {
  const fallback = window.__1122_DATA__ || {navigation:[],apr:[],aom:[],apb:[],domains:[]};
  const endpoint = 'https://1122-data-layer.zhangshuaibing01.workers.dev/api/v1/ui/bootstrap';

  // Shared, read-only transport for every external connector. It intentionally
  // has a bounded retry budget and never converts an unknown response to success.
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function fetchJson(url, {timeoutMs=4500, retries=1, validate=() => true, method='GET', body=null, headers={}}={}){
    let lastError;
    for(let attempt=0; attempt<=retries; attempt++){
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {method,body,mode:'cors',credentials:'omit',headers:{Accept:'application/json',...headers},cache:'no-store',signal:controller.signal});
        let payload;
        try { payload = await res.json(); } catch { throw new Error('INVALID_JSON'); }
        if(!res.ok){
          const requestError = new Error(typeof payload?.error?.message === 'string' ? payload.error.message : `HTTP_${res.status}`);
          requestError.httpStatus = res.status;
          requestError.code = payload?.error?.code || `HTTP_${res.status}`;
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
    return x && typeof x === 'object' && Array.isArray(x.apr) && Array.isArray(x.aom) && Array.isArray(x.apb) && Array.isArray(x.domains);
  }

  async function load(){
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
