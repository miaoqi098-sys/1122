(() => {
  // Add connectors here; endpoints and contracts do not belong in view code.
  const registry = Object.freeze({
    cloudflare: {
      connector_id: 'cloudflare',
      label: 'Cloudflare',
      endpoint: 'https://1122-cloudflare-bridge.zhangshuaibing01.workers.dev/cloudflare-status',
      timeoutMs: 5000,
      retries: 1
    }
  });

  const states = new Set(['LIVE','DEGRADED','FALLBACK','ERROR']);
  function validHealth(x){
    return x && typeof x === 'object' && typeof x.connector_id === 'string' &&
      states.has(x.status) && typeof x.checked_at === 'string' &&
      typeof x.source === 'string' && x.details && typeof x.details === 'object';
  }
  function classify(error){
    const message = String(error?.message || error || 'REQUEST_FAILED');
    if(message === 'TIMEOUT') return {code:'TIMEOUT', message:'请求超时；Bridge 未在限定时间内响应。'};
    if(message === 'INVALID_JSON' || message === 'INVALID_SHAPE') return {code:'INVALID_RESPONSE', message:'Bridge 返回的状态格式无效，已按失败处理。'};
    if(/^HTTP_/.test(message)) return {code:message, message:`Bridge 请求失败（${message.replace('_',' ')}）。`};
    return {code:'NETWORK_OR_CORS', message:'网络或跨域访问失败；请检查 Bridge allow-list 与部署状态。'};
  }
  async function read(connectorId){
    const config = registry[connectorId];
    if(!config) return {connector_id:connectorId,status:'ERROR',checked_at:new Date().toISOString(),source:'registry',capabilities:[],details:{},error:{code:'NOT_REGISTERED',message:'Connector 未注册'}};
    try {
      return await window.__1122_FETCH_JSON__(config.endpoint, {timeoutMs:config.timeoutMs,retries:config.retries,validate:validHealth});
    } catch(error) {
      return {connector_id:config.connector_id,status:'ERROR',checked_at:new Date().toISOString(),latency_ms:null,source:'browser-readonly',capabilities:[],details:{bridge:'offline'},error:classify(error)};
    }
  }
  window.__1122_CONNECTORS__ = { registry, read, validHealth };
})();
