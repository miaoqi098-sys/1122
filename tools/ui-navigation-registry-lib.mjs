import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const NAVIGATION_REGISTRY_PATH = 'UI界面设计板块/NavigationRegistry.v2.json';
export const GENERATED_REGISTRY_PATH = 'web-console/registry.generated.js';

const REQUIRED_UI_FIELDS = ['kind', 'readiness', 'summary'];
const PRODUCT_ROUTE_PATTERNS = [
  '/products/:product_id',
  '/products/:product_id/policy-impact',
];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unique(values) {
  return [...new Set(values)];
}

function sourceItem(item, parent = null, section = 'primary') {
  return { ...(isObject(item) ? item : {}), parent, section };
}

export function flattenNavigation(items, parent = null, section = 'primary') {
  return (Array.isArray(items) ? items : []).flatMap((item) => {
    const normalized = isObject(item) ? item : {};
    return [
      sourceItem(normalized, parent, section),
      ...flattenNavigation(normalized.children, normalized.id, section),
    ];
  });
}

export function readNavigationRegistry(root) {
  return JSON.parse(readFileSync(join(root, ...NAVIGATION_REGISTRY_PATH.split('/')), 'utf8'));
}

function sourceModules(registry) {
  const runtime = registry.runtime || {};
  const home = runtime.home_module ? [sourceItem(runtime.home_module, null, 'home')] : [];
  return [
    ...home,
    ...flattenNavigation(registry.primary_navigation, null, 'primary'),
    ...flattenNavigation(registry.support_navigation, null, 'support'),
    ...(Array.isArray(registry.system_routes) ? registry.system_routes : []).map((item) => sourceItem(item, null, 'system')),
  ];
}

function routeDescriptor(route, type, item = {}) {
  return {
    route,
    type,
    ...(item.id ? { id: item.id } : {}),
    ...(item.name_cn ? { label: item.name_cn } : {}),
    ...(item.view_contract ? { view_contract: item.view_contract } : {}),
  };
}

function validationError(errors) {
  if (errors.length) throw new Error(`Navigation registry validation failed:\n${errors.map((error) => ` - ${error}`).join('\n')}`);
}

export function validateNavigationRegistry(registry) {
  const errors = [];
  if (!isObject(registry)) errors.push('root must be an object');
  if (!nonEmptyString(registry?.schema_version)) errors.push('schema_version must be a non-empty string');
  if (registry?.registry_type !== '1122_UI_NAVIGATION_REGISTRY') errors.push('registry_type must be 1122_UI_NAVIGATION_REGISTRY');
  if (registry?.architecture !== '12+1+1') errors.push('architecture must be 12+1+1');
  if (!Array.isArray(registry?.primary_navigation) || registry.primary_navigation.length !== 12) {
    errors.push('primary_navigation must contain 12 entries');
  }
  if (!nonEmptyString(registry?.home_route)) errors.push('home_route must be a non-empty route');
  if (!isObject(registry?.runtime)) errors.push('runtime must be an object');
  if (!nonEmptyString(registry?.runtime?.version)) errors.push('runtime.version must be a non-empty string');
  if (!isObject(registry?.runtime?.home_module)) errors.push('runtime.home_module must be an object');
  if (!isObject(registry?.runtime?.module_metadata)) errors.push('runtime.module_metadata must be an object');
  if (!Array.isArray(registry?.runtime?.connectors)) errors.push('runtime.connectors must be an array');
  if (!Array.isArray(registry?.runtime?.route_aliases)) errors.push('runtime.route_aliases must be an array');
  if (isObject(registry?.runtime?.home_module) && nonEmptyString(registry?.home_route) && registry.home_route !== registry.runtime.home_module.route) {
    errors.push('home_route must match runtime.home_module.route');
  }
  for (const field of ['execution_authorized', 'production_write_authorized', 'amazon_write_authorized']) {
    if (registry?.[field] !== false) errors.push(`${field} must remain false in the UI registry`);
  }
  validationError(errors);

  const modules = sourceModules(registry);
  const moduleIds = modules.map((item) => item.id);
  const moduleRoutes = modules.map((item) => item.route);
  if (unique(moduleIds).length !== moduleIds.length) errors.push('static module ids must be unique');
  if (unique(moduleRoutes).length !== moduleRoutes.length) errors.push('static module routes must be unique');
  for (const [index, item] of registry.primary_navigation.entries()) {
    if (!isObject(item)) errors.push(`primary navigation entry ${index + 1} must be an object`);
    else if (item.order !== index + 1) errors.push(`${item.id || `primary navigation entry ${index + 1}`} must have order ${index + 1}`);
  }

  for (const item of modules) {
    if (!nonEmptyString(item.id)) errors.push(`${item.section} module is missing id`);
    if (!nonEmptyString(item.name_cn)) errors.push(`${item.id || item.route} is missing name_cn`);
    if (!nonEmptyString(item.route) || !item.route.startsWith('/')) errors.push(`${item.id || item.name_cn} has invalid route`);
    if (item.section !== 'home' && item.section !== 'system' && !nonEmptyString(item.source_path)) errors.push(`${item.id} is missing source_path`);
    if (item.parent && !moduleIds.includes(item.parent)) errors.push(`${item.id} has unknown parent ${item.parent}`);

    const metadata = item.section === 'home' ? item.ui : registry.runtime.module_metadata[item.id];
    if (!isObject(metadata)) {
      errors.push(`${item.id} is missing runtime metadata`);
      continue;
    }
    for (const field of REQUIRED_UI_FIELDS) if (!nonEmptyString(metadata[field])) errors.push(`${item.id} runtime metadata is missing ${field}`);
    if ((item.section === 'home' || (item.parent === null && item.section === 'primary')) && !nonEmptyString(metadata.nav_group)) errors.push(`${item.id} root navigation metadata is missing nav_group`);
    if ((item.section === 'home' || (item.parent === null && item.section === 'primary')) && !nonEmptyString(metadata.icon)) errors.push(`${item.id} root navigation metadata is missing icon`);
  }

  const expectedMetadataIds = modules.filter((item) => item.section !== 'home').map((item) => item.id);
  const metadataIds = Object.keys(registry.runtime.module_metadata);
  for (const id of expectedMetadataIds) if (!metadataIds.includes(id)) errors.push(`runtime metadata does not cover ${id}`);
  for (const id of metadataIds) if (!expectedMetadataIds.includes(id)) errors.push(`runtime metadata contains undeclared module ${id}`);

  const productRoutes = Array.isArray(registry.product_routes) ? registry.product_routes : [];
  const productRouteValues = [];
  for (const item of productRoutes) {
    if (!isObject(item)) {
      errors.push('product_routes entries must be objects');
      continue;
    }
    productRouteValues.push(item.route);
    if (!PRODUCT_ROUTE_PATTERNS.includes(item.route)) errors.push(`invalid product route ${item.route || '(missing)'}`);
    if (!nonEmptyString(item.name_cn)) errors.push(`${item.route || 'product route'} is missing name_cn`);
  }
  if (unique(productRouteValues).length !== productRouteValues.length) errors.push('product routes must be unique');
  for (const route of PRODUCT_ROUTE_PATTERNS) if (!productRouteValues.includes(route)) errors.push(`required product route is missing: ${route}`);
  const allDeclaredRoutes = [...moduleRoutes, ...productRouteValues];
  if (unique(allDeclaredRoutes).length !== allDeclaredRoutes.length) errors.push('static and product route declarations must be unique');

  const aliases = registry.runtime.route_aliases;
  const aliasRoutes = [];
  for (const alias of aliases) {
    if (!isObject(alias) || !nonEmptyString(alias.route) || !nonEmptyString(alias.target)) {
      errors.push('route_aliases entries must contain route and target');
      continue;
    }
    aliasRoutes.push(alias.route);
    if (!alias.route.startsWith('/') || !alias.target.startsWith('/')) errors.push(`invalid route alias ${alias.route}`);
    if (allDeclaredRoutes.includes(alias.route)) errors.push(`route alias duplicates declared route ${alias.route}`);
    if (!moduleRoutes.includes(alias.target)) errors.push(`route alias ${alias.route} targets unknown route ${alias.target}`);
  }
  if (unique(aliasRoutes).length !== aliasRoutes.length) errors.push('route aliases must be unique');

  const connectorIds = [];
  const connectors = [];
  for (const connector of registry.runtime.connectors) {
    if (!isObject(connector)) {
      errors.push('connectors entries must be objects');
      continue;
    }
    connectors.push(connector);
    connectorIds.push(connector.connector_id);
  }
  if (unique(connectorIds).length !== connectorIds.length) errors.push('connector_id values must be unique');
  for (const connector of connectors) {
    for (const field of ['connector_id', 'label', 'route', 'healthPath', 'writeMode']) {
      if (!nonEmptyString(connector[field])) errors.push(`connector ${connector.connector_id || '(missing)'} is missing ${field}`);
    }
    if (!moduleRoutes.includes(connector.route)) errors.push(`connector ${connector.connector_id || '(missing)'} targets unregistered route ${connector.route}`);
    if (!Number.isFinite(connector.timeoutMs) || connector.timeoutMs < 0) errors.push(`connector ${connector.connector_id || '(missing)'} has invalid timeoutMs`);
    if (!Number.isInteger(connector.retries) || connector.retries < 0) errors.push(`connector ${connector.connector_id || '(missing)'} has invalid retries`);
  }

  const connectorIdSet = new Set(connectorIds);
  for (const item of modules) {
    const metadata = item.section === 'home' ? item.ui : registry.runtime.module_metadata[item.id];
    for (const connectorId of metadata?.connectors || []) {
      if (!connectorIdSet.has(connectorId)) errors.push(`${item.id} references unknown connector ${connectorId}`);
    }
  }

  if (!Array.isArray(registry.global_shortcuts)) errors.push('global_shortcuts must be an array');
  const shortcutIds = [];
  const shortcutRouteValues = [];
  for (const shortcut of Array.isArray(registry.global_shortcuts) ? registry.global_shortcuts : []) {
    if (!isObject(shortcut) || !nonEmptyString(shortcut.id) || !nonEmptyString(shortcut.name_cn) || !nonEmptyString(shortcut.route)) {
      errors.push('global_shortcuts entries must contain id, name_cn, and route');
      continue;
    }
    const [route, ...fragments] = shortcut.route.split('#');
    shortcutIds.push(shortcut.id);
    shortcutRouteValues.push(shortcut.route);
    if (!route.startsWith('/') || fragments.length > 1) errors.push(`global shortcut has invalid route ${shortcut.route}`);
    if (!moduleRoutes.includes(route)) errors.push(`global shortcut targets undeclared route ${route}`);
  }
  if (unique(shortcutIds).length !== shortcutIds.length) errors.push('global shortcut ids must be unique');
  if (unique(shortcutRouteValues).length !== shortcutRouteValues.length) errors.push('global shortcut routes must be unique');
  validationError(errors);

  return {
    modules,
    productRoutes,
    aliases,
    moduleRoutes,
    allDeclaredRoutes,
  };
}

function runtimeModule(item, registry) {
  const metadata = item.section === 'home' ? item.ui : registry.runtime.module_metadata[item.id];
  return {
    id: item.id,
    label: item.name_cn,
    route: item.route,
    ...(item.parent ? { parent: item.parent } : {}),
    ...(item.source_path ? { source_path: item.source_path } : {}),
    ...(item.view_contract ? { view_contract: item.view_contract } : {}),
    ...(item.priority ? { priority: item.priority } : {}),
    ...(item.enabled !== undefined ? { enabled: item.enabled } : {}),
    ...(item.navigation_visible === false ? { navigation_visible: false } : {}),
    ...metadata,
  };
}

function navigationTree(modules, parent = null) {
  return modules
    .filter((item) => (item.parent ?? null) === parent && item.navigation_visible !== false && item.kind !== 'support')
    .map((item) => {
      const children = navigationTree(modules, item.id);
      return {
        id: item.id,
        label: item.label,
        ...(item.icon ? { icon: item.icon } : {}),
        route: `#${item.route}`,
        ...(children.length ? { children } : {}),
      };
    });
}

export function buildRuntimeRegistry(registry) {
  const validation = validateNavigationRegistry(registry);
  const modules = validation.modules.map((item) => runtimeModule(item, registry));
  const routes = [
    ...modules.map((item) => routeDescriptor(item.route, 'static', item)),
    ...validation.productRoutes.map((item) => routeDescriptor(item.route, 'product-template', item)),
    ...validation.aliases.map((alias) => ({ route: alias.route, type: 'alias', target: alias.target })),
  ];
  return {
    version: registry.runtime.version,
    source_schema_version: registry.schema_version,
    home_route: registry.home_route,
    modules,
    connectors: clone(registry.runtime.connectors),
    routes,
    navigation: navigationTree(modules),
    global_shortcuts: clone(registry.global_shortcuts || []),
    authorization: {
      execution_authorized: registry.execution_authorized,
      production_write_authorized: registry.production_write_authorized,
      amazon_write_authorized: registry.amazon_write_authorized,
      research_execution_mode: registry.research_execution_mode,
    },
  };
}

export function renderGeneratedRegistry(registry) {
  const runtimeRegistry = buildRuntimeRegistry(registry);
  const sourceHash = createHash('sha256').update(JSON.stringify(registry)).digest('hex').slice(0, 16);
  const serialized = JSON.stringify(runtimeRegistry, null, 2);
  return `// AUTO-GENERATED from ${NAVIGATION_REGISTRY_PATH}. DO NOT EDIT.\n// source-sha256: ${sourceHash}\n(() => {\n  const deepFreeze = value => {\n    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;\n    Object.values(value).forEach(deepFreeze);\n    return Object.freeze(value);\n  };\n  const registry = ${serialized};\n  window.__1122_REGISTRY__ = deepFreeze(registry);\n})();\n`;
}
