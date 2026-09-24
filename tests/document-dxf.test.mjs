import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, entity, line, rect, circle, text, entityGeometry, entityBounds, documentBounds, ports, moveEntity, explodeEntity, resolveStyle, cleanText, validateDocument } from '@conduitcad/model';
import { createDemo, SYMBOLS, LINE_STYLES, insertSymbol, installSymbols } from '@conduitcad/symbols';
import { parseDXF, parseAsciiPairs, parseBinaryPairs, writeDXF, exportReport } from '@conduitcad/dxf';
import { buildScene, Camera, CULL_SHADER, LINE_SHADER } from '@conduitcad/renderer';
import { writeSVG, writeBOM } from '@conduitcad/exchange';
import { distance } from '@conduitcad/geometry';
const near = (a, b, t = 1e-5) => assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
const dxf = entities => '0\nSECTION\n2\nENTITIES\n' + entities + '0\nENDSEC\n0\nEOF\n';
test('all 64 symbol masters have finite geometry and valid named ports', () => {
    const d = installSymbols(createDocument());
    assert.equal(SYMBOLS.length, 64);
    assert.equal(LINE_STYLES.length, 10);
    assert.equal(new Set(SYMBOLS.map(s => s.id)).size, 64);
    for (const s of SYMBOLS) {
        const e = insertSymbol(d, s.id, 200, 300), g = entityGeometry(e, d);
        assert.ok(g.paths.length + g.texts.length > 0, s.id);
        for (const p of g.paths.flatMap(p => p.points))
            assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
        const ps = ports(e, d);
        assert.equal(new Set(ps.map(p => p.name)).size, ps.length, s.id);
    }
});
test('native block transform and port direction use base point, scale and rotation', () => { const d = createDocument(); d.blocks.B = { name: 'B', base: { x: 5, y: 5 }, entities: [line({ x: 5, y: 5 }, { x: 15, y: 5 })], ports: [{ id: 'out', x: 15, y: 5, dx: 1, dy: 0 }] }; const e = entity('INSERT', { block: 'B', x: 100, y: 200, sx: 2, sy: 3, rotation: 90 }), g = entityGeometry(e, d), p = ports(e, d)[0]; near(g.paths[0].points[0].x, 100); near(g.paths[0].points[1].y, 220); near(p.x, 100); near(p.y, 220); near(p.dx, 0); near(p.dy, 2); });
test('moving insert keeps imported attributes in world coordinates', () => { const e = entity('INSERT', { x: 10, y: 20, attributes: [entity('ATTRIB', { p: { x: 12, y: 24 }, text: 'TAG' })] }); moveEntity(e, 5, -3); assert.deepEqual(e.attributes[0].p, { x: 17, y: 21 }); assert.equal(e.x, 15); });
test('layer, by-layer and by-block dash inheritance', () => { const d = createDocument(); d.layers[0].linetype = 'DASHED'; assert.deepEqual(resolveStyle({ layer: '0', linetype: 'BYLAYER' }, d).dash, [8, 4]); assert.deepEqual(resolveStyle({ layer: '0', linetype: 'BYBLOCK' }, d, { dash: [1, 2], color: '#123456' }).dash, [1, 2]); });
test('recursive blocks terminate at explicit recursion budget', () => { const d = createDocument(); d.blocks.R = { entities: [entity('INSERT', { block: 'R', x: 0, y: 0 })] }; assert.deepEqual(entityGeometry(entity('INSERT', { block: 'R', x: 0, y: 0 }), d), { paths: [], texts: [] }); });
test('text cleanup handles Unicode, paragraphs and formatting without HTML execution', () => { assert.equal(cleanText('{\\C1;P\\U+00B0\\P%%c25}'), 'P°\n⌀25'); const d = createDocument('<img onerror=x>'); d.entities.push(text({ x: 0, y: 0 }, '<script>alert(1)</script>', 12)); const svg = writeSVG(d); assert.ok(svg.includes('&lt;script&gt;')); assert.ok(!svg.includes('<script>')); });
for (const kind of ['pid', 'electrical', 'flow'])
    test(`${kind} DXF round trip preserves identity, ports, tags, connector graph and parameter metadata`, () => {
        const d = createDemo(kind), src = writeDXF(d), r = parseDXF(src);
        assert.equal(r.entities.length, d.entities.length);
        assert.deepEqual(r.entities.map(e => e.id), d.entities.map(e => e.id));
        assert.deepEqual(r.parameters, d.parameters);
        for (const e of d.entities.filter(e => e.connector)) {
            const q = r.entities.find(q => q.id === e.id);
            assert.deepEqual(q.connector, e.connector);
            for (const end of ['from', 'to'])
                if (q.connector[end])
                    assert.ok(r.entities.some(n => n.id === q.connector[end].entityId));
        }
        for (const e of r.entities.filter(e => e.type === 'INSERT')) {
            assert.equal(e.attributes.length, 0);
            assert.ok(ports(e, r).length > 0);
        }
        const rr = parseDXF(writeDXF(r));
        assert.equal(rr.entities.length, r.entities.length);
        for (const e of rr.entities.filter(e => e.type === 'INSERT'))
            assert.equal(e.attributes.length, 0);
    });
for (const version of ['AC1015', 'AC1018', 'AC1021', 'AC1024', 'AC1027', 'AC1032'])
    test(`DXF writer ${version}`, () => { const d = createDocument(); d.entities.push(line({ x: 1e8 + .25, y: -2 }, { x: 1e8 + 10.25, y: 18 })); const r = parseDXF(writeDXF(d, { version })); assert.equal(r.importVersion, version); near(r.entities[0].a.x, 1e8 + .25); });
test('bulges, splines, ellipses and text retain numeric data in normalized round trip', () => { const d = createDocument(); d.entities.push(entity('LWPOLYLINE', { points: [{ x: 0, y: 0, bulge: 1 }, { x: 20, y: 0 }], closed: true }), entity('SPLINE', { degree: 2, controlPoints: [{ x: 0, y: 0 }, { x: 30, y: 40 }, { x: 60, y: 0 }], knots: [0, 0, 0, 1, 1, 1], weights: [1, .7, 1] }), entity('ELLIPSE', { c: { x: 20, y: 40 }, major: { x: 30, y: 10 }, ratio: .5, start: .2, end: 5 }), text({ x: 0, y: 80 }, 'ΔP · ⌀ 10', 12)); const r = parseDXF(writeDXF(d)); assert.equal(r.entities[0].points[0].bulge, 1); assert.deepEqual(r.entities[1].weights, [1, .7, 1]); near(r.entities[2].ratio, .5); assert.equal(r.entities[3].text, 'ΔP · ⌀ 10'); assert.ok(buildScene(r).count > 40); });
test('legacy R2000 Unicode escapes render correctly', () => { const d = createDocument(); d.entities.push(text({ x: 0, y: 0 }, '温度 ΔP', 12)); const src = writeDXF(d, { version: 'AC1015' }); assert.ok(!src.includes('温')); assert.equal(entityGeometry(parseDXF(src).entities[0], d).texts[0].text, '温度 ΔP'); });
test('original ASCII byte preservation includes code page bytes and line endings', () => { const src = dxf('0\nTEXT\n10\n0\n20\n0\n40\n10\n1\ncafé\n').replaceAll('\n', '\r\n'), bytes = Uint8Array.from(src, c => c.charCodeAt(0)), r = parseDXF(bytes, { encoding: 'windows-1252' }); assert.equal(r.entities[0].text, 'café'); assert.deepEqual(new Uint8Array(Buffer.from(r.source.base64, 'base64')), bytes); });
test('unsupported DXF entity and opaque sections are retained and export is transparent', () => { const src = dxf('0\n3DSOLID\n5\nAB\n8\n0\n1\nopaque ACIS\n'), r = parseDXF(src), report = exportReport(r); assert.equal(r.entities[0].unsupported, true); assert.equal(r.source.text, src); assert.equal(report.unsupported.length, 1); assert.ok(report.warnings.some(x => x.includes('omitted'))); assert.equal(parseDXF(writeDXF(r)).entities.length, 0); });
test('non-default OCS projects an edge-on circle to the top view', () => { const r = parseDXF(dxf('0\nCIRCLE\n10\n0\n20\n0\n40\n4\n210\n0\n220\n1\n230\n0\n')); const g=entityGeometry(r.entities[0],r); assert.ok(g.paths[0].points.every(p=>Math.abs(p.y)<1e-8)); assert.deepEqual(parseDXF(writeDXF(r)).entities[0].extrusion,{x:0,y:1,z:0}); });
test('old POLYLINE VERTEX and SEQEND import as one path', () => { const r = parseDXF(dxf('0\nPOLYLINE\n70\n1\n0\nVERTEX\n10\n0\n20\n0\n42\n1\n0\nVERTEX\n10\n20\n20\n0\n0\nSEQEND\n')); assert.equal(r.entities.length, 1); assert.equal(r.entities[0].points.length, 2); assert.equal(r.entities[0].closed, true); });
test('native HATCH export retains loops and pattern definitions', () => { const d=createDocument(); d.entities.push(entity('HATCH',{solid:false,pattern:'USER',loops:[{points:[{x:0,y:0},{x:10,y:0},{x:0,y:10}],closed:true}],patternLines:[{angle:0,base:{x:0,y:0},offset:{x:0,y:2},dashes:[]}]})); const r=parseDXF(writeDXF(d)); assert.equal(r.entities[0].type,'HATCH'); assert.equal(r.entities[0].patternLines.length,1); assert.ok(entityGeometry(r.entities[0],r).paths.length>1); });
test('authored dimension exports visible geometry with warning', () => { const d = createDocument(); d.entities.push(entity('DIMENSION', { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, offset: 20 })); assert.ok(exportReport(d).warnings.some(x => x.includes('dimensions'))); const r = parseDXF(writeDXF(d)); assert.ok(r.entities.some(e => e.type === 'TEXT')); assert.ok(r.entities.length > 3); });
test('malformed or truncated ASCII DXF is rejected', () => {
    for (const src of ['not dxf', '0\nLINE\n10\nNaN\n0\nEOF\n', '-1\nTEST\n0\nEOF\n'])
        assert.throws(() => parseDXF(src));
    assert.throws(() => parseAsciiPairs('0\nEOF\n', { maxPairs: 0 }), /limit/);
});
function binaryPairs(pairs, r12 = false) {
    const out = [...Buffer.from('AutoCAD Binary DXF\r\n\x1a\0', 'binary')];
    for (const [code, value] of pairs) {
        if (r12) {
            if (code < 255)
                out.push(code);
            else
                out.push(255, code & 255, code >> 8);
        }
        else
            out.push(code & 255, code >> 8);
        if (code >= 10 && code <= 59) {
            const b = Buffer.alloc(8);
            b.writeDoubleLE(value);
            out.push(...b);
        }
        else if (code >= 60 && code <= 79) {
            const b = Buffer.alloc(2);
            b.writeInt16LE(value);
            out.push(...b);
        }
        else
            out.push(...Buffer.from(String(value), 'latin1'), 0);
    }
    return new Uint8Array(out);
}
for (const r12 of [false, true])
    test(`binary DXF ${r12 ? 'R12 byte codes' : 'modern word codes'} imports and preserves exact source`, () => { const ps = [[0, 'SECTION'], [2, 'ENTITIES'], [0, 'LINE'], [8, '0'], [10, 1], [20, 2], [11, 8], [21, 9], [0, 'ENDSEC'], [0, 'EOF']], data = binaryPairs(ps, r12); assert.deepEqual(parseBinaryPairs(data), ps); const d = parseDXF(data); assert.equal(d.entities[0].type, 'LINE'); near(d.entities[0].a.x, 1); assert.deepEqual(new Uint8Array(Buffer.from(d.source.base64, 'base64')), data); assert.throws(() => parseBinaryPairs(data.subarray(0, data.length - 3)), /Truncated|EOF/); });
test('scene compiles with Float64 source and rebased Float32 uploads', () => { const d = createDocument(), l = line({ x: 1e10 + .25, y: 1e10 }, { x: 1e10 + 100.25, y: 1e10 }); d.entities.push(l); const s = buildScene(d); assert.equal(s.count, 1); assert.ok(s.data instanceof Float32Array); near(s.data[0], -50); near(s.data[2], 50); near(l.a.x, 1e10 + .25); assert.ok(s.index.search(entityBounds(l, d)).length === 1); });
test('hidden layers and layouts do not compile', () => { const d = createDocument(); d.entities.push(line({ x: 0, y: 0 }, { x: 1, y: 1 }, { layer: 'Instruments' }), line({ x: 0, y: 0 }, { x: 1, y: 1 }, { layout: 'Paper' })); d.layers.find(l => l.name === 'Instruments').visible = false; assert.equal(buildScene(d).count, 0); });
test('camera zoom anchors and inverse transforms are exact', () => { const c = new Camera(), p = { x: 131, y: 82 }, before = c.world(p); c.zoom(3.2, p); near(distance(before, c.world(p)), 0); near(distance(c.screen(c.world(p)), p), 0); const data = buildScene(createDemo()); c.fit(data.bounds); assert.ok(Number.isFinite(c.scale) && c.scale > 0); });
test('WebGPU sources contain compute culling and instanced stroke entry points', () => { assert.match(CULL_SHADER, /@compute/); assert.match(CULL_SHADER, /atomicAdd/); assert.match(LINE_SHADER, /@vertex/); assert.match(LINE_SHADER, /@fragment/); });
test('BOM emits quoted tag and coordinate records', () => { const d = createDemo(); const csv = writeBOM(d); assert.ok(csv.startsWith('"Tag","Block"')); assert.equal(csv.split('\r\n').length, d.entities.filter(e => e.type === 'INSERT').length + 1); });
test('symbol installs are isolated between documents and factory masters', () => { const a = installSymbols(createDocument()), b = installSymbols(createDocument()), name = SYMBOLS[0].block; a.blocks[name].ports[0].x = 999; assert.notEqual(b.blocks[name].ports[0].x, 999); assert.notEqual(SYMBOLS[0].ports[0].x, 999); });
test('DXF preserves int64 group values as decimal strings', () => { const pairs = parseAsciiPairs('160\n9223372036854775807\n0\nEOF\n'); assert.equal(pairs[0][1], '9223372036854775807'); });
test('ACI import retains standard red, cyan and green rather than theme substitutions', () => {
    for (const [index, color] of [[1, '#ff0000'], [3, '#00ff00'], [4, '#00ffff']]) {
        const r = parseDXF(dxf(`0\nLINE\n62\n${index}\n10\n0\n20\n0\n11\n10\n21\n0\n`));
        assert.equal(r.entities[0].color, color);
    }
});
test('MINSERT grid spacing rotates but is not scaled with block geometry', () => {
    const d = createDocument();
    d.blocks.B = { name: 'B', base: { x: 5, y: 3 }, entities: [line({ x: 5, y: 3 }, { x: 15, y: 3 })] };
    const e = entity('INSERT', { block: 'B', x: 100, y: 200, sx: 2, sy: 3, rotation: 90, rows: 2, columns: 2, rowSpacing: 30, columnSpacing: 50 });
    const g = entityGeometry(e, d);
    assert.equal(g.paths.length, 4);
    const starts = [[100, 200], [100, 250], [70, 200], [70, 250]];
    g.paths.forEach((p, i) => { near(p.points[0].x, starts[i][0]); near(p.points[0].y, starts[i][1]); near(distance(p.points[0], p.points[1]), 20); });
});
test('MINSERT attributes repeat at rotated unscaled grid offsets', () => {
    const d = createDocument();
    d.blocks.B = { name: 'B', entities: [line({ x: 0, y: 0 }, { x: 10, y: 0 })] };
    const e = entity('INSERT', { block: 'B', x: 0, y: 0, sx: 2, sy: 2, rotation: 90, columns: 2, columnSpacing: 50, attributes: [entity('ATTRIB', { p: { x: 10, y: 20 }, text: 'A1', height: 5 })] });
    const g = entityGeometry(e, d);
    assert.equal(g.texts.length, 2);
    near(g.texts[0].p.x, 10);
    near(g.texts[0].p.y, 20);
    near(g.texts[1].p.x, 10);
    near(g.texts[1].p.y, 70);
});
test('MINSERT zero spacing does not emit duplicate occurrences', () => {
    const d = createDocument();
    d.blocks.B = { name: 'B', entities: [line({ x: 0, y: 0 }, { x: 10, y: 0 })] };
    const e = entity('INSERT', { block: 'B', x: 0, y: 0, rows: 4, columns: 3, rowSpacing: 0, columnSpacing: 20 });
    assert.equal(entityGeometry(e, d).paths.length, 3);
});
