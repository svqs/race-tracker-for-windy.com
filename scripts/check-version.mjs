import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const packageVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version;
const config = readFileSync(new URL('../src/pluginConfig.ts', import.meta.url), 'utf8');
assert.equal(config.match(/version:\s*['"]([^'"]+)['"]/)?.[1], packageVersion, 'package.json and pluginConfig.ts versions differ');
console.log(`Version pair matches: ${packageVersion}`);
