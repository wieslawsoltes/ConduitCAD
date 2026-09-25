import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDocument, clone, entityGeometry, ports } from '@conduitcad/model';
import { SYMBOLS, CATEGORIES, STANDARD_REFERENCES, DRAWING_TYPES, LINE_STYLES, searchSymbols, auditSymbols, auditSymbol, installSymbols, insertSymbol, createDrawing, symbolUpdates, updateSymbolDefinitions } from '@conduitcad/symbols';
import { parseDXF, writeDXF } from '@conduitcad/dxf';
import { History } from '@conduitcad/history';
import { distance } from '@conduitcad/geometry';
import { symbolSVG } from '@conduitcad/workbench';
const legacy = JSON.parse(await readFile(new URL('./fixtures/symbols-v020.json', import.meta.url), 'utf8'));
const get = id => { const master = SYMBOLS.find(s => s.id === id); assert.ok(master, id); return master; };

test('223 masters are audited with explicit standard provenance and distinct family categories', () => {
    const report = auditSymbols(); assert.equal(report.length, 223); assert.equal(CATEGORIES.length, 11);
    for (const r of report) assert.deepEqual(r.errors, [], r.id);
    for (const s of SYMBOLS) {
        assert.equal(s.symbol.geometryRevision, 3); assert.equal(s.symbol.normativeEntry, null);
        assert.equal(s.symbol.review.dimensionalConformance, 'not-verified');
        assert.ok(CATEGORIES.some(c => c.id === s.category), s.id);
        for (const ref of s.symbol.standardRefs) assert.ok(STANDARD_REFERENCES[ref], ref);
        assert.ok(s.ports.every(p => p.medium && p.role), s.id);
    }
});
test('all 64 legacy IDs, DXF block names and named terminals remain available', () => {
    assert.equal(legacy.length, 64);
    for (const old of legacy) { const s = get(old.id); assert.equal(s.block, old.block); for (const name of old.ports) assert.ok(s.ports.some(p => p.name === name), `${s.id}.${name}`); }
});
test('every original category grows and eight new categories have complete masters', () => {
    const counts = Object.fromEntries(CATEGORIES.map(c => [c.id, SYMBOLS.filter(s => s.category === c.id).length]));
    assert.deepEqual(counts, {'P&ID':45, Electrical:44, Flow:22, Instrumentation:17, Hydraulics:20, Pneumatics:19, HVAC:14, Water:12, Automation:12, Fire:8, Network:10});
});
test('search supports family, category, aliases and multiword matching without hidden ISO labels', () => {
    assert.ok(searchSymbols('ISO-1219-1').length >= 39);
    assert.ok(searchSymbols('resistor', {category:'Electrical'}).every(s => s.category === 'Electrical'));
    assert.ok(searchSymbols('transformer single').some(s => s.id === 'transformer'));
    assert.equal(searchSymbols('NOT-A-SYMBOL-xyz').length, 0);
    assert.equal(searchSymbols('', {limit:3}).length, 3);
    assert.equal(searchSymbols('', {category:'Fire', standard:'ISO-1219-1'}).length, 0);
    assert.throws(() => searchSymbols('',{limit:-1}), /limit/);
});
test('liquid pump triangles are filled; gas compressor triangles are open', () => {
    assert.ok(get('hyd-pump').entities.some(e => e.type === 'SOLID'));
    assert.ok(!get('pneu-compressor').entities.some(e => e.type === 'SOLID'));
    assert.ok(get('pneu-compressor').entities.some(e => e.type === 'LWPOLYLINE' && e.closed && e.points.length === 3));
});
test('flow document wave, inductor turns and vessel ends stay analytic in DXF', () => {
    const doc = installSymbols(createDocument());
    for (const id of ['document','inductor','vessel','database']) doc.entities.push(insertSymbol(doc,id,0,0));
    const roundtrip = parseDXF(writeDXF(doc));
    assert.ok(roundtrip.blocks[get('document').block].entities.some(e => e.type === 'SPLINE' && e.controlPoints.length === 4));
    assert.equal(roundtrip.blocks[get('inductor').block].entities.filter(e => e.type === 'ARC').length,4);
    assert.ok(roundtrip.blocks[get('database').block].entities.some(e => e.type === 'ELLIPSE'));
});
test('panel-location dashes survive the catalogue preview without dashing the instrument body', () => {
    const d = installSymbols(createDocument());
    const rear = d.blocks[get('pressure-rear').block], panel = d.blocks[get('pressure-panel').block];
    assert.match(symbolSVG(rear,d), /stroke-dasharray="4 3"/);
    assert.doesNotMatch(symbolSVG(panel,d), /stroke-dasharray/);
    const g = entityGeometry(insertSymbol(d,'pressure-rear',0,0),d);
    assert.equal(g.paths.filter(p=>p.dash.length).length,1);
});
test('filled symbol components inherit instance colour rather than encoding BYBLOCK as an invalid SVG colour', () => {
    const d = installSymbols(createDocument()), e = insertSymbol(d,'globe-valve',0,0,{color:'#bb2211'});
    const filled = entityGeometry(e,d).paths.filter(p=>p.fill);
    assert.ok(filled.length);assert.ok(filled.every(p=>p.fill==='#bb2211'));
});
test('install and insert never overwrite existing custom or saved catalogue definitions', () => {
    const doc = installSymbols(createDocument()), s=get('gate-valve'), block=doc.blocks[s.block];
    block.entities[0].a.x=-999; block.symbol.geometryRevision=1; const snapshot=JSON.stringify(block);
    installSymbols(doc);insertSymbol(doc,s.id,40,50);assert.equal(JSON.stringify(doc.blocks[s.block]),snapshot);
    assert.ok(symbolUpdates(doc).some(m=>m.id===s.id));
});
test('explicit master migration validates all terminals before mutating any master', () => {
    const d=installSymbols(createDocument()), b=d.blocks[get('pump').block];b.ports.push({name:'CUSTOM',x:0,y:0,dx:1,dy:0});
    const before=JSON.stringify(d.blocks);
    assert.throws(()=>updateSymbolDefinitions(d,['gate-valve','pump']),/CUSTOM/);assert.equal(JSON.stringify(d.blocks),before);
    assert.throws(()=>updateSymbolDefinitions(d,['does-not-exist']),/Unknown/);assert.equal(JSON.stringify(d.blocks),before);
});
test('explicit master migration supports one-step undo and preserves instance transforms and identity', () => {
    let d=installSymbols(createDocument());const s=get('gate-valve'), block=d.blocks[s.block];block.symbol.geometryRevision=1;block.entities[0].a.x=-99;
    d.entities.push(insertSymbol(d,s.id,17,28,{rotation:42,sx:2,sy:.5}));const before=clone(d);
    const h=new History({capture:()=>clone(d),restore:value=>d=value});
    h.run('Library migration',()=>updateSymbolDefinitions(d,[s.id]));assert.equal(d.blocks[s.block].symbol.geometryRevision,3);assert.deepEqual(d.entities,before.entities);
    h.undo();assert.deepEqual(d,before);h.redo();assert.equal(d.blocks[s.block].symbol.geometryRevision,3);
});
test('catalogue audit catches detached terminals and zero-length geometry', () => {
    const s=clone(get('gate-valve'));s.ports[0].x=-1000;s.entities[0].b=clone(s.entities[0].a);
    assert.ok(auditSymbol(s).errors.some(e=>e.includes('Detached')));assert.ok(auditSymbol(s).errors.some(e=>e.includes('Zero-length')));
});
test('all new category insertions create the correct category layer in a minimal imported document', () => {
    for (const c of CATEGORIES) {const d=createDocument();d.blocks={};const s=SYMBOLS.find(s=>s.category===c.id), e=insertSymbol(d,s.id,0,0);assert.equal(e.layer,c.layer);assert.ok(d.layers.some(l=>l.name===e.layer));assert.ok(d.blocks[e.block]);}
});
test('line style registry has unique identities and finite positive metrics', () => {
    assert.equal(LINE_STYLES.length,21);assert.equal(new Set(LINE_STYLES.map(s=>s.id)).size,21);
    for(const s of LINE_STYLES){assert.ok(s.width>0);assert.ok(s.dash.every(v=>v>=0&&Number.isFinite(v)));assert.match(s.color,/^#[0-9a-f]{6}$/i);}
});
for (const type of DRAWING_TYPES) test(`${type.id} starter: native blocks, attached connectors and independent identity survive DXF`, () => {
    const d=createDrawing(type.id), r=parseDXF(writeDXF(d));
    assert.equal(d.entities.length,r.entities.length);assert.ok(d.entities.filter(e=>e.type==='INSERT').length>=4);
    assert.equal(new Set(d.entities.map(e=>e.id)).size,d.entities.length);
    assert.ok(d.entities.some(e=>e.text?.includes('NOT FOR CONSTRUCTION')));
    for(const c of r.entities.filter(e=>e.connector)) {
        assert.equal(c.connector.status,'routed');
        for(const [end,point] of [['from',c.points[0]],['to',c.points.at(-1)]]){
            const reference=c.connector[end], e=r.entities.find(e=>e.id===reference.entityId), p=e&&ports(e,r).find(p=>p.name===reference.port);
            assert.ok(p, `${type.id}: ${end}`);assert.ok(distance(point,p)<1e-6, `${type.id}: detached route`);
        }
    }
});

test('all catalogue ellipses obey native DXF minor-to-major axis limits', () => {
    for (const s of SYMBOLS) for (const e of s.entities.filter(e=>e.type==='ELLIPSE')) assert.ok(e.ratio>0&&e.ratio<=1,`${s.id}: ratio ${e.ratio}`);
});
test('tall rupture-disc ellipse keeps its half-ellipse endpoints after axis normalization', () => {
    const e=get('rupture-disc').entities.find(e=>e.type==='ELLIPSE'), g=entityGeometry(e,createDocument()).paths[0];
    assert.ok(distance(g.points[0],{x:-10,y:-21})<1e-6);assert.ok(distance(g.points.at(-1),{x:-10,y:21})<1e-6);
});
test('preview bounds include heat/cool and fire-damper functional marks above the body', () => {
    const d=installSymbols(createDocument());
    for(const id of ['hvac-heating-coil','hvac-cooling-coil','hvac-fire-damper']){
        const s=get(id),svg=symbolSVG(d.blocks[s.block],d),view=svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
        assert.ok(view[1]<-43,id);assert.match(svg,/<text/);
    }
});
