import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../worker.js';
import { issueWebConsoleSession } from '../../../../shared/web-console-access-session.js';

const origin = 'https://1122.sorilo-uk.com';
const env = { WEB_CONSOLE_SESSION_SIGNING_KEY: 'test-session-signing-key' };

function request(headers = {}) {
  return new Request('https://worker.example/write-intents/campaign-state?region=na', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'ads-session-test-0001',
      ...headers,
    },
    body: JSON.stringify({
      profile_id: '1',
      campaign_id: '2',
      state: 'PAUSED',
      confirmation: 'APPLY CAMPAIGN STATE',
    }),
  });
}

test('the Ads write gate accepts the shared 1122 session before service configuration', async () => {
  const session = await issueWebConsoleSession(env, { scope: ['ads:campaign-state'] });
  const response = await worker.fetch(request({ Authorization: `Bearer ${session.token}` }), env);
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, 'SERVICE_NOT_CONFIGURED');
});

test('the Ads write gate still rejects missing browser authorization', async () => {
  const response = await worker.fetch(request(), env);
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.error.code, 'WRITE_ACCESS_DENIED');
});

test('the Ads write gate preserves an expired-session code for browser logout', async () => {
  const session = await issueWebConsoleSession(env, {
    nowMs: 0,
    ttlSeconds: 60,
    scope: ['ads:campaign-state'],
  });
  const response = await worker.fetch(request({ Authorization: `Bearer ${session.token}` }), env);
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.error.code, 'SESSION_EXPIRED');
});
