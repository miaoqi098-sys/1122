import fs from 'node:fs';

const d1Id = String(process.env.D1_DATABASE_ID || '').trim();
if (!d1Id) throw new Error('D1_DATABASE_ID missing');

const dataConfig = '数据板块/08_存储与访问层/cloudflare/wrangler.toml';
let dataToml = fs.readFileSync(dataConfig, 'utf8');
dataToml = dataToml.replace(/database_id = "(?:__D1_DATABASE_ID__|[0-9a-f-]+)"/, `database_id = "${d1Id}"`);
fs.writeFileSync(dataConfig, dataToml);

const amazonConfig = '对外连接板块/02_1122连接亚马逊API/worker/wrangler.toml';
let amazonToml = fs.readFileSync(amazonConfig, 'utf8');
if (!amazonToml.includes('binding = "CORE_DB"')) {
  amazonToml += `\n[[d1_databases]]\nbinding = "CORE_DB"\ndatabase_name = "1122-core"\ndatabase_id = "${d1Id}"\n`;
} else {
  amazonToml = amazonToml.replace(/(binding = "CORE_DB"\ndatabase_name = "1122-core"\ndatabase_id = ")[^"]+("\n)/, `$1${d1Id}$2`);
}
if (!amazonToml.includes('binding = "DATA_ARCHIVE"')) {
  amazonToml += '\n[[r2_buckets]]\nbinding = "DATA_ARCHIVE"\nbucket_name = "1122-data-archive"\n';
}
fs.writeFileSync(amazonConfig, amazonToml);

const resourceManifest = {
  schema: 'DataLayerResources.v1',
  d1: { binding: 'CORE_DB', database_name: '1122-core', database_id: d1Id },
  r2: { binding: 'DATA_ARCHIVE', bucket_name: '1122-data-archive', public: false },
  kv: { binding: 'PRODUCT_STATE', role: 'current-state-cache' },
  updated_at: new Date().toISOString(),
};
fs.writeFileSync('数据板块/08_存储与访问层/resources.json', JSON.stringify(resourceManifest, null, 2) + '\n');
console.log('Data layer bindings configured without secrets');
