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
import { createDocument, line } from '@conduitcad/model';
import { ParameterEditSession, PlanarEditSession, handles2 } from '@conduitcad/manipulation2d';
import { SpatialPathSession, measurePoints3, sectionFrame3 } from '@conduitcad/manipulation3d';
import { VisualEditSession, layoutHandles3 } from '@conduitcad/manipulation3d';
const original = createDemo('pid');
const imported = parseDXF(writeDXF(original));
if (!original.entities.length || imported.entities.length !== original.entities.length) throw new Error('Consumer DXF integration failed.');
const document = createDocument('Offline visual authoring');
document.parameters.Width = '120';
const session = new VisualEditSession(document, 'box');
session.set('width', 'Width');
session.dragValue('width', 15, 'Width', 120, 1);
const preview = session.evaluate();
if (document.entities.length || preview.entities.length !== 1 || session.value('width') !== 135) throw new Error('Isolated visual preview failed.');
const result = session.commit(document);
if (result.type !== 'MESH' || !String(result.feature3d.parameters.width).includes('Width')) throw new Error('Expression-preserving visual commit failed.');
const visualDXF = parseDXF(writeDXF(document));
if (!visualDXF.entities.some(e => e.type === 'MESH')) throw new Error('Visual consumer DXF interchange failed.');
const layout = layoutHandles3([{id:'width',x:100,y:100,hasLabel:true}],{width:390,height:600});
if (!layout[0].visible) throw new Error('Visual control layout failed.');
session.cancel();
const planar = createDocument('Offline planar authoring');planar.entities.push(line({x:0,y:0},{x:100,y:0}));planar.parameters.Width=100;const edit2=new PlanarEditSession(planar,[planar.entities[0].id]);edit2.set('length','Width*2');edit2.evaluate();if(planar.entities[0].b.x!==100||!handles2(edit2).length)throw new Error('Planar preview isolation failed');edit2.commit(planar);if(parseDXF(writeDXF(planar)).entities[0].b.x!==200)throw new Error('Planar native DXF edit failed');if(measurePoints3({x:0,y:0,z:0},{x:3,y:4,z:12}).distance!==13||sectionFrame3({x:0,y:0,z:2},10).offset!==5)throw new Error('Inspection math contract failed');
const live = createDocument('Offline live authoring');live.parameters={Rise:'30'};
const pathSession = new SpatialPathSession(live);pathSession.insert(0,{x:0,y:0,z:0});pathSession.insert(1,{x:0,y:0,z:'Rise'});pathSession.commit(live);
const params = new ParameterEditSession(live,{process:draft=>{const session=new SpatialPathSession(draft,{id:pathSession.id});session.commit(draft);}});
params.set(params.rows[0].id,{expression:'50'});if(params.evaluate().entities[0].points[1].z!==50||live.entities[0].points[1].z!==30)throw new Error('Offline parameter/path preview failed');params.commit(live);
if(parseDXF(writeDXF(live)).entities[0].points[1].z!==50)throw new Error('Offline spatial path DXF contract failed');
console.log(JSON.stringify({ liveParameters:true, spatialPath:true, planarSession:true, planarDXF:true, spatialInspection:true, entities: imported.entities.length, visualSession: true, visualDXF: true, visualHandleLayout: true }));`;
  const result = JSON.parse(run(process.execPath, ['--input-type=module', '-e', check]));
  const report = { packages: packages.map(pkg => ({ name: pkg.name, version: pkg.version })), registryAccess: false, emptyCache: true, importedAllPackages: true, ...result };
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  await writeFile(path.join(root, 'artifacts/package-consumer.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await rm(consumer, { recursive: true, force: true });
}
