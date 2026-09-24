import { readdir, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
await mkdir(root + '/artifacts/npm', { recursive: true });
for (const name of await readdir(root + '/packages')) {
    const r = spawnSync('npm', ['pack', '--offline', '--ignore-scripts', '--pack-destination', root + '/artifacts/npm'], { cwd: root + '/packages/' + name, stdio: 'inherit' });
    if (r.status !== 0)
        process.exit(r.status || 1);
}
