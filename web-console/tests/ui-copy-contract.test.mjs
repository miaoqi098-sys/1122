import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(testDirectory, '..', '..');
const [uiTextSource, homeSource, registrySource] = await Promise.all([
  readFile(new URL('../ui-text.js', import.meta.url), 'utf8'),
  readFile(new URL('../home-live.js', import.meta.url), 'utf8'),
  readFile(new URL('../registry.js', import.meta.url), 'utf8')
]);

function loadHomeRenderer() {
  const window = { __1122_PAGE_RENDERERS__: {} };
  const context = vm.createContext({ window, Intl });
  vm.runInContext(uiTextSource, context, { filename: 'ui-text.js' });
  vm.runInContext(homeSource, context, { filename: 'home-live.js' });
  return { renderer: window.__1122_PAGE_RENDERERS__['/command-center'], uiText: window.__1122_UI_TEXT__ };
}

test('known interface statuses are localized while arbitrary captured values remain unchanged', () => {
  const { uiText } = loadHomeRenderer();
  assert.equal(uiText.status('LIVE_D1_READ'), '实时只读');
  assert.equal(uiText.status('PENDING_APPROVAL'), '等待审批');
  assert.equal(uiText.status('CAPTURED_EXTERNAL_VALUE'), 'CAPTURED_EXTERNAL_VALUE');
});

test('home keeps exactly four high-priority Chinese workbench entries and preserves dynamic product text', async () => {
  const { renderer } = loadHomeRenderer();
  const view = { innerHTML: '' };
  await renderer({
    data: {
      generated_at: '2026-09-20T08:00:00.000Z',
      products: [{ product_id: '商品一', title: 'Captured English Product', sales: 12, units: 2, ad_spend: 1, contribution_profit: 3, sessions: 10, orders_count: 1 }],
      tasks: [{ task_id: '任务一', task_type: 'Captured English Task', task_status: 'PENDING_APPROVAL', approval_status: 'PENDING' }],
      agents: [],
      __source: { source_status: { products: 'LIVE_D1_READ', tasks: 'LIVE_D1_READ', agents: 'LIVE_D1_READ' } }
    },
    view,
    setChrome: () => {},
    isCurrent: () => true
  });

  assert.equal((view.innerHTML.match(/class="priority-card priority-card-/g) || []).length, 4);
  assert.match(view.innerHTML, /每日工作流程/);
  assert.match(view.innerHTML, /产品推广计划/);
  assert.match(view.innerHTML, /Captured English Task/);
  assert.doesNotMatch(view.innerHTML, /Stage Engine|Daily Brief|GLOBAL SEARCH/);
});

test('runtime navigation preserves existing routes while using Chinese labels', () => {
  assert.match(registrySource, /route:'\/operations\/daily-sop'/);
  assert.match(registrySource, /route:'\/operations\/products\/promotion-plan'/);
  assert.match(registrySource, /label:'每日工作流程'/);
  assert.match(registrySource, /label:'产品推广计划'/);
});

test('static Chinese UI copy verifier passes', () => {
  const result = spawnSync(process.execPath, ['tools/verify-web-console-static-copy.mjs'], {
    cwd: repositoryRoot,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
