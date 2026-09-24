import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const root = path.resolve(import.meta.dirname, '..');
const entries = (await readdir(path.join(root, 'packages'), { withFileTypes: true })).filter(entry => entry.isDirectory());
const packages = await Promise.all(entries.map(async entry => JSON.parse(await readFile(path.join(root, 'packages', entry.name, 'package.json'), 'utf8'))));
if (!packages.length) throw new Error('No reusable packages found.');
const archives = packages.map(pkg => path.join(root, 'artifacts/npm', `${pkg.name.replace(/^@/, '').replaceAll('/', '-')}-${pkg.version}.tgz`));
await Promise.all(archives.map(file => access(file)));
const consumer = await mkdtemp(path.join(os.tmpdir(), 'conduitcad-package-consumer-'));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: consumer, encoding: 'utf8', timeout: 120000 });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message || result.stderr || result.stdout}`);
  return result.stdout;
}
try {
  await writeFile(path.join(consumer, 'package.json'), JSON.stringify({ name: 'conduitcad-offline-consumer', private: true, type: 'module' }));
  console.log(run('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', path.join(consumer, 'empty-cache'), ...archives]));
  const imports = packages.map(pkg => `await import(${JSON.stringify(pkg.name)});`).join('\n');
  const check = `${imports}
import { createDemo } from '@conduitcad/symbols';
import { parseDXF, writeDXF } from '@conduitcad/dxf';
const original = createDemo('pid');
const imported = parseDXF(writeDXF(original));
if (!original.entities.length || imported.entities.length !== original.entities.length) throw new Error('Consumer DXF integration failed.');
console.log(JSON.stringify({ entities: imported.entities.length }));`;
  const result = JSON.parse(run(process.execPath, ['--input-type=module', '-e', check]));
  const report = { packages: packages.map(pkg => ({ name: pkg.name, version: pkg.version })), registryAccess: false, emptyCache: true, importedAllPackages: true, ...result };
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  await writeFile(path.join(root, 'artifacts/package-consumer.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await rm(consumer, { recursive: true, force: true });
}
