import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import {
  GENERATED_REGISTRY_PATH,
  buildRuntimeRegistry,
  readNavigationRegistry,
  renderGeneratedRegistry,
  validateNavigationRegistry,
} from './ui-navigation-registry-lib.mjs';

const root = process.cwd();
const registry = readNavigationRegistry(root);
const validation = validateNavigationRegistry(registry);
const runtime = buildRuntimeRegistry(registry);

assert.equal(validation.modules.length, 27, 'home, declared navigation, connector detail, and system routes must all be present');
assert.equal(runtime.routes.length, 30, 'static routes, product templates, and the existing home alias must all be declared');
assert.equal(runtime.modules.find(item => item.id === 'internal-policy')?.route, '/governance');
assert.equal(runtime.modules.find(item => item.id === 'governance'), undefined);
assert.deepEqual(
  runtime.navigation.map(item => item.id),
  ['command-center', 'selection', 'operations', 'sandbox', 'internal-policy', 'amazon-boundary', 'agents', 'skills', 'connectors', 'tasks', 'knowledge', 'memory', 'data'],
  'generated navigation must retain every visible root route in source order',
);
assert.deepEqual(
  runtime.navigation.find(item => item.id === 'operations')?.children?.map(item => item.id),
  ['products', 'inventory-logistics', 'offsite', 'competitors', 'ads'],
  'generated navigation must retain source child order',
);
assert.equal(runtime.navigation.some(item => item.id === 'competitors'), false, 'nested nodes stay attached to their immediate parent');
assert.deepEqual(
  runtime.navigation.find(item => item.id === 'operations')?.children?.find(item => item.id === 'competitors')?.children?.map(item => item.id),
  ['competitor-keywords'],
);
assert.deepEqual(
  runtime.navigation.find(item => item.id === 'connectors')?.children?.map(item => item.id),
  ['amazon-sp-api-console', 'amazon-ads-console'],
);
assert.equal(runtime.modules.find(item => item.id === 'system-overview')?.navigation_visible, false);
assert.ok(runtime.routes.some(item => item.route === '/' && item.type === 'alias'));
assert.deepEqual(
  runtime.connectors.map(item => item.connector_id),
  ['cloudflare', 'amazon-sp-api', 'amazon-ads', 'sif', 'email', 'codex'],
);

const generatedPath = join(root, ...GENERATED_REGISTRY_PATH.split('/'));
const generated = readFileSync(generatedPath, 'utf8').replace(/\r\n/g, '\n');
assert.equal(generated, renderGeneratedRegistry(registry), 'checked-in artifact must match the source registry');
const sandbox = { window: {} };
vm.runInNewContext(generated, sandbox, { filename: GENERATED_REGISTRY_PATH });
assert.equal(Object.isFrozen(sandbox.window.__1122_REGISTRY__), true, 'generated registry must be immutable at runtime');
assert.equal(Object.isFrozen(sandbox.window.__1122_REGISTRY__.modules), true, 'generated registry arrays must be immutable at runtime');
assert.equal(Object.isFrozen(sandbox.window.__1122_REGISTRY__.modules[0]), true, 'generated registry modules must be immutable at runtime');
assert.equal(Object.isFrozen(sandbox.window.__1122_REGISTRY__.connectors[0]), true, 'generated registry connectors must be immutable at runtime');
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.__1122_REGISTRY__)), runtime);

const snapshotSource = readFileSync(join(root, 'web-console', 'data', 'snapshots.js'), 'utf8');
vm.runInNewContext(snapshotSource, sandbox, { filename: 'web-console/data/snapshots.js' });
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.__1122_DATA__.navigation)), runtime.navigation, 'snapshot navigation must be derived from the generated registry');

const remoteNavigation = [{ id: 'not-a-registry-route', route: '#/not-a-registry-route' }];
const dataSourceSandbox = {
  window: { __1122_DATA__: { navigation: runtime.navigation, apr: [], aom: [], apb: [], domains: [] } },
  AbortController,
  Date,
  clearTimeout,
  setTimeout,
  fetch: async () => ({
    ok: true,
    json: async () => ({
      navigation: remoteNavigation,
      apr: [], aom: [], apb: [], domains: [], products: [], agents: [], tasks: [], sandbox_runs: [],
      source_status: {}, knowledge: {}, live_data_verified: true,
    }),
  }),
};
vm.runInNewContext(readFileSync(join(root, 'web-console', 'data', 'data-source.js'), 'utf8'), dataSourceSandbox, { filename: 'web-console/data/data-source.js' });
const loadedData = await dataSourceSandbox.window.__1122_DATA_READY__;
assert.deepEqual(JSON.parse(JSON.stringify(loadedData.navigation)), runtime.navigation, 'remote data must not override canonical navigation');

const duplicateRoute = structuredClone(registry);
duplicateRoute.primary_navigation[0].route = duplicateRoute.primary_navigation[1].route;
assert.throws(() => validateNavigationRegistry(duplicateRoute), /static module routes must be unique/);

const missingConnector = structuredClone(registry);
missingConnector.runtime.module_metadata.ads.connectors = ['not-declared'];
assert.throws(() => validateNavigationRegistry(missingConnector), /references unknown connector not-declared/);

const inconsistentHome = structuredClone(registry);
inconsistentHome.home_route = '/not-the-home-module';
assert.throws(() => validateNavigationRegistry(inconsistentHome), /home_route must match runtime\.home_module\.route/);

const invalidOrder = structuredClone(registry);
invalidOrder.primary_navigation[0].order = 99;
assert.throws(() => validateNavigationRegistry(invalidOrder), /must have order 1/);

const invalidProductRoute = structuredClone(registry);
invalidProductRoute.product_routes[0].route = '/products/:product_id-extra';
assert.throws(() => validateNavigationRegistry(invalidProductRoute), /invalid product route/);

const invalidAlias = structuredClone(registry);
invalidAlias.runtime.route_aliases = [null];
assert.throws(() => validateNavigationRegistry(invalidAlias), /route_aliases entries must contain route and target/);

const invalidConnector = structuredClone(registry);
invalidConnector.runtime.connectors = [null];
assert.throws(() => validateNavigationRegistry(invalidConnector), /connectors entries must be objects/);

const invalidShortcut = structuredClone(registry);
invalidShortcut.global_shortcuts = [null];
assert.throws(() => validateNavigationRegistry(invalidShortcut), /global_shortcuts entries must contain id, name_cn, and route/);

console.log('ui-navigation-registry.test: PASS');
