import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');

test('the console shell gates the app before data loading and shows one login entry point', async () => {
  const [index, app, dataSource, auth] = await Promise.all([
    read('index.html'),
    read('app.js'),
    read('data/data-source.js'),
    read('auth-client.js'),
  ]);

  assert.match(index, /id="access-gate"/);
  assert.match(index, /id="access-password"/);
  assert.match(index, /id="access-login-submit"[^>]*disabled/);
  assert.ok(index.indexOf('./auth-client.js') < index.indexOf('./data/data-source.js'));
  assert.match(app, /await waitForAccess\(\)/);
  assert.match(dataSource, /whenAuthenticated/);
  assert.match(dataSource, /sessionAwareOrigins/);
  assert.match(dataSource, /sif-api\.sorilo-uk\.com/);
  assert.match(dataSource, /1122-amazon-ads-bridge\.zhangshuaibing01\.workers\.dev/);
  assert.match(dataSource, /accessHeadersFor\(url\)/);
  assert.match(dataSource, /AUTH_CLIENT_NOT_AVAILABLE/);
  assert.match(auth, /mutationVersion/);
  assert.match(auth, /AUTH_REQUEST_TIMEOUT/);
  assert.match(auth, /scheduleSessionExpiry/);
});

test('keyword research and Ads state changes no longer ask for a second browser key', async () => {
  const [keywords, ads, auth] = await Promise.all([
    read('competitor-keywords-page.js'),
    read('ads-page.js'),
    read('auth-client.js'),
  ]);

  assert.doesNotMatch(keywords, /research-access-key/);
  assert.doesNotMatch(keywords, /id="research-unlock"/);
  assert.doesNotMatch(ads, /ads-write-key/);
  assert.doesNotMatch(ads, /X-1122-Ads-Write-Key/);
  assert.match(keywords, /authorizationHeaders/);
  assert.match(keywords, /\^SESSION_/);
  assert.match(auth, /sessionStorage/);
  assert.doesNotMatch(auth, /(?:window\.)?localStorage\./);
});
