import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GENERATED_REGISTRY_PATH,
  NAVIGATION_REGISTRY_PATH,
  readNavigationRegistry,
  renderGeneratedRegistry,
} from './ui-navigation-registry-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readNavigationRegistry(root);
const generated = renderGeneratedRegistry(source);
const outputPath = join(root, ...GENERATED_REGISTRY_PATH.split('/'));

if (process.argv.includes('--check')) {
  if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n') !== generated) {
    console.error(`${GENERATED_REGISTRY_PATH} is stale. Run: node tools/generate-ui-registry.mjs`);
    process.exit(1);
  }
  console.log(`UI registry generated artifact is current: ${NAVIGATION_REGISTRY_PATH}`);
} else {
  writeFileSync(outputPath, generated, 'utf8');
  console.log(`Generated ${GENERATED_REGISTRY_PATH} from ${NAVIGATION_REGISTRY_PATH}`);
}
