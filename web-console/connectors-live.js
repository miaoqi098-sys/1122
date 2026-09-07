(() => {
  const registry = Object.freeze(Object.fromEntries((window.__1122_REGISTRY__?.connectors || []).map(x => [x.connector_id, x])));

  const states = new Set(['LIVE','CONNECTED','AUTH_REQUIRED','DEGRADED','FALLBACK','ERROR']);
  function validHealth(x){
    return x && typeof x === 'object' && typeof x.connector_id === 'string' &&
      states.has(x.status) && typeof x.checked_at === 'string' &&
      typeof x.source === 'string' && x.details && typeof x.details === 'object';
  }
  function normalize(config, payload){
    if (validHealth(payload)) return payload;
    if (payload?.success === true || payload?.service) return {
      connector_id: config.connector_id, status:'LIVE', checked_at:new Date().toISOString(),
      source:'bridge-readonly', capabilities:[], details:{service:payload.service || config.label}, error:null
    };
    return null;
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
    if (!config.endpoint) return {connector_id:config.connector_id,status:'DEGRADED',checked_at:new Date().toISOString(),source:'registry',capabilities:[],details:{mode:config.healthPath},error:{code:'HEALTH_ENDPOINT_NOT_CONFIGURED',message:'连接器已登记，但尚未配置可公开读取的健康端点。'}};
    try {
      const payload = await window.__1122_FETCH_JSON__(config.endpoint, {timeoutMs:config.timeoutMs,retries:config.retries,validate:x=>Boolean(normalize(config,x))});
      return normalize(config,payload);
    } catch(error) {
      return {connector_id:config.connector_id,status:'ERROR',checked_at:new Date().toISOString(),latency_ms:null,source:'browser-readonly',capabilities:[],details:{bridge:'offline'},error:classify(error)};
    }
  }
  window.__1122_CONNECTORS__ = { registry, read, validHealth };
})();
