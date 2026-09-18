import test from 'node:test';
import assert from 'node:assert/strict';

import {
  issueWebConsoleSession,
  matchesWebConsoleAccessKey,
  verifyWebConsoleSession,
  webConsoleLoginConfigured,
} from '../web-console-access-session.js';

const env = {
  WEB_CONSOLE_ACCESS_KEY: 'test-login-only',
  WEB_CONSOLE_SESSION_SIGNING_KEY: 'test-signing-only',
};

test('issues a bounded signed session with the requested permitted scope', async () => {
  const session = await issueWebConsoleSession(env, {
    nowMs: 1_000_000,
    ttlSeconds: 300,
    scope: ['console:read', 'research:execute'],
  });
  const verified = await verifyWebConsoleSession(`Bearer ${session.token}`, env, {
    nowMs: 1_001_000,
    requiredScope: 'research:execute',
  });

  assert.equal(webConsoleLoginConfigured(env), true);
  assert.equal(session.expires_in, 300);
  assert.deepEqual(session.scope, ['console:read', 'research:execute']);
  assert.equal(verified.ok, true);
  assert.deepEqual(verified.session.scope, ['console:read', 'research:execute']);
});

test('rejects tampered, expired, and scope-insufficient sessions', async () => {
  const session = await issueWebConsoleSession(env, {
    nowMs: 2_000_000,
    ttlSeconds: 60,
    scope: ['console:read'],
  });
  const tampered = `${session.token.slice(0, -1)}${session.token.endsWith('a') ? 'b' : 'a'}`;

  assert.equal((await verifyWebConsoleSession(`Bearer ${tampered}`, env, { nowMs: 2_001_000 })).code, 'SESSION_INVALID');
  assert.equal((await verifyWebConsoleSession(`Bearer ${session.token}`, env, { nowMs: 2_061_000 })).code, 'SESSION_EXPIRED');
  assert.equal((await verifyWebConsoleSession(`Bearer ${session.token}`, env, {
    nowMs: 2_001_000,
    requiredScope: 'ads:campaign-state',
  })).code, 'SESSION_SCOPE_DENIED');
});

test('uses the existing server-only SIF credentials as a migration fallback', async () => {
  const fallbackEnv = {
    SIF_RESEARCH_ACCESS_KEY: 'existing-research-password',
    SIF_MCP_SECRET: 'existing-server-only-sif-secret',
  };
  const session = await issueWebConsoleSession(fallbackEnv, {
    nowMs: 3_000_000,
    ttlSeconds: 120,
    scope: ['console:read'],
  });

  assert.equal(webConsoleLoginConfigured(fallbackEnv), true);
  assert.equal(await matchesWebConsoleAccessKey('existing-research-password', fallbackEnv), true);
  assert.equal(await matchesWebConsoleAccessKey('wrong-password', fallbackEnv), false);
  assert.equal((await verifyWebConsoleSession(`Bearer ${session.token}`, fallbackEnv, {
    nowMs: 3_001_000,
    requiredScope: 'console:read',
  })).ok, true);
});
