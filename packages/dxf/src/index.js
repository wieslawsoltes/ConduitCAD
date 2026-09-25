import { dimensionPicture, evaluateDynamicBlock } from '@conduitcad/model';
import { readAsciiTags, readBinaryTags, writeBinaryTags, splitSections, decodeCodePage, decodeTextEscapes } from './codec.js';
import { readInteropEntity, writeInteropEntity, readDocumentInterop, graphicalTags, readDimensionOverrides, writeDimensionOverrides } from './interop.js';
import { completeDXFStructure } from './structure.js';
import { capturePreservation, writePreservedDXF, inspectDXFGraph } from './preservation.js';
import { readEntityFidelity, writeHatchData } from './fidelity.js';
import { createDocument, entity, uid, cleanText, clone, entityGeometry } from '@conduitcad/model';
import { TAU, arcPoints } from '@conduitcad/geometry';
// Default ACI modelspace palette, verified against ezdxf 1.4.4.
// ACI 7 follows this application's light canvas. Palette data attribution: THIRD_PARTY_NOTICES.md.
const ACI_PALETTE = [0, 16711680, 16776960, 65280, 65535, 255, 16711935, 16777215, 8421504, 12632256, 16711680, 16744319, 10813440, 10834514, 8323072, 8339263, 4980736, 4990502, 2490368, 2495251, 16727808, 16752511, 10823936, 10839890, 8331008, 8343359, 4985600, 4992806, 2492672, 2496275, 16744192, 16760703, 10834432, 10845266, 8339200, 8347455, 4990464, 4995366, 2495232, 2497555, 16760576, 16768895, 10845184, 10850642, 8347392, 8351551, 4995328, 4997670, 2497536, 2498835, 16776960, 16777087, 10855680, 10855762, 8355584, 8355647, 5000192, 5000230, 2500096, 2500115, 12582656, 14679935, 8168704, 9545042, 6258432, 7307071, 3755008, 4344870, 1844736, 2172435, 8388352, 12582783, 5416192, 8168786, 4161280, 6258495, 2509824, 3755046, 1254912, 1844755, 4194048, 10485631, 2729216, 6792530, 2064128, 5209919, 1264640, 3099686, 599552, 1517075, 65280, 8388479, 42240, 5416274, 32512, 4161343, 19456, 2509862, 9728, 1254931, 65343, 8388511, 42281, 5416295, 32543, 4161359, 19475, 2509871, 9737, 1267735, 65407, 8388543, 42322, 5416316, 32575, 4161375, 19494, 2509881, 9747, 1267740, 65471, 8388575, 42364, 5416337, 32607, 4161391, 19513, 2509890, 9756, 1267800, 65535, 8388607, 42405, 5416357, 32639, 4161407, 19532, 2509900, 9766, 1267800, 49151, 8380415, 31909, 5411237, 24447, 4157311, 14668, 2507390, 7206, 1267800, 32767, 8372223, 21157, 5405861, 16255, 4153215, 9804, 2505086, 4902, 1252440, 16383, 8364031, 10661, 5400485, 8063, 4149119, 4940, 2502526, 2342, 1251160, 255, 8355839, 165, 5395109, 127, 4145023, 76, 2500222, 38, 1250136, 4129023, 10452991, 2687141, 6771365, 2031743, 5193599, 1245260, 3090046, 589862, 1512280, 8323327, 12550143, 5374117, 8147621, 4128895, 6242175, 2490444, 3745406, 1245222, 1839960, 12517631, 14647295, 8126629, 9523877, 6226047, 7290751, 3735628, 4335180, 1835046, 5772120, 16711935, 16744447, 10813605, 10834597, 8323199, 8339327, 4980812, 4990540, 2490406, 5772120, 16711871, 16744415, 10813564, 10834577, 8323167, 8339311, 4980793, 4990530, 2490396, 5772120, 16711807, 16744383, 10813522, 10834556, 8323135, 8339295, 4980774, 4990521, 2490387, 5772060, 16711743, 16744351, 10813481, 10834535, 8323103, 8339279, 4980755, 4990511, 2490377, 5772055, 0, 6645093, 6710886, 10066329, 13421772, 16777215];
export function aciColor(index) {
    index = Math.abs(Math.trunc(index));
    if (index === 7)
        return '#000000';
    return '#' + (ACI_PALETTE[index] ?? 0).toString(16).padStart(6, '0');
}
export function parseAsciiPairs(source, options = {}) { return readAsciiTags(source, options); }
export function parseBinaryPairs(input, options = {}) { return readBinaryTags(input, options); }
export function inspectObjectGraph(doc) { return inspectDXFGraph(doc); }
export function writeDXFBinary(doc, options = {}) {
    const version=options.version || (options.mode==='preserve' ? doc.importVersion : 'AC1024');
    return writeBinaryTags(readAsciiTags(writeDXF(doc,{...options,version})),{version});
}
const get = (r, c, d = undefined) => decodeTextEscapes(r.find(x => x[0] === c)?.[1] ?? d);
const all = (r, c) => r.filter(x => x[0] === c).map(x => x[1]);
const pt = (r, c = 10) => ({ x: Number(get(r, c, 0)), y: Number(get(r, c + 10, 0)), z: Number(get(r, c + 20, 0)) });
const points = (r, c = 10) => {
    const p = [];
    let current;
    for (const [code, v] of r) {
        if (code === c) {
            current = { x: Number(v), y: 0 };
            p.push(current);
        }
        else if (current && code === c + 10)
            current.y = Number(v);
        else if (current && code === c + 20)
            current.z = Number(v);
        else if (current && code === 42 && c === 10)
            current.bulge = Number(v);
    }
    return p;
};
const records = pairs => {
    const result = [];
    let r = [];
    for (const pair of pairs) {
        if (pair[0] === 0 && r.length) {
            result.push(r);
            r = [];
        }
        r.push(pair);
    }
    if (r.length)
        result.push(r);
    return result;
};
function metadata(raw) {
    let active = false, s = '';
    for (const [c, v] of raw) {
        if (c === 1001)
            active = v === 'CONDUITCAD';
        else if (active && c === 1000)
            s += v;
    }
    if (!s)
        return {};
    try {
        const data = JSON.parse(s);
        return data && typeof data === 'object' ? data : {};
    }
    catch {
        return {};
    }
}
function parseEntity(original, diagnostics, options = {}) {
    const raw = graphicalTags(original);
    const type = String(get(raw, 0, 'UNKNOWN')).trim(), e = { id: get(raw, 5) ? 'dxf-' + get(raw, 5) : uid(), type, layer: String(get(raw, 8, '0')).trim(), layout: get(raw, 410, get(raw, 67, 0) ? 'Layout1' : 'Model'), _dxf: { raw: original, handle: get(raw, 5) }, dirty: false };
    const aci = Number(get(raw, 62, 256)), trueColor = get(raw, 420);
    e.colorIndex = aci; e.colorMode = trueColor === undefined ? 'aci' : 'truecolor';
    if (trueColor !== undefined)
        e.color = '#' + Number(trueColor).toString(16).padStart(6, '0');
    else if (aci === 0)
        e.color = 'BYBLOCK';
    else if (aci !== 256)
        e.color = aciColor(aci);
    e.lineweight = Number(get(raw, 370, -1));
    e.linetype = get(raw, 6, 'BYLAYER');
    if (get(raw, 60, 0) || aci < 0)
        e.hidden = true;
    switch (type) {
        case 'LINE':
            e.a = pt(raw);
            e.b = pt(raw, 11);
            break;
        case 'LWPOLYLINE':
            e.points = points(raw);
            e.closed = !!(get(raw, 70, 0) & 1);
            e.constantWidth = get(raw, 43, 0);
            break;
        case 'POLYLINE':
            e.points = [];
            e.closed = !!(get(raw, 70, 0) & 1);
            e.flags = get(raw, 70, 0); e.mCount = +get(raw,71,0); e.nCount = +get(raw,72,0);
            break;
        case 'CIRCLE':
        case 'ARC':
            e.c = pt(raw);
            e.r = Number(get(raw, 40, 1));
            if (type === 'ARC') {
                e.start = Number(get(raw, 50, 0)) * Math.PI / 180;
                e.end = Number(get(raw, 51, 360)) * Math.PI / 180;
            }
            break;
        case 'ELLIPSE':
            e.c = pt(raw);
            e.major = pt(raw, 11);
            e.ratio = Number(get(raw, 40, 1));
            e.start = Number(get(raw, 41, 0));
            e.end = Number(get(raw, 42, TAU));
            break;
        case 'SPLINE':
            e.degree = Number(get(raw, 71, 3));
            e.controlPoints = points(raw);
            e.fitPoints = points(raw, 11);
            e.knots = all(raw, 40).map(Number);
            e.weights = all(raw, 41).map(Number);
            e.closed = !!(get(raw, 70, 0) & 1);
            break;
        case 'POINT':
            e.p = pt(raw);
            break;
        case 'TEXT':
        case 'MTEXT':
        case 'ATTRIB':
        case 'ATTDEF':
            e.p = pt(raw);
            e.text = type === 'MTEXT' ? decodeTextEscapes(all(raw, 3).join('') + (raw.find(p=>p[0]===1)?.[1] ?? '')) : get(raw, 1, '');
            e.height = Number(get(raw, 40, 12));
            e.rotation = Number(get(raw, 50, 0));
            e.align = get(raw, 72, 0) === 1 ? 'center' : get(raw, 72, 0) === 2 ? 'right' : 'left';
            if (type === 'MTEXT') {
                const a = Number(get(raw, 71, 1));
                e.align = [2, 5, 8].includes(a) ? 'center' : [3, 6, 9].includes(a) ? 'right' : 'left';
                if (get(raw, 11) !== undefined)
                    e.rotation = Math.atan2(get(raw, 21, 0), get(raw, 11, 1)) * 180 / Math.PI;
                e.mtextWidth = get(raw, 41, 0);
            }
            if (['ATTRIB', 'ATTDEF'].includes(type)) {
                e.attributeTag = get(raw, 2, '');
                e.invisible = !!(get(raw, 70, 0) & 1);
            }
            e.widthFactor = Number(get(raw, 41, 1));
            break;
        case 'INSERT':
            e.block = get(raw, 2, '');
            e.x = get(raw, 10, 0);
            e.y = get(raw, 20, 0);
            e.z = get(raw, 30, 0);
            e.sx = get(raw, 41, 1);
            e.sy = get(raw, 42, 1);
            e.sz = get(raw, 43, 1);
            e.rotation = get(raw, 50, 0);
            e.columns = get(raw, 70, 1);
            e.rows = get(raw, 71, 1);
            e.columnSpacing = get(raw, 44, 0);
            e.rowSpacing = get(raw, 45, 0);
            e.attributes = [];
            break;
        case 'SOLID':
        case 'TRACE':
        case '3DFACE':
            e.points = [pt(raw, 10), pt(raw, 11), pt(raw, 13), pt(raw, 12)];
            break;
        case 'HATCH':
            e.loops = [];
            e.solid = !!get(raw, 70, 0);
            e.pattern = get(raw, 2, 'SOLID');
            break;
        case 'DIMENSION':
            e.block = get(raw, 2);
            e.a = pt(raw, 13);
            e.b = pt(raw, 14);
            e.text = get(raw, 1, '<>');
            break;
        case 'VERTEX':
            e.p = pt(raw);
            e.p.bulge = get(raw, 42, 0);
            e.p.startWidth = get(raw, 40, 0); e.p.endWidth = get(raw, 41, 0);
            e.vertexFlags=+get(raw,70,0); e.faceIndices=[71,72,73,74].map(c=>+get(raw,c,0)).filter(Boolean);
            break;
        case 'LEADER':
        case 'RAY':
        case 'XLINE':
        case 'SEQEND':
        case 'VIEWPORT':
        case 'WIPEOUT':
        case 'MESH':
        case 'HELIX': break;
        default:
            e.unsupported = true;
            diagnostics.push({ severity: 'warning', type, message: `${type}: retained in original source; no editable display implementation.` });
    }
    readInteropEntity(e, raw);
    if(type==='DIMENSION')e.dimstyleOverrides=readDimensionOverrides(original);
    const meta = metadata(original);
    if (typeof meta.id === 'string' && meta.id.length <= 160)
        e.id = meta.id;
    for (const k of ['connector', 'tag', 'label', 'dash', 'width', 'parametric', 'ports', 'fill', 'locked', 'dimension', 'dynamicParameters', 'dynamicSource'])
        if (k in meta)
            e[k] = meta[k];
    readEntityFidelity(e, raw, diagnostics, options);
    if(type === 'MTEXT') {
        const pos=raw.findIndex(p=>p[0]===100&&p[1]==='AcDbMText');
        if(pos>=0) { const common=raw.slice(0,pos), value=get(common,420), index=+get(common,62,256);
            e.colorMode = value===undefined ? 'aci' : 'truecolor';
            if(value!==undefined)e.color='#'+(+value&0xffffff).toString(16).padStart(6,'0');
            else if(index===256)delete e.color; else e.color=index===0?'BYBLOCK':aciColor(index);
        }
    }
    return e;
}
function base64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 8192)
        s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return typeof btoa === 'function' ? btoa(s) : Buffer.from(bytes).toString('base64');
}
export function parseDXF(input, options = {}) {
    let rawText = '', pairs, source;
    const bytes = typeof input === 'string' ? null : input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes && bytes.byteLength > 128 * 1024 * 1024)
        throw new Error('File exceeds the 128 MiB import safety limit');
    const binary = bytes && new TextDecoder().decode(bytes.subarray(0, 18)) === 'AutoCAD Binary DXF';
    if (binary) {
        pairs = parseBinaryPairs(bytes, options);
        source = { format: 'binary', base64: base64(bytes) };
    }
    else {
        if (bytes) {
            let enc = options.encoding;
            const prefix = new TextDecoder('windows-1252').decode(bytes.subarray(0, 65536));
            if (!enc) {
                const ver = prefix.match(/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(AC\d+)/)?.[1];
                const cp = prefix.match(/ANSI_(\d+)/)?.[1];
                enc = ver && Number(ver.slice(2)) >= 1021 ? 'utf-8' : decodeCodePage('ANSI_' + (cp || '1252'));
            }
            rawText = new TextDecoder(enc, {fatal:true}).decode(bytes);
            source = {format:'ascii',base64:base64(bytes),encoding:enc};
        }
        else
            rawText = String(input);
        pairs = parseAsciiPairs(rawText, options);
        source = bytes ? source : { format: 'ascii', text: rawText };
    }
    const doc = createDocument(options.name || 'Imported DXF');
    doc.blocks = Object.create(null); doc.layers = []; doc.textStyles = Object.create(null); doc.linetypes = Object.assign(Object.create(null), { CONTINUOUS: [] }); doc.signedLinetypes = true;
    doc.source = source;
    doc.rawSections = Object.create(null);
    doc.importDiagnostics = [];
    const sections = splitSections(pairs);
    if (!sections.ENTITIES && !sections.BLOCKS)
        throw new Error('DXF contains neither ENTITIES nor BLOCKS sections');
    const header = sections.HEADER || [];
    let key = '';
    for (const [c, v] of header) {
        if (c === 9)
            key = String(v);
        else if (key === '$INSUNITS' && c === 70)
            doc.units = ({ 0: 'unitless', 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm' })[v] || 'unitless';
        else if (key === '$LTSCALE' && c === 40) doc.linetypeScale = v;
        else if (key === '$ACADVER')
            doc.importVersion = v;
    }
    let table = '';
    for (const r of records(sections.TABLES || [])) {
        const t = get(r, 0);
        if (t === 'TABLE')
            table = get(r, 2);
        else if (t === 'ENDTAB')
            table = '';
        else if (table === 'LAYER' && t === 'LAYER') {
            const n = get(r, 2, '0'), aci = Number(get(r, 62, 7));
            doc.layers.push({ name: n, colorIndex:Math.abs(aci), colorMode:get(r,420)===undefined?'aci':'truecolor', color: get(r, 420) !== undefined ? '#' + Number(get(r, 420)).toString(16).padStart(6, '0') : aciColor(Math.abs(aci)), visible: aci >= 0 && !(get(r, 70, 0) & 1), locked: !!(get(r, 70, 0) & 4), linetype: get(r, 6, 'CONTINUOUS'), lineweight: +get(r, 370, -3) });
        }
        else if (table === 'LTYPE' && t === 'LTYPE')
            doc.linetypes[get(r, 2, 'CONTINUOUS')] = all(r, 49).map(Number);
        else if (table === 'STYLE' && t === 'STYLE')
            doc.textStyles[get(r, 2, 'STANDARD')] = { font: get(r, 3, 'sans-serif'), bigFont: get(r, 4, ''), height: +get(r, 40, 0), widthFactor: +get(r, 41, 1), oblique: +get(r, 50, 0), flags: +get(r, 71, 0) };
    }
    if (!doc.layers.length)
        doc.layers.push({ name: '0', color: '#344755', visible: true, locked: false });
    const parseList = rs => {
        const es = [];
        let poly = null, insert = null;
        for (const raw of rs) {
            const e = parseEntity(raw, doc.importDiagnostics, options);
            if (e.type === 'VERTEX' && poly) {
                if ((poly.flags & 64) && e.faceIndices.length) { poly.faces ??= []; poly.faces.push(e.faceIndices); }
                else poly.points.push(e.p);
                continue;
            }
            if (e.type === 'ATTRIB' && insert) {
                insert.attributes.push(e);
                continue;
            }
            if (e.type === 'SEQEND') {
                poly = null;
                insert = null;
                continue;
            }
            poly = e.type === 'POLYLINE' ? e : null;
            insert = e.type === 'INSERT' ? e : null;
            es.push(e);
        }
        for (const e of es)
            if (e.type === 'INSERT' && e.tag)
                e.attributes = e.attributes.filter(a => !(a.attributeTag === 'TAG' && a.text === e.tag));
        return es;
    };
    let block = null, blockRecords = [];
    for (const raw of records(sections.BLOCKS || [])) {
        const t = get(raw, 0);
        if (t === 'BLOCK') {
            block = { name: get(raw, 2, ''), base: pt(raw), entities: [], flags: +get(raw,70,0), ports: metadata(raw).ports || [], symbol: metadata(raw).symbol, dynamic: metadata(raw).dynamic, dynamicInstance: metadata(raw).dynamicInstance, dimensionPicture: metadata(raw).dimensionPicture };
            blockRecords = [];
        }
        else if (t === 'ENDBLK') {
            if (block) {
                block.entities = parseList(blockRecords);
                doc.blocks[block.name] = block;
            }
            block = null;
        }
        else if (block)
            blockRecords.push(raw);
    }
    doc.entities = parseList(records(sections.ENTITIES || []));
    const seen = new Set();
    for (const e of doc.entities) {
        if (seen.has(e.id))
            e.id = uid();
        seen.add(e.id);
        if (!doc.layers.some(l => l.name.toUpperCase() === e.layer.toUpperCase()))
            doc.layers.push({ name: e.layer, color: '#344755', visible: true, locked: false });
        if (!doc.layouts.includes(e.layout))
            doc.layouts.push(e.layout);
    }
    const metaComments = all(header, 999).filter(s => String(s).startsWith('CONDUIT:')).map(s => String(s).slice(8)).join('');
    if (metaComments) {
        try {
            const m = JSON.parse(metaComments);
            doc.parameters = m.parameters || doc.parameters;
            doc.constraints = m.constraints || [];
            doc.metadata = m.metadata || doc.metadata;
        }
        catch {
            doc.importDiagnostics.push({ severity: 'warning', message: 'Conduit header metadata could not be decoded.' });
        }
    }
    readDocumentInterop(doc,sections);
    const unsupported = doc.entities.filter(e => e.unsupported).length;
    doc.importDiagnostics.unshift({ severity: 'info', message: `${doc.entities.length} model/layout entities, ${Object.keys(doc.blocks).length} blocks, ${doc.layers.length} layers; ${unsupported} unsupported entities.` });
    for (const [name, p] of Object.entries(sections))
        if (!['HEADER', 'TABLES', 'BLOCKS', 'ENTITIES'].includes(name))
            doc.rawSections[name] = p;
    doc.importDiagnostics.push({ severity: 'info', message: 'Original input remains available unchanged. Edited DXF export normalizes supported planar entities; normalized export rebuilds represented objects. Record-preserving export retains foreign graphs but rejects unsafe edits.' });
    for(const e of [...doc.entities,...Object.values(doc.blocks).flatMap(b=>b.entities||[])]) {
        if(e.type==='INSERT' && e.dynamicSource && doc.blocks[e.dynamicSource]?.dynamic)e.block=e.dynamicSource;
    }
    capturePreservation(doc,pairs);
    return doc;
}
/** Remove only unreachable app-generated evaluation pictures in normalized copies. */
function pruneGeneratedPictures(document) {
    const blocks={...document.blocks},candidates=new Set(Object.entries(blocks).filter(([name,b])=>b.dynamicInstance||b.dimensionPicture).map(([name])=>name));
    const keep=new Set(),queue=[];
    const visit=e=>{if(e.type==='INSERT'||e.type==='DIMENSION'&&e.dimension?.version!==1){if(e.block&&!keep.has(e.block)){keep.add(e.block);queue.push(e.block);}}};
    document.entities.forEach(visit);
    for(const [name,b]of Object.entries(blocks))if(!candidates.has(name))(b.entities||[]).forEach(visit);
    for(let i=0;i<queue.length;i++)(blocks[queue[i]]?.entities||[]).forEach(visit);
    for(const name of candidates)if(!keep.has(name))delete blocks[name];
    return {...document,blocks};
}
function prepareDynamicBlocks(document) {
    const doc={...document,blocks:{...document.blocks},entities:document.entities.slice()},cache=new Map();let serial=0;
    const bake=(e,stack=[])=>{
        if(e.type!=='INSERT')return e;
        const master=doc.blocks[e.block];if(!master)return e;
        if(stack.includes(e.block))throw new Error('Cyclic dynamic block nesting');
        if(stack.length>24)throw new Error('Dynamic block nesting limit exceeded');
        if(!master.dynamic)return e;
        const key=JSON.stringify([e.block,e.dynamicParameters||{}]);let name=cache.get(key);
        if(!name){
            const evaluated=evaluateDynamicBlock(master,e.dynamicParameters||{});
            do{name='*UCC'+(++serial);}while(doc.blocks[name]);
            cache.set(key,name);
            doc.blocks[name]={...evaluated,name,entities:evaluated.entities.filter(c=>!c.hidden).map(c=>bake(c,[...stack,e.block])),dynamicInstance:{master:e.block,values:evaluated.dynamicValues}};
        }
        return {...e,block:name,dynamicSource:e.block};
    };
    doc.entities=doc.entities.map(e=>bake(e));
    // Static parents may contain dynamic references. Retain each original master for metadata-aware editors.
    for(const [name,b]of Object.entries(document.blocks))if(!b.dynamic)doc.blocks[name]={...b,entities:(b.entities||[]).map(e=>bake(e))};
    return doc;
}
function prepareNativeDimensions(document) {
    const doc={...document,blocks:{...document.blocks},entities:document.entities.slice()};let serial=0;
    const prepare=e=>{
        if(e.type!=='DIMENSION'||(e.block&&doc.blocks[e.block]&&e.dimension?.version!==1))return e;
        const picture=dimensionPicture(e,doc);
        let name;do{name='*DCC'+(++serial);}while(doc.blocks[name]);
        doc.blocks[name]={name,base:{x:0,y:0},entities:picture.entities,dimensionPicture:{version:1,ownerId:e.id}};
        return {...e,block:name,dimtype:(e.dimtype??33)|32,definitionPoint:picture.definitionPoint,textMidpoint:picture.textMidpoint,measurement:picture.measurement,dimstyleOverrides:picture.style};
    };
    doc.entities=doc.entities.map(prepare);for(const [name,b]of Object.entries(document.blocks))doc.blocks[name]={...b,entities:(b.entities||[]).map(prepare)};
    return doc;
}
function asciiJson(data) { return JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')); }
/** Normalized AC1024 / R2010 ASCII DXF. The project format preserves full app semantics. */
export function writeDXF(doc, options = {}) {
    const { version = options.mode==='preserve' ? doc.importVersion || 'AC1024' : 'AC1024', includeMetadata = true, mode = 'normalized', strict = false } = options;
    if(mode === 'preserve')return writePreservedDXF(doc,{version});
    if(mode !== 'normalized')throw new Error('Unknown DXF export mode');
    if(strict && exportReport(doc).warnings.length)throw new Error(exportReport(doc).warnings.join(' '));
    doc = prepareNativeDimensions(prepareDynamicBlocks(pruneGeneratedPictures(doc)));
    for(const e of [...doc.entities,...Object.values(doc.blocks).flatMap(b=>b.entities||[])]) {
        if(e.type==='MESH' && version<'AC1024')throw new Error('MESH requires DXF R2010 or newer');
        if(e.type==='HELIX' && version<'AC1021')throw new Error('HELIX requires DXF R2007 or newer');
        if(e.gradient && version<'AC1018')throw new Error('Gradient HATCH requires DXF R2004 or newer');
    }
    if (!['AC1015', 'AC1018', 'AC1021', 'AC1024', 'AC1027', 'AC1032'].includes(version))
        throw new Error('Supported export versions: R2000–R2018');
    const out = [];
    // Normalized output allocates new handles; never convert a 64-bit source
    // handle to Number (incrementing a rounded value can otherwise loop forever).
    let handle = 0x100;
    const next = () => (handle++).toString(16).toUpperCase();
    const nativeHandles=new WeakMap(), sourceHandles=new Map(), layerHandles=new Map();
    for(const e of [...doc.entities,...Object.values(doc.blocks).flatMap(b=>b.entities||[])]) { const h=next(); nativeHandles.set(e,h);if(e._dxf?.handle)sourceHandles.set(String(e._dxf.handle).toUpperCase(),h); }
    const pair = (c, v) => {
        if (typeof v === 'number' && !Number.isFinite(v))
            throw new Error(`Nonfinite DXF value for code ${c}`);
        let s = typeof v === 'number' ? String(v) : String(v ?? '');
        s = s.replace(/\r?\n/g, '\\P');
        if (Number(version.slice(2)) < 1021)
            s = s.replace(/[\u007f-\uffff]/g, c => '\\U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
        out.push(String(c), s);
    };
    const pp = (c, p) => { pair(c, p?.x || 0); pair(c + 10, p?.y || 0); pair(c + 20, p?.z || 0); };
    const meta = data => {
        if (!includeMetadata || !Object.keys(data).length)
            return;
        pair(1001, 'CONDUITCAD');
        const s = asciiJson(data);
        // Leave room for group/app overhead within the native 16 KiB XDATA limit.
        if(s.length>15000)throw new Error('Conduit metadata exceeds the safe DXF XDATA budget; save the native project or export without metadata.');
        for (let i = 0; i < s.length; i += 200)
            pair(1000, s.slice(i, i + 200));
    };
    const section = name => { pair(0, 'SECTION'); pair(2, name); };
    const end = () => pair(0, 'ENDSEC');
    section('HEADER');
    pair(9, '$ACADVER');
    pair(1, version);
    pair(9, '$INSUNITS');
    const knownUnits = { 0: 'unitless', 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm' };
    const unitCode = doc.insunits !== undefined && (knownUnits[doc.insunits] || 'unitless') === doc.units ? doc.insunits : ({ unitless: 0, in: 1, ft: 2, mm: 4, cm: 5, m: 6 })[doc.units] ?? 4;
    pair(70, unitCode);
    pair(9, '$LTSCALE'); pair(40, doc.linetypeScale || 1);
    pair(9, '$MEASUREMENT');
    pair(70, doc.units === 'in' || doc.units === 'ft' ? 0 : 1);
    if (includeMetadata) {
        const s = asciiJson({ parameters: doc.parameters, constraints: doc.constraints, metadata: doc.metadata });
        for (let i = 0; i < s.length; i += 180)
            pair(999, 'CONDUIT:' + s.slice(i, i + 180));
    }
    end();
    section('TABLES');
    pair(0, 'TABLE');
    pair(2, 'LTYPE');
    pair(5, next());
    pair(330, '0');
    pair(100, 'AcDbSymbolTable');
    pair(70, 1);
    pair(0, 'LTYPE');
    pair(5, next());
    pair(100, 'AcDbSymbolTableRecord');
    pair(100, 'AcDbLinetypeTableRecord');
    pair(2, 'CONTINUOUS');
    pair(70, 0);
    pair(3, 'Solid line');
    pair(72, 65);
    pair(73, 0);
    pair(40, 0);
    const types = { ...doc.linetypes };
    for (const e of [...doc.entities, ...Object.values(doc.blocks).flatMap(b=>b.entities || [])])
        if (e.dash?.length)
            types['CC_DASH_' + e.dash.join('_')] = e.dash;
    for (const [name, pattern] of Object.entries(types)) {
        if (name === 'CONTINUOUS' || !pattern.length)
            continue;
        pair(0, 'LTYPE');
        pair(5, next());
        pair(100, 'AcDbSymbolTableRecord');
        pair(100, 'AcDbLinetypeTableRecord');
        pair(2, name);
        pair(70, 0);
        pair(3, name);
        pair(72, 65);
        pair(73, pattern.length);
        pair(40, pattern.reduce((a, b) => a + Math.abs(b), 0));
        pattern.forEach((v, i) => { pair(49, doc.signedLinetypes && !name.startsWith('CC_DASH_') ? v : Math.abs(v) * (i % 2 ? -1 : 1)); pair(74, 0); });
    }
    pair(0, 'ENDTAB');
    pair(0, 'TABLE');
    pair(2, 'LAYER');
    pair(5, next());
    pair(330, '0');
    pair(100, 'AcDbSymbolTable');
    pair(70, doc.layers.length);
    for (const l of doc.layers) {
        pair(0, 'LAYER');
        const layerHandle=next();layerHandles.set(l.name,layerHandle);pair(5, layerHandle);
        pair(100, 'AcDbSymbolTableRecord');
        pair(100, 'AcDbLayerTableRecord');
        pair(2, l.name);
        pair(70, l.locked ? 4 : 0);
        const layerACI = l.colorMode === 'aci' && l.colorIndex > 0 && l.colorIndex < 256 && aciColor(l.colorIndex).toLowerCase() === l.color?.toLowerCase();
        pair(62, (l.visible === false ? -1 : 1) * (layerACI ? l.colorIndex : 7));
        if (!layerACI) pair(420, parseInt((l.color || '#344755').slice(1), 16));
        pair(6, l.linetype || 'CONTINUOUS');
        if (l.lineweight !== undefined) pair(370, l.lineweight);
    }
    pair(0, 'ENDTAB');
    pair(0, 'TABLE');
    pair(2, 'STYLE');
    pair(5, next());
    pair(330, '0');
    pair(100, 'AcDbSymbolTable');
    const textStyles = { ...doc.textStyles };
    if(!Object.keys(textStyles).some(n=>n.toUpperCase()==='STANDARD'))textStyles.STANDARD={font:'txt',widthFactor:1};
    pair(70, Object.keys(textStyles).length);
    for (const [name, style] of Object.entries(textStyles)) {
        pair(0, 'STYLE'); pair(5, next()); pair(100, 'AcDbSymbolTableRecord'); pair(100, 'AcDbTextStyleTableRecord');
        pair(2, name); pair(70, 0); pair(40, style.height || 0); pair(41, style.widthFactor || 1);
        pair(50, style.oblique || 0); pair(71, style.flags || 0); pair(42, 2.5); pair(3, style.font || 'txt'); pair(4, style.bigFont || '');
    }
    pair(0, 'ENDTAB');
    pair(0, 'TABLE');
    pair(2, 'APPID');
    pair(5, next());
    pair(330, '0');
    pair(100, 'AcDbSymbolTable');
    pair(70, 1);
    pair(0, 'APPID');
    pair(5, next());
    pair(100, 'AcDbSymbolTableRecord');
    pair(100, 'AcDbRegAppTableRecord');
    pair(2, 'CONDUITCAD');
    pair(70, 0);
    pair(0, 'ENDTAB');
    pair(0, 'TABLE');
    pair(2, 'BLOCK_RECORD');
    pair(5, next());
    pair(330, '0');
    pair(100, 'AcDbSymbolTable');
    pair(70, Object.keys(doc.blocks).length + 2);
    const blockRecords = Object.create(null);
    for (const name of ['*Model_Space', '*Paper_Space', ...Object.keys(doc.blocks).filter(n => !['*Model_Space', '*Paper_Space'].includes(n))]) {
        blockRecords[name] = next();
        pair(0, 'BLOCK_RECORD');
        pair(5, blockRecords[name]);
        pair(100, 'AcDbSymbolTableRecord');
        pair(100, 'AcDbBlockTableRecord');
        pair(2, name);
    }
    pair(0, 'ENDTAB');
    end();
    const header = (e, t = e.type, owner) => {
        pair(0, t);
        const emittedHandle = nativeHandles.get(e) || next(); pair(5, emittedHandle);
        if (owner)
            pair(330, owner);
        pair(100, 'AcDbEntity');
        pair(8, e.layer || '0');
        if (e.layout && e.layout !== 'Model') {
            pair(67, 1);
            pair(410, e.layout);
        }
        if (e.color === 'BYBLOCK')
            pair(62, 0);
        else if (e.color && e.color !== 'BYLAYER' && e.colorMode==='aci' && e.colorIndex>0 && e.colorIndex<256 && aciColor(e.colorIndex).toLowerCase()===e.color.toLowerCase()) pair(62,e.colorIndex);
        else if (e.color && e.color !== 'BYLAYER') {
            pair(62, 7);
            pair(420, parseInt(e.color.slice(1), 16));
        }
        if (e.hidden)
            pair(60, 1);
        if (e.opacity !== undefined) pair(440, 0x02000000 | Math.round(255 * Math.max(0, Math.min(1, e.opacity))));
        else if (e.transparency != null) pair(440, e.transparency);
        if (e.linetypeScale !== undefined) pair(48, e.linetypeScale);
        if (e.lineweight !== undefined)
            pair(370, e.lineweight);
        if (e.dash?.length)
            pair(6, 'CC_DASH_' + e.dash.join('_'));
        else if (e.linetype && e.linetype !== 'BYLAYER')
            pair(6, e.linetype);
        return emittedHandle;
    };
    const emit = (e, owner) => {
        if (e.unsupported) {
            return;
        } // The original-source download is the lossless preservation path.
        const type = e.type === 'POLYLINE' && !(e.flags & (8|16|64)) ? 'LWPOLYLINE' : e.type;
        const entityHandle = header(e, type, owner);
        const native=e.type==='VIEWPORT'?{...e,clipHandle:e.clipHandle?sourceHandles.get(String(e.clipHandle).toUpperCase()):undefined,frozenLayerHandles:(e.frozenLayers||[]).map(n=>layerHandles.get(n)).filter(Boolean)}:e;
        if(e.type==='VIEWPORT'&&e.clipHandle&&!native.clipHandle)throw new Error('Cannot export unresolved viewport clipping boundary');
        if (!writeInteropEntity(native, pair, pp)) switch (type) {
            case 'POLYLINE':
                pair(100,(e.flags&64)?'AcDbPolyFaceMesh':(e.flags&16)?'AcDbPolygonMesh':'AcDb3dPolyline');
                pair(66,1); pp(10,{x:0,y:0,z:e.elevation || 0}); pair(70,(e.flags || 8)|(e.closed?1:0));
                if(e.flags&16){pair(71,e.mCount || 0);pair(72,e.nCount || 0);}
                if(e.flags&64){pair(71,e.points.length);pair(72,e.faces?.length || 0);}
                break;
            case 'HATCH': writeHatchData(e, pair); break;
            case 'LEADER':
                pair(100, 'AcDbLeader'); pair(3, e.dimstyle || 'STANDARD'); pair(71, e.arrow === false ? 0 : 1); pair(72, e.spline ? 1 : 0); pair(73, 3); pair(74, 0); pair(75, 0); pair(76, e.points.length); for (const p of e.points) pp(10, p); break;
            case 'RAY':
            case 'XLINE': pair(100, type === 'RAY' ? 'AcDbRay' : 'AcDbXline'); pp(10, e.p); pp(11, e.direction); break;
            case 'LINE':
                pair(100, 'AcDbLine');
                pp(10, e.a);
                pp(11, e.b);
                break;
            case 'LWPOLYLINE':
                pair(100, 'AcDbPolyline');
                pair(90, e.points.length);
                pair(70, e.closed ? 1 : 0);
                if (e.elevation) pair(38, e.elevation);
                if (e.constantWidth)
                    pair(43, e.constantWidth);
                for (const p of e.points) {
                    pair(10, p.x);
                    pair(20, p.y);
                    if (p.startWidth) pair(40, p.startWidth);
                    if (p.endWidth) pair(41, p.endWidth);
                    if (p.bulge)
                        pair(42, p.bulge);
                }
                break;
            case 'CIRCLE':
            case 'ARC':
                pair(100, 'AcDbCircle');
                pp(10, e.c);
                pair(40, e.r);
                if (type === 'ARC') {
                    pair(100, 'AcDbArc');
                    pair(50, (e.clockwise ? e.end : e.start) * 180 / Math.PI);
                    pair(51, (e.clockwise ? e.start : e.end) * 180 / Math.PI);
                }
                break;
            case 'ELLIPSE':
                pair(100, 'AcDbEllipse');
                pp(10, e.c);
                pp(11, e.major);
                pair(40, e.ratio);
                pair(41, e.start || 0);
                pair(42, e.end ?? TAU);
                break;
            case 'SPLINE':
                pair(100, 'AcDbSpline');
                pair(70, ((e.splineFlags || 0) & ~5) | (e.closed ? 1 : 0) | (e.weights?.length ? 4 : 0));
                pair(71, e.degree);
                pair(72, e.knots.length);
                pair(73, e.controlPoints.length);
                pair(74, e.fitPoints?.length || 0);
                for (const v of e.knots)
                    pair(40, v);
                for (const v of e.weights || [])
                    pair(41, v);
                for (const p of e.controlPoints)
                    pp(10, p);
                for (const p of e.fitPoints || [])
                    pp(11, p);
                break;
            case 'TEXT':
            case 'ATTRIB':
            case 'ATTDEF':
                pair(100, 'AcDbText');
                pp(10, e.p);
                pair(40, e.height || 12);
                pair(1, e.text || '');
                pair(50, e.rotation || 0);
                pair(41, e.widthFactor || 1);
                pair(7, e.styleName || 'STANDARD');
                if (e.oblique) pair(51, e.oblique); if (e.textFlags) pair(71, e.textFlags);
                if (e.halign || e.valign || (e.align && e.align !== 'left')) {
                    pair(72, e.halign ?? (e.align === 'center' ? 1 : e.align === 'right' ? 2 : 0));
                    pp(11, e.alignPoint || e.p);
                }
                if (type === 'TEXT') { pair(100, 'AcDbText'); pair(73, e.valign || 0); }
                else {
                    pair(100, type === 'ATTRIB' ? 'AcDbAttribute' : 'AcDbAttributeDefinition');
                    pair(2, e.attributeTag || 'TAG');
                    if (type === 'ATTDEF')
                        pair(3, 'Equipment tag');
                    pair(70, e.invisible ? 1 : 0); pair(74, e.valign || 0);
                }
                break;
            case 'MTEXT': {
                pair(100, 'AcDbMText'); pp(10, e.p); pair(40, e.height || 12); pair(41, e.mtextWidth || 0);
                pair(71, e.attachment || (e.align === 'center' ? 2 : e.align === 'right' ? 3 : 1)); pair(7, e.styleName || 'STANDARD');
                const value = String(e.text || '').replace(/\r?\n/g, '\\P');
                const chunks=[];let chunk='',size=0;const encoder=new TextEncoder();
                for(const char of value){const bytes=Number(version.slice(2))<1021?char.split('').reduce((n,c)=>n+(c.charCodeAt(0)>127?7:1),0):encoder.encode(char).length;if(size+bytes>250){chunks.push(chunk);chunk='';size=0;}chunk+=char;size+=bytes;}
                chunks.push(chunk);chunks.forEach((v,i)=>pair(i===chunks.length-1?1:3,v));
                const a = (e.rotation || 0) * Math.PI / 180; pp(11, { x: Math.cos(a), y: Math.sin(a) });
                pair(73, e.lineSpacingStyle || 1); pair(44, e.lineSpacing || 1);
                if (e.backgroundFill) { pair(90, e.backgroundFill); pair(45, e.backgroundScale || 1.5); pair(63, 7); if (e.backgroundColor) pair(421, parseInt(e.backgroundColor.slice(1), 16)); }
                break;
            }
            case 'POINT':
                pair(100, 'AcDbPoint');
                pp(10, e.p);
                break;
            case 'SOLID':
            case 'TRACE':
            case '3DFACE':
                pair(100, type === '3DFACE' ? 'AcDbFace' : 'AcDbTrace');
                if (type === '3DFACE') pair(70, e.edgeFlags || 0);
                for (const [i, j] of (type === '3DFACE' ? [[0, 0], [1, 1], [2, 2], [3, 3]] : [[0, 0], [1, 1], [2, 3], [3, 2]]))
                    pp(10 + i, e.points[j] || e.points.at(-1));
                break;
            case 'DIMENSION':
                pair(100, 'AcDbDimension');
                pair(2, e.block);
                pp(10, e.a);
                pair(70, 32);
                pair(1, e.text || '<>');
                pair(100, 'AcDbAlignedDimension');
                pp(13, e.a);
                pp(14, e.b);
                break;
            case 'INSERT': {
                pair(100, 'AcDbBlockReference');
                pair(2, e.block);
                pp(10, { x: e.x, y: e.y, z: e.z });
                pair(41, e.sx ?? 1);
                pair(42, e.sy ?? 1);
                pair(43, e.sz ?? 1);
                pair(50, e.rotation || 0);
                if (e.columns > 1) {
                    pair(70, e.columns);
                    pair(44, e.columnSpacing || 0);
                }
                if (e.rows > 1) {
                    pair(71, e.rows);
                    pair(45, e.rowSpacing || 0);
                }
                if (e.attributes?.length || e.tag)
                    pair(66, 1);
                break;
            }
        }
        if (e.type !== 'HATCH' && e.extrusion) pp(210, e.extrusion);
        if (e.thickness) pair(39, e.thickness);
        const m = {};
        if (e.id)
            m.id = e.id;
        for (const k of ['connector', 'tag', 'label', 'dash', 'width', 'parametric', 'fill', 'locked', 'dimension', 'dynamicParameters', 'dynamicSource'])
            if (e[k] !== undefined)
                m[k] = e[k];
        if(e.type==='DIMENSION')writeDimensionOverrides(e.dimstyleOverrides,pair);
        meta(m);
        if (type === 'POLYLINE') {
            for (const p of e.points || []) {
                header({layer:e.layer},'VERTEX',entityHandle);pair(100,'AcDbVertex');
                pair(100,(e.flags&64)?'AcDbPolyFaceMeshVertex':(e.flags&16)?'AcDbPolygonMeshVertex':'AcDb3dPolylineVertex');
                pp(10,p);pair(70,(e.flags&64)?192:(e.flags&16)?64:32);
            }
            for (const face of e.faces || []) {
                header({layer:e.layer},'VERTEX',entityHandle);pair(100,'AcDbFaceRecord');pp(10,{x:0,y:0,z:0});pair(70,128);
                face.forEach((n,i)=>pair(71+i,n));
            }
            header({layer:e.layer},'SEQEND',entityHandle);
        }
        if (type === 'INSERT' && (e.attributes?.length || e.tag)) {
            for (const a of e.attributes || [])
                emit(a, entityHandle);
            if (e.tag) {
                const block = doc.blocks[e.block], offset = block?.symbol?.labelOffset || 55;
                emit({ type: 'ATTRIB', p: { x: e.x, y: e.y - Math.abs((e.sy ?? 1) * offset) }, text: e.tag, height: e.tagHeight || 12, align: 'center', attributeTag: 'TAG', layer: e.layer }, entityHandle);
            }
            pair(0, 'SEQEND');
            pair(5, next());
            pair(330, entityHandle);
            pair(100, 'AcDbEntity');
            pair(8, e.layer || '0');
        }
    };
    section('BLOCKS');
    for (const name of Object.keys(blockRecords)) {
        const b = doc.blocks[name] || { base: { x: 0, y: 0 }, entities: [] };
        pair(0, 'BLOCK');
        pair(5, next());
        pair(330, blockRecords[name]);
        pair(100, 'AcDbEntity');
        pair(8, '0');
        pair(100, 'AcDbBlockBegin');
        pair(2, name);
        pair(70, name.startsWith('*') ? 1 : 0);
        pp(10, b.base);
        pair(3, name);
        pair(1, '');
        meta({ ports: b.ports || [], symbol: b.symbol, dynamic: b.dynamic, dynamicInstance: b.dynamicInstance, dimensionPicture: b.dimensionPicture });
        for (const e of b.entities)
            emit(e, blockRecords[name]);
        pair(0, 'ENDBLK');
        pair(5, next());
        pair(330, blockRecords[name]);
        pair(100, 'AcDbEntity');
        pair(8, '0');
        pair(100, 'AcDbBlockEnd');
    }
    end();
    section('ENTITIES');
    for (const e of doc.entities)
        emit(e, blockRecords[e.layout && e.layout !== 'Model' ? '*Paper_Space' : '*Model_Space']);
    end();
    pair(0, 'EOF');
    return completeDXFStructure(readAsciiTags(out.join('\r\n')+'\r\n'), doc, version, {includeMetadata});
}
export function exportReport(doc) {
    const entities=[...doc.entities,...Object.values(doc.blocks).flatMap(b=>b.entities||[])],unsupported=entities.filter(e=>e.unsupported);
    return {format:'ASCII or binary DXF R2000–R2018',unsupported:unsupported.map(e=>({id:e.id,type:e.type})),warnings:[
        ...(unsupported.length?[`${unsupported.length} unsupported entities omitted from normalized export (including block contents). Use record-preserving or original DXF export.`]:[]),
        ...(entities.some(e=>e.type==='HATCH'&&e.associative)?['Hatch associations are detached in normalized export.']:[]),
        ...(entities.some(e=>e._dxf?.raw?.some(p=>p[0]===1001&&p[1]!=='CONDUITCAD'))?['Foreign application XDATA is retained only by record-preserving export.']:[]),
        ...(Object.keys(doc.rawSections||{}).length?['Foreign OBJECTS/CLASSES sections are rebuilt, not merged, in normalized export. Record-preserving mode retains original graphs and refuses unsafe changes.']:[])
    ],originalAvailable:!!doc.source,preservationAvailable:!!doc._dxfPreservation};
}
