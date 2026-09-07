import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const ignored = new Set(['.git','node_modules','.wrangler']);
const html = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry); const rel = relative(root, full);
    if (ignored.has(entry) || rel.startsWith(`web-console${sep}`)) continue;
    if (statSync(full).isDirectory()) walk(full);
    else if (entry.endsWith('.html')) html.push(rel.replaceAll(sep,'/'));
  }
}
walk(root);
const registry = readFileSync(join(root,'web-console','registry.js'),'utf8');
const documented = new Set([...registry.matchAll(/legacy_source:\s*'([^']+)'/g)].map(x=>x[1]));
const productPages = html.filter(p => !p.includes('/site/') || p.endsWith('/site/index.html'));
const missing = productPages.filter(p => !documented.has(p));
if (missing.length) {
  console.error(`Unregistered product UI found:\n${missing.map(p=>` - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`UI registry verified: ${productPages.length} discovered product page(s) registered.`);
