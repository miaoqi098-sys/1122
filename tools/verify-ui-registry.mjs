import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import vm from 'node:vm';
import {
  GENERATED_REGISTRY_PATH,
  NAVIGATION_REGISTRY_PATH,
  buildRuntimeRegistry,
  readNavigationRegistry,
  renderGeneratedRegistry,
  validateNavigationRegistry,
} from './ui-navigation-registry-lib.mjs';

const root = process.cwd();
const consoleRoot = join(root, 'web-console');
const ignoredDirectories = new Set(['.git', 'node_modules', '.wrangler']);
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function read(relativePath) {
  return readFileSync(join(root, ...relativePath.split('/')), 'utf8');
}

function walk(directory, predicate, files = []) {
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue;
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) walk(fullPath, predicate, files);
    else if (predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

function toRepoPath(path) {
  return relative(root, path).replaceAll(sep, '/');
}

function escapeRegExp(value) {
  return value.replace(/[^A-Za-z0-9_-]/g, '\\$&');
}

const registry = readNavigationRegistry(root);
const validation = validateNavigationRegistry(registry);
const runtimeRegistry = buildRuntimeRegistry(registry);
const generatedPath = join(root, ...GENERATED_REGISTRY_PATH.split('/'));
const expectedGenerated = renderGeneratedRegistry(registry);

check(existsSync(generatedPath), GENERATED_REGISTRY_PATH + ' is missing');
if (existsSync(generatedPath)) {
  const generated = readFileSync(generatedPath, 'utf8').replace(/\r\n/g, '\n');
  check(generated === expectedGenerated, GENERATED_REGISTRY_PATH + ' is stale; run node tools/generate-ui-registry.mjs');
  try {
    const sandbox = { window: {} };
    vm.runInNewContext(generated, sandbox, { filename: GENERATED_REGISTRY_PATH });
    const generatedRuntime = JSON.parse(JSON.stringify(sandbox.window.__1122_REGISTRY__));
    check(JSON.stringify(generatedRuntime) === JSON.stringify(runtimeRegistry), 'generated browser registry does not match NavigationRegistry.v2.json');
  } catch (error) {
    failures.push('generated browser registry cannot be evaluated: ' + error.message);
  }
}

check(!existsSync(join(consoleRoot, 'registry.js')), 'legacy handwritten web-console/registry.js must not remain');

const indexHtml = read('web-console/index.html');
const generatedScriptIndex = indexHtml.indexOf('./registry.generated.js');
check(generatedScriptIndex >= 0, 'web-console/index.html does not load registry.generated.js');
check(!/\.\/registry\.js(?:\?|["'])/.test(indexHtml), 'web-console/index.html still loads legacy registry.js');
for (const consumerScript of ['./data/snapshots.js', './data/system-catalog.js', './data/data-source.js', './connectors-live.js', './app.js']) {
  const consumerIndex = indexHtml.indexOf(consumerScript);
  check(consumerIndex >= 0 && generatedScriptIndex < consumerIndex, 'registry.generated.js must load before ' + consumerScript);
}

const contractPaths = new Set();
for (const item of validation.modules) {
  if (item.source_path) {
    check(existsSync(join(root, ...item.source_path.split('/'))), item.id + ' source_path does not exist: ' + item.source_path);
  }
  if (item.view_contract) contractPaths.add(item.view_contract);
}
for (const item of validation.productRoutes) {
  if (item.view_contract) contractPaths.add(item.view_contract);
}
for (const contractPath of contractPaths) {
  const fullPath = join(root, ...contractPath.split('/'));
  check(existsSync(fullPath), 'view_contract does not exist: ' + contractPath);
  if (existsSync(fullPath)) {
    try {
      JSON.parse(readFileSync(fullPath, 'utf8'));
    } catch (error) {
      failures.push('view_contract is not valid JSON: ' + contractPath + ' (' + error.message + ')');
    }
  }
}

const allHtml = walk(root, path => path.endsWith('.html'))
  .map(toRepoPath)
  .filter(path => !path.startsWith('web-console/'));
const productPages = allHtml.filter(path => !path.includes('/site/') || path.endsWith('/site/index.html'));
const documentedLegacySources = new Set(runtimeRegistry.modules.flatMap(item => item.legacy_source ? [item.legacy_source] : []));
const missingProductPages = productPages.filter(path => !documentedLegacySources.has(path));
check(!missingProductPages.length, 'unregistered product UI found:\n' + missingProductPages.map(path => ' - ' + path).join('\n'));

const rendererFiles = walk(consoleRoot, path => path.endsWith('.js'));
const rendererRoutes = new Map();
for (const file of rendererFiles) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/renderers\[['"]([^'"]+)['"]\]\s*=/g)) {
    const route = match[1];
    const rendererPath = toRepoPath(file);
    if (rendererRoutes.has(route)) failures.push('duplicate Renderer registration for ' + route + ': ' + rendererRoutes.get(route) + ' and ' + rendererPath);
    else rendererRoutes.set(route, rendererPath);
  }
}

const registeredRoutes = new Set(rendererRoutes.keys());
const declaredRoutes = new Set(runtimeRegistry.routes.map(item => item.route));
for (const route of declaredRoutes) check(registeredRoutes.has(route), 'declared route has no Renderer: ' + route);
for (const route of registeredRoutes) check(declaredRoutes.has(route), 'Renderer route is not declared by ' + NAVIGATION_REGISTRY_PATH + ': ' + route);
for (const connector of runtimeRegistry.connectors) check(registeredRoutes.has(connector.route), 'connector ' + connector.connector_id + ' route has no Renderer: ' + connector.route);

const appSource = read('web-console/app.js');
for (const item of validation.productRoutes) {
  check(appSource.includes("pageRenderers['" + item.route + "']"), 'Router no longer resolves product template ' + item.route);
}
check(appSource.includes('window.__1122_REGISTRY__?.home_route'), 'Router default route is not derived from the generated registry');

const consoleSources = walk(consoleRoot, path => path.endsWith('.js') || path.endsWith('.html'))
  .map(path => readFileSync(path, 'utf8'))
  .join('\n');
for (const shortcut of runtimeRegistry.global_shortcuts) {
  const [route, anchor] = shortcut.route.split('#');
  check(declaredRoutes.has(route), 'global shortcut ' + shortcut.id + ' targets undeclared route ' + route);
  if (anchor) {
    const anchorExpression = new RegExp('id\\s*=\\s*["\']' + escapeRegExp(anchor) + '["\']');
    check(anchorExpression.test(consoleSources), 'global shortcut ' + shortcut.id + ' anchor is missing: #' + anchor);
  }
}

const snapshotsSource = read('web-console/data/snapshots.js');
check(!/navigation\s*:\s*\[/.test(snapshotsSource), 'snapshots.js retains a handwritten navigation tree');
check(snapshotsSource.includes('window.__1122_REGISTRY__?.navigation'), 'snapshots.js does not derive navigation from the generated registry');

const dataSource = read('web-console/data/data-source.js');
check(/navigation\s*:\s*fallback\.navigation/.test(dataSource), 'data-source.js allows remote navigation to override the canonical registry');

const catalogSource = read('web-console/data/system-catalog.js');
check(catalogSource.includes('window.__1122_REGISTRY__?.modules'), 'system-catalog.js does not derive module identity from the generated registry');
try {
  const sandbox = { window: {} };
  vm.runInNewContext(read(GENERATED_REGISTRY_PATH), sandbox, { filename: GENERATED_REGISTRY_PATH });
  vm.runInNewContext(catalogSource, sandbox, { filename: 'web-console/data/system-catalog.js' });
  const modulesById = new Map(runtimeRegistry.modules.map(item => [item.id, item]));
  for (const catalogModule of sandbox.window.__1122_SYSTEM_CATALOG__?.modules || []) {
    const canonical = modulesById.get(catalogModule.id);
    check(Boolean(canonical), 'system catalog contains undeclared module ' + catalogModule.id);
    if (canonical) {
      for (const field of ['label', 'route', 'source_path', 'readiness']) {
        check(catalogModule[field] === canonical[field], 'system catalog ' + catalogModule.id + ' ' + field + ' is not canonical');
      }
    }
  }
} catch (error) {
  failures.push('system catalog cannot be evaluated with the generated registry: ' + error.message);
}

if (failures.length) {
  console.error('UI registry verification failed:\n' + failures.map(failure => ' - ' + failure).join('\n'));
  process.exit(1);
}

console.log('UI registry verified: ' + productPages.length + ' product page(s), ' + runtimeRegistry.modules.length + ' runtime module(s), ' + rendererRoutes.size + ' Renderer route(s).');
