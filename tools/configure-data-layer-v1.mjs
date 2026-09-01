import fs from 'node:fs';

const d1Id = String(process.env.D1_DATABASE_ID || '').trim();
const r2Ready = String(process.env.R2_READY || '').toLowerCase() === 'true';
if (!d1Id) throw new Error('D1_DATABASE_ID missing');

const dataConfig = '数据板块/08_存储与访问层/cloudflare/wrangler.toml';
let dataToml = fs.readFileSync(dataConfig, 'utf8');
dataToml = dataToml.replace(/database_id = "(?:__D1_DATABASE_ID__|[0-9a-f-]+)"/, `database_id = "${d1Id}"`);
if (!r2Ready) {
  dataToml = dataToml.replace(/\n\[\[r2_buckets\]\]\nbinding = "DATA_ARCHIVE"\nbucket_name = "1122-data-archive"\n?/g, '\n');
} else if (!dataToml.includes('binding = "DATA_ARCHIVE"')) {
  dataToml += '\n[[r2_buckets]]\nbinding = "DATA_ARCHIVE"\nbucket_name = "1122-data-archive"\n';
}
fs.writeFileSync(dataConfig, dataToml);

const amazonConfig = '对外连接板块/02_1122连接亚马逊API/worker/wrangler.toml';
let amazonToml = fs.readFileSync(amazonConfig, 'utf8');
if (!amazonToml.includes('binding = "CORE_DB"')) {
  amazonToml += `\n[[d1_databases]]\nbinding = "CORE_DB"\ndatabase_name = "1122-core"\ndatabase_id = "${d1Id}"\n`;
} else {
  amazonToml = amazonToml.replace(/(binding = "CORE_DB"\ndatabase_name = "1122-core"\ndatabase_id = ")[^"]+("\n)/, `$1${d1Id}$2`);
}
if (r2Ready) {
  if (!amazonToml.includes('binding = "DATA_ARCHIVE"')) {
    amazonToml += '\n[[r2_buckets]]\nbinding = "DATA_ARCHIVE"\nbucket_name = "1122-data-archive"\n';
  }
} else {
  amazonToml = amazonToml.replace(/\n\[\[r2_buckets\]\]\nbinding = "DATA_ARCHIVE"\nbucket_name = "1122-data-archive"\n?/g, '\n');
}
fs.writeFileSync(amazonConfig, amazonToml);

const manifestPath = '数据板块/08_存储与访问层/resources.json';
let previous = null;
try { previous = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch {}

const functional = {
  schema: 'DataLayerResources.v1',
  d1: { binding: 'CORE_DB', database_name: '1122-core', database_id: d1Id, ready: true },
  r2: { binding: 'DATA_ARCHIVE', bucket_name: '1122-data-archive', public: false, ready: r2Ready, status: r2Ready ? 'READY' : 'PENDING_ACCOUNT_ENABLEMENT' },
  kv: { binding: 'PRODUCT_STATE', role: 'current-state-cache', ready: true },
};

const previousFunctional = previous ? {
  schema: previous.schema,
  d1: previous.d1,
  r2: previous.r2,
  kv: previous.kv,
} : null;

const unchanged = previousFunctional && JSON.stringify(previousFunctional) === JSON.stringify(functional);
const resourceManifest = {
  ...functional,
  updated_at: unchanged && previous?.updated_at ? previous.updated_at : new Date().toISOString(),
};

fs.writeFileSync(manifestPath, JSON.stringify(resourceManifest, null, 2) + '\n');
console.log(`Data layer bindings configured: D1=ready, R2=${r2Ready ? 'ready' : 'pending'}, manifest=${unchanged ? 'unchanged' : 'updated'}`);
