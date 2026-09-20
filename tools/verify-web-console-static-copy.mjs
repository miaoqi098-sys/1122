import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const sources = [
  'web-console/index.html',
  'web-console/registry.js',
  'web-console/home-live.js',
  'web-console/live-pages.js',
  'web-console/operations-planning-pages.js',
  'web-console/ads-page.js',
  'web-console/competitor-keywords-page.js',
  'web-console/boundary-pages.js',
  'web-console/knowledge-page.js',
  'web-console/connector-pages.js',
  'web-console/system-pages.js',
  'web-console/data/snapshots.js',
  'web-console/data/system-catalog.js'
];

const asciiWord = /[A-Za-z]{2,}/;
const findings = [];

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function report(path, source, index, fragment) {
  findings.push(`${path}:${lineNumber(source, index)} contains static English UI copy: ${JSON.stringify(fragment.trim())}`);
}

function removeInterpolations(value) {
  return value.replace(/\$\{[^{}]*\}/g, '').replace(/&(?:amp|lt|gt|quot|#039);/g, ' ');
}

function inspectMarkup(path, source) {
  const textNode = /<[A-Za-z][\w:-]*(?:\s[^<>]*)?>([^<\r\n]*)<\/[A-Za-z][\w:-]*>/g;
  for (const match of source.matchAll(textNode)) {
    if (match[1].includes('${')) continue;
    const value = removeInterpolations(match[1]);
    if (asciiWord.test(value)) report(path, source, match.index, value);
  }

  const attributes = /\b(?:placeholder|aria-label|title)=(['"])(.*?)\1/g;
  for (const match of source.matchAll(attributes)) {
    const value = removeInterpolations(match[2]);
    if (asciiWord.test(value)) report(path, source, match.index, value);
  }
}

function inspectHeroAndChrome(path, source) {
  const calls = /\b(?:hero|setChrome)\(\s*(['"])([^'"\n]*)\1\s*,\s*(['"])([^'"\n]*)\3(?:\s*,\s*(['"])([^'"\n]*)\5)?/g;
  for (const match of source.matchAll(calls)) {
    for (const value of [match[2], match[4], match[6]]) {
      if (value && asciiWord.test(value)) report(path, source, match.index, value);
    }
  }
}

function inspectNamedCopy(path, source) {
  const values = /\b(?:label|summary|title_cn|method_name_cn|objective|impact|business_goal|observed_effect)\s*:\s*(['"])([^'"\n]*)\1/g;
  for (const match of source.matchAll(values)) {
    if (asciiWord.test(match[2])) report(path, source, match.index, match[2]);
  }
}

for (const path of sources) {
  const source = readFileSync(join(root, path), 'utf8');
  inspectMarkup(path, source);
  inspectHeroAndChrome(path, source);
  inspectNamedCopy(path, source);
}

if (findings.length) {
  console.error('Static UI copy verification failed. Only fetched or user-provided values may remain untranslated.');
  console.error(findings.map(item => ` - ${item}`).join('\n'));
  process.exit(1);
}

console.log(`Static Chinese UI copy verified across ${sources.length} frontend source files.`);
