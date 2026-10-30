// Bundles racetrack's plain TypeScript modules (no Windy, no Svelte) so Node scripts can use the real code.
import { rollup } from 'rollup';
import rollupSwc from 'rollup-plugin-swc3';
import resolve from '@rollup/plugin-node-resolve';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function loadLib() {
    const entry = path.join(mkdtempSync(path.join(tmpdir(), 'racetrack-lib-')), 'entry.ts');
    writeFileSync(entry, ['data', 'race', 'geo', 'units', 'source', 'layers'].map(m => `export * from ${JSON.stringify(path.join(root, 'src/lib', m))};`).join('\n'));
    const bundle = await rollup({ input: entry, plugins: [resolve({ extensions: ['.ts', '.js'] }), rollupSwc({ include: ['**/*.ts'], sourceMaps: false, tsconfig: path.join(root, 'tsconfig.json') })] });
    const out = entry.replace(/\.ts$/, '.mjs');
    await bundle.write({ file: out, format: 'es' });
    return import(pathToFileURL(out).href);
}
