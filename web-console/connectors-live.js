(() => {
  const registry = Object.freeze(Object.fromEntries((window.__1122_REGISTRY__?.connectors || []).map(item => [item.connector_id, item])));
  const states = new Set(['LIVE', 'CONNECTED', 'AUTH_REQUIRED', 'DEGRADED', 'FALLBACK', 'ERROR']);

  function validHealth(value) {
    return value && typeof value === 'object' && typeof value.connector_id === 'string' &&
      states.has(value.status) && typeof value.checked_at === 'string' &&
      typeof value.source === 'string' && value.details && typeof value.details === 'object';
  }

  function normalize(config, payload) {
    if (validHealth(payload)) return payload;

    if (config.connector_id === 'amazon-sp-api' && payload?.success === true && payload?.connection === 'connected') {
      const marketplaces = Array.isArray(payload.spApi?.marketplaces) ? payload.spApi.marketplaces : [];
      return {
        connector_id: config.connector_id,
        status: 'CONNECTED',
        checked_at: new Date().toISOString(),
        source: 'amazon-sp-api-bridge',
        capabilities: ['marketplaces', 'product-identity', 'inventory', 'sales', 'traffic', 'finance'],
        details: {
          region: String(payload.spApi?.region || 'na').toUpperCase(),
          marketplace_count: Number.isInteger(payload.spApi?.marketplaceCount) ? payload.spApi.marketplaceCount : marketplaces.length,
          marketplaces: marketplaces.map(item => ({ countryCode: item.countryCode, marketplaceId: item.marketplaceId, participating: item.isParticipating === true })),
          product_count: Number.isInteger(payload.productIdentity?.productCount) ? payload.productIdentity.productCount : null,
          product_ready: payload.productIdentity?.ready === true,
          updated_at: payload.productIdentity?.updatedAt || null,
          credential_mode: payload.credentialMode || null
        },
        error: null
      };
    }

    if (config.connector_id === 'sif' && payload?.success === true && payload?.configured === true) {
      return {
        connector_id: config.connector_id,
        status: 'CONNECTED',
        checked_at: new Date().toISOString(),
        source: 'sif-bridge',
        capabilities: ['market-intelligence', 'keywords', 'competitors'],
        details: {
          server: payload.sif?.serverName || null,
          server_version: payload.sif?.serverVersion || null,
          protocol_version: payload.sif?.protocolVersion || null,
          tool_count: Number.isInteger(payload.sif?.toolCount) ? payload.sif.toolCount : null,
          marketplace: payload.sif?.defaultMarketplace || null,
          d1_bound: payload.dataLayer?.d1Bound === true,
          ingestion_mode: payload.dataLayer?.ingestionMode || null
        },
        error: null
      };
    }

    if (payload?.success === true || payload?.service) {
      return {
        connector_id: config.connector_id,
        status: 'LIVE',
        checked_at: new Date().toISOString(),
        source: 'bridge-readonly',
        capabilities: [],
        details: { service: payload.service || config.label },
        error: null
      };
    }
    return null;
  }

  function classify(error) {
    const message = String(error?.message || error || 'REQUEST_FAILED');
    if (message === 'TIMEOUT') return { code: 'TIMEOUT', message: '请求超时；连接器未在限定时间内响应。' };
    if (message === 'INVALID_JSON' || message === 'INVALID_SHAPE') return { code: 'INVALID_RESPONSE', message: '连接器返回格式无效，已按失败处理。' };
    if (/^HTTP_/.test(message) || Number.isInteger(error?.httpStatus)) return { code: error?.code || message, message: `连接器请求失败（HTTP ${error?.httpStatus || message.replace('HTTP_', '')}）。` };
    return { code: 'NETWORK_OR_CORS', message: '网络或跨域访问失败；请检查 Bridge allow-list 与部署状态。' };
  }

  function unavailable(config, status, code, message, details = {}) {
    return {
      connector_id: config.connector_id,
      status,
      checked_at: new Date().toISOString(),
      latency_ms: null,
      source: 'browser-readonly',
      capabilities: [],
      details,
      error: { code, message }
    };
  }

  async function read(connectorId) {
    const config = registry[connectorId];
    if (!config) return unavailable({ connector_id: connectorId }, 'ERROR', 'NOT_REGISTERED', 'Connector 未注册。');
    if (!config.endpoint) return unavailable(config, 'DEGRADED', 'HEALTH_ENDPOINT_NOT_CONFIGURED', '连接器已登记，但尚未配置公开只读健康端点。', { mode: config.healthPath });

    const started = performance.now();
    try {
      const payload = await window.__1122_FETCH_JSON__(config.endpoint, {
        timeoutMs: config.timeoutMs,
        retries: config.retries,
        validate: value => Boolean(normalize(config, value))
      });
      const health = normalize(config, payload);
      return { ...health, latency_ms: Number.isFinite(health.latency_ms) ? health.latency_ms : Math.round(performance.now() - started) };
    } catch (error) {
      if (config.connector_id === 'email' && error?.httpStatus === 503 && error?.responsePayload?.configured === false) {
        return unavailable(config, 'AUTH_REQUIRED', 'EMAIL_SECRETS_REQUIRED', '邮箱连接器已部署，但邮箱 Secret 尚未配置。', { configured: false });
      }
      const classified = classify(error);
      return unavailable(config, 'ERROR', classified.code, classified.message, { bridge: 'offline' });
    }
  }

  const healthy = status => status === 'LIVE' || status === 'CONNECTED';
  window.__1122_CONNECTORS__ = Object.freeze({ registry, read, validHealth, healthy });
})();
