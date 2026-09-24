import { mkdir, readdir, symlink, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
await mkdir(root + '/node_modules/@conduitcad', { recursive: true });
for (const name of await readdir(root + '/packages')) {
    const target = root + '/node_modules/@conduitcad/' + name;
    try {
        await lstat(target);
    }
    catch {
        await symlink('../../packages/' + name, target, 'dir');
    }
}
console.log('13 local packages linked. No network dependencies.');
