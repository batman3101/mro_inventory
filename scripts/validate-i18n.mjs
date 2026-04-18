#!/usr/bin/env node
/**
 * i18n locale parity checker
 * Exit 0 if ko.json and vi.json have identical key trees.
 * Exit 1 with a diff list otherwise.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, '..', 'src', 'i18n', 'locales');

function flatten(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flatten(v, key));
    } else {
      out.push(key);
    }
  }
  return out;
}

function load(file) {
  const raw = readFileSync(resolve(localesDir, file), 'utf8');
  return JSON.parse(raw);
}

const ko = load('ko.json');
const vi = load('vi.json');

const koKeys = new Set(flatten(ko));
const viKeys = new Set(flatten(vi));

const missingInVi = [...koKeys].filter((k) => !viKeys.has(k)).sort();
const missingInKo = [...viKeys].filter((k) => !koKeys.has(k)).sort();

if (missingInVi.length === 0 && missingInKo.length === 0) {
  console.log(`✅ i18n locale keys match (${koKeys.size} keys in both ko/vi)`);
  process.exit(0);
}

console.error('❌ i18n locale key mismatch detected');
if (missingInVi.length > 0) {
  console.error(`\n🇻🇳 Missing in vi.json (${missingInVi.length}):`);
  for (const k of missingInVi) console.error(`  - ${k}`);
}
if (missingInKo.length > 0) {
  console.error(`\n🇰🇷 Missing in ko.json (${missingInKo.length}):`);
  for (const k of missingInKo) console.error(`  - ${k}`);
}
process.exit(1);
