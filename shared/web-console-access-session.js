const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export const WEB_CONSOLE_SESSION_AUDIENCE = '1122-web-console';
export const WEB_CONSOLE_SESSION_SCOPES = Object.freeze([
  'console:read',
  'research:execute',
  'ads:campaign-state',
]);

const DEFAULT_TTL_SECONDS = 4 * 60 * 60;
const MAX_TTL_SECONDS = 8 * 60 * 60;
const MAX_TOKEN_LENGTH = 4096;

function base64urlEncode(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function base64urlDecode(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = `${value.replaceAll('-', '+').replaceAll('_', '/')}${'='.repeat((4 - (value.length % 4)) % 4)}`;
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function safeJson(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function epochSeconds(nowMs) {
  return Math.floor((Number.isFinite(nowMs) ? nowMs : Date.now()) / 1000);
}

function boundedTtl(value) {
  const requested = Number(value);
  if (!Number.isInteger(requested) || requested <= 0) return DEFAULT_TTL_SECONDS;
  return Math.min(requested, MAX_TTL_SECONDS);
}

function configuredSecret(env, name) {
  return String(env?.[name] || '').trim();
}

function scopesFrom(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((scope) => WEB_CONSOLE_SESSION_SCOPES.includes(scope)))];
}

function bearerToken(value) {
  const header = typeof value === 'string'
    ? value
    : String(value?.headers?.get?.('Authorization') || '');
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match ? match[1].trim() : '';
  return token && token.length <= MAX_TOKEN_LENGTH ? token : '';
}

async function hmac(secret, content) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(content));
  return base64urlEncode(new Uint8Array(signature));
}

export function fixedTimeEqual(leftValue, rightValue) {
  const left = encoder.encode(String(leftValue || ''));
  const right = encoder.encode(String(rightValue || ''));
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] || 0) ^ (right[index] || 0);
  }
  return mismatch === 0;
}

export function webConsoleSessionConfigured(env) {
  return Boolean(configuredSecret(env, 'WEB_CONSOLE_SESSION_SIGNING_KEY'));
}

export function webConsoleLoginConfigured(env) {
  return Boolean(configuredSecret(env, 'WEB_CONSOLE_ACCESS_KEY') && webConsoleSessionConfigured(env));
}

export async function matchesWebConsoleAccessKey(presented, env) {
  const expected = configuredSecret(env, 'WEB_CONSOLE_ACCESS_KEY');
  return Boolean(expected && presented && fixedTimeEqual(String(presented), expected));
}

export async function issueWebConsoleSession(env, options = {}) {
  const secret = configuredSecret(env, 'WEB_CONSOLE_SESSION_SIGNING_KEY');
  if (!secret) throw new Error('WEB_CONSOLE_SESSION_NOT_CONFIGURED');
  const issuedAt = epochSeconds(options.nowMs);
  const ttlSeconds = boundedTtl(options.ttlSeconds);
  const scope = scopesFrom(options.scope?.length ? options.scope : WEB_CONSOLE_SESSION_SCOPES);
  if (!scope.length) throw new Error('WEB_CONSOLE_SESSION_SCOPE_INVALID');

  const payload = {
    v: 1,
    aud: WEB_CONSOLE_SESSION_AUDIENCE,
    scope,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
    jti: crypto.randomUUID(),
  };
  const encodedPayload = base64urlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await hmac(secret, encodedPayload);
  return {
    token: `v1.${encodedPayload}.${signature}`,
    expires_at: new Date(payload.exp * 1000).toISOString(),
    expires_in: ttlSeconds,
    scope,
  };
}

export async function verifyWebConsoleSession(requestOrAuthorization, env, options = {}) {
  const secret = configuredSecret(env, 'WEB_CONSOLE_SESSION_SIGNING_KEY');
  if (!secret) return { ok: false, code: 'SESSION_AUTH_NOT_CONFIGURED' };

  const token = bearerToken(requestOrAuthorization);
  if (!token) return { ok: false, code: 'SESSION_REQUIRED' };
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || !parts[1] || !parts[2]) {
    return { ok: false, code: 'SESSION_INVALID' };
  }

  const expectedSignature = await hmac(secret, parts[1]);
  if (!fixedTimeEqual(parts[2], expectedSignature)) return { ok: false, code: 'SESSION_INVALID' };

  const decodedPayload = base64urlDecode(parts[1]);
  if (!decodedPayload) return { ok: false, code: 'SESSION_INVALID' };
  let payload;
  try {
    payload = safeJson(decoder.decode(decodedPayload));
  } catch {
    return { ok: false, code: 'SESSION_INVALID' };
  }
  if (!payload || payload.v !== 1 || payload.aud !== WEB_CONSOLE_SESSION_AUDIENCE) {
    return { ok: false, code: 'SESSION_INVALID' };
  }

  const now = epochSeconds(options.nowMs);
  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.exp <= payload.iat || payload.exp - payload.iat > MAX_TTL_SECONDS || payload.iat > now + 60) {
    return { ok: false, code: 'SESSION_INVALID' };
  }
  if (payload.exp <= now) return { ok: false, code: 'SESSION_EXPIRED' };

  const scope = scopesFrom(payload.scope);
  const requiredScope = options.requiredScope || null;
  if (requiredScope && !scope.includes(requiredScope)) return { ok: false, code: 'SESSION_SCOPE_DENIED' };

  return {
    ok: true,
    session: {
      audience: payload.aud,
      scope,
      issued_at: payload.iat,
      expires_at: payload.exp,
    },
  };
}
