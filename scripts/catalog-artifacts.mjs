/** Reproduce the review atlas, CAD specimens and industry starters from the actual catalogue. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createDocument, clone } from '@conduitcad/model';
import { SYMBOLS, CATEGORIES, STANDARD_REFERENCES, DRAWING_TYPES, LINE_STYLES, installSymbols, insertSymbol, createDrawing, auditSymbols } from '@conduitcad/symbols';
import { writeDXF } from '@conduitcad/dxf';
import { symbolSVG } from '@conduitcad/workbench';
const root = path.resolve(import.meta.dirname, '..');
const version = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
const save = async (file, data) => { const target = path.join(root, file); await mkdir(path.dirname(target), {recursive: true}); await writeFile(target, typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n'); };
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const report = auditSymbols();
if (report.some(r => r.errors.length)) throw new Error(JSON.stringify(report.filter(r => r.errors.length), null, 2));
await save('artifacts/symbol-audit.json', {version, masters: SYMBOLS.length, categories: CATEGORIES.length, terminalCount: report.reduce((n, r) => n + Object.keys(r.terminals).length, 0), tolerance: .15, normativeDimensionsVerified: false, results: report});
const catalogue = installSymbols(createDocument('Conduit engineering symbol catalogue'));
SYMBOLS.forEach((s, i) => catalogue.entities.push(insertSymbol(catalogue, s.id, (i % 12) * 180, -Math.floor(i / 12) * 200, { tag: s.id })));
await save('artifacts/symbol-catalog.dxf', writeDXF(catalogue));
await save('artifacts/symbol-manifest.json', SYMBOLS.map(s => ({id: s.id, block: s.block, category: s.category, entities: s.entities.map(e => e.type), ports: s.ports, refs: s.symbol.standardRefs})));
// Keep sample projects lean without embedding hundreds of unused library definitions.
function usedBlocks(document) {
    const result = clone(document), used = new Set();
    function visit(entities) { for (const e of entities) if (e.block && document.blocks[e.block] && !used.has(e.block)) { used.add(e.block); visit(document.blocks[e.block].entities); } }
    visit(document.entities);
    result.blocks = Object.fromEntries([...used].map(name => [name, result.blocks[name]]));
    return result;
}
const templates = [];
for (const type of DRAWING_TYPES) {
    const doc = usedBlocks(createDrawing(type.id));
    const prefix = ['pid','electrical','flow'].includes(type.id) ? `samples/${type.id}` : `samples/industry/${type.id}`;
    await save(prefix + '.dxf', writeDXF(doc));
    await save(prefix + '.conduit.json', doc);
    templates.push({id: type.id, industry: type.industry, type: type.drawingType, file: prefix + '.dxf', entities: doc.entities.length, nodes: doc.entities.filter(e => e.type === 'INSERT').length, edges: doc.entities.filter(e => e.connector).length});
}
await save('artifacts/drawing-templates.json', templates);
const style = `*{box-sizing:border-box}body{font:14px system-ui;margin:24px;color:#203e49;background:#f6f9f8}h1{font-size:28px;margin-bottom:4px}h2{margin-top:36px}p{max-width:1050px;line-height:1.5}nav{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}a{color:#136e65}.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.card{border:1px solid #cedbd8;border-radius:8px;background:#fff;padding:12px;min-height:212px;break-inside:avoid}.card svg{width:100%;height:118px;margin-bottom:8px}.card strong{display:block;font-size:13px}.card small{display:block;font-size:10px;color:#546b72;margin-top:6px;overflow-wrap:anywhere}.key{padding:12px;border:1px solid #bdcec9;background:#edf4f1}.category{scroll-margin-top:12px}@media(max-width:700px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}body{margin:12px}}@media print{nav{display:none}.category{break-before:page}}`;
const sections = CATEGORIES.map(c => `<section class="category" id="category-${c.id.replace(/[^a-z0-9]/gi,'-')}"><h2>${escape(c.name)} · ${SYMBOLS.filter(s => s.category === c.id).length}</h2><p>${escape(c.description)}. Reference family: ${escape(c.refs.join(', '))}.</p><div class="grid">${SYMBOLS.filter(s => s.category === c.id).map(s => `<article class="card" data-symbol="${escape(s.id)}">${symbolSVG(catalogue.blocks[s.block], catalogue)}<strong>${escape(s.name)}</strong><small>${escape(s.id)} · ${s.ports.length} named terminals</small><small>${escape(s.symbol.standardRefs.join(' / '))}</small></article>`).join('')}</div></section>`).join('');
await save('docs/symbol-atlas.html', `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ConduitCAD ${version} symbol review atlas</title><style>${style}</style><h1>Engineering symbol atlas</h1><p>${SYMBOLS.length} original CAD masters · ${CATEGORIES.length} categories · revision 3 · ConduitCAD ${version}</p><p class="key">Family-level convention and geometry review, not certification against normative dimensions. Electrical alternatives are labeled; HVAC, water, automation, fire-alarm and network topology use explicit project conventions. No ISO 7010 safety signs are supplied.</p><nav>${CATEGORIES.map(c => `<a href="#category-${c.id.replace(/[^a-z0-9]/gi,'-')}">${escape(c.name)}</a>`).join('')}</nav>${sections}</html>`);
const rows = SYMBOLS.map(s => `| \`${s.id}\` | ${s.name.replaceAll('|','/')} | ${s.category} | ${s.ports.length} | ${s.symbol.standardRefs.join(', ')} | ${s.symbol.review.note} |`).join('\n');
await save('docs/SYMBOL_REVIEW.md', `# Geometry review ledger — ${version}\n\nGenerated by \`node scripts/catalog-artifacts.mjs\` from the actual master definitions.\n\nAll ${SYMBOLS.length} masters were checked for finite native geometry, nonzero lines, unique identities, normalized terminal directions and terminal-to-geometry distance no greater than 0.15 drawing units. ${LINE_STYLES.length} line styles and ${DRAWING_TYPES.length} editable drawing starters are included. Normative dimensions and exact database entries are **not independently verified**; family references are provenance, not a certification claim. See SYMBOLS.md for scope and migration rules.\n\n| ID | Master | Category | Terminals | Reference family | Review / change |\n|---|---|---|---:|---|---|\n${rows}\n\n## Primary references\n\n${Object.entries(STANDARD_REFERENCES).map(([id,r])=>`- **${id}**: ${r.title}. ${r.scope}${r.url?' '+r.url:''}`).join('\n')}\n`);
console.log(JSON.stringify({version, masters: SYMBOLS.length, categories: CATEGORIES.length, templates: templates.length, auditErrors: 0}));
