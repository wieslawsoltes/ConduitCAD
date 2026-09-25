import { mkdir, readdir, symlink, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
await mkdir(root + '/node_modules/@conduitcad', { recursive: true });
const names=(await readdir(root + '/packages',{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>e.name);
for (const name of names) {
    const target = root + '/node_modules/@conduitcad/' + name;
    try {
        await lstat(target);
    }
    catch {
        await symlink('../../packages/' + name, target, 'dir');
    }
}
console.log(`${names.length} local packages linked. No network dependencies.`);
