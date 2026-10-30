import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Stage an explicit set of runtime files. Never archive all of dist: it also holds development JS and source maps.
const root = fileURLToPath(new URL('../', import.meta.url));
const archive = path.resolve(process.argv[2] || path.join(root, 'plugin.tar'));
const manifest = JSON.parse(readFileSync(path.join(root, 'dist/plugin.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
if (manifest.version !== pkg.version || manifest.name !== pkg.name) throw new Error('Build the current version before packaging');
const files = ['plugin.min.js', 'plugin.json', 'package.json'];
if (manifest.screenshot) {
    if (!/^screenshot\.(jpg|png|webp|jpeg)$/.test(manifest.screenshot)) throw new Error('Invalid screenshot filename');
    files.push(manifest.screenshot);
}
for (const file of files) {
    if (!existsSync(path.join(root, 'dist', file))) throw new Error(`Missing dist/${file}; run npm run build first`);
}
const stage = mkdtempSync(path.join(tmpdir(), 'racetrack-package-'));
try {
    for (const file of files) copyFileSync(path.join(root, 'dist', file), path.join(stage, file));
    writeFileSync(path.join(stage, 'plugin.json'), JSON.stringify({
        ...manifest,
        repositoryName: process.env.GITHUB_REPOSITORY || 'local',
        commitSha: process.env.GITHUB_SHA || 'local',
        repositoryOwner: process.env.GITHUB_REPOSITORY_OWNER || 'local',
    }, null, 2) + '\n');
    execFileSync('tar', ['cf', archive, '-C', stage, ...files]);
    console.log(`Plugin archive: ${statSync(archive).size} bytes (${files.join(', ')})`);
} finally {
    rmSync(stage, { recursive: true, force: true });
}
