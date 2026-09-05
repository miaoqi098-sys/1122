(() => {
  const fallback = window.__1122_DATA__ || {navigation:[],apr:[],aom:[],apb:[],domains:[]};
  const endpoint = '/api/v1/ui/bootstrap';

  function isValidShape(x){
    return x && typeof x === 'object' && Array.isArray(x.apr) && Array.isArray(x.aom) && Array.isArray(x.apb) && Array.isArray(x.domains);
  }

  async function load(){
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const res = await fetch(endpoint, {
        method:'GET',
        credentials:'same-origin',
        headers:{'Accept':'application/json'},
        cache:'no-store',
        signal:controller.signal
      });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const remote = await res.json();
      if(!isValidShape(remote)) throw new Error('invalid bootstrap shape');
      return {
        ...fallback,
        ...remote,
        navigation:Array.isArray(remote.navigation) && remote.navigation.length ? remote.navigation : fallback.navigation,
        __source:{mode:'API',endpoint,live_data_verified:remote.live_data_verified === true,loaded_at:new Date().toISOString()}
      };
    } catch (error) {
      return {
        ...fallback,
        __source:{mode:'SNAPSHOT_FALLBACK',endpoint,live_data_verified:false,loaded_at:new Date().toISOString(),reason:String(error && error.message || error)}
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  window.__1122_DATA_READY__ = load();
})();
