/** Native viewport semantics, independent of any particular GPU API or UI. */
const preset = (id, label, group, faces, visible, hidden, smooth, description) => Object.freeze({ id, label, group, faces, visible, hidden, smooth, description });
export const VISUAL_STYLES = Object.freeze([
    preset('shaded-edges', 'Shaded with visible edges', 'Design', 'shaded', true, false, true, 'Smooth surfaces with depth-tested feature and silhouette edges.'),
    preset('shaded', 'Shaded', 'Design', 'shaded', false, false, true, 'Smooth, lit surfaces without mesh edges.'),
    preset('shaded-hidden', 'Shaded with hidden edges', 'Design', 'shaded', true, true, true, 'Shaded surfaces, visible outlines and dashed obscured edges.'),
    preset('wireframe', 'Wireframe', 'Technical', 'none', true, 'solid', false, 'All polygon edges, including edges behind other geometry.'),
    preset('hidden', 'Wireframe · visible edges only', 'Technical', 'none', true, false, false, 'Hidden-line removal using a surface depth prepass.'),
    preset('wireframe-hidden', 'Wireframe with hidden edges', 'Technical', 'none', true, true, false, 'Visible edges are solid; occluded edges are dashed.'),
    preset('realistic', 'Realistic', 'Presentation', 'pbr', false, false, true, 'Linear-light GGX metal/roughness materials and procedural environment lighting.'),
    preset('realistic-edges', 'Realistic with edges', 'Presentation', 'pbr', true, false, true, 'Material shading with readable feature and silhouette edges.'),
    preset('conceptual', 'Conceptual', 'Presentation', 'gooch', true, false, true, 'Cool-to-warm Gooch shading for shape comprehension.'),
    preset('gray', 'Shades of gray', 'Presentation', 'gray', false, false, true, 'Monochrome lit surfaces, without changing entity colors.'),
    preset('sketchy', 'Sketchy', 'Illustration', 'none', true, false, false, 'Depth-tested lines with deterministic screen-space jitter and overhang.'),
    preset('xray', 'X-ray', 'Inspection', 'shaded', true, 'solid', true, 'Order-independent weighted transparency; internal edges remain visible.'),
    preset('flat', 'Flat shaded', 'Inspection', 'shaded', false, false, false, 'Original polygon normals expose faceting without altering the mesh.'),
    preset('flat-edges', 'Flat shaded with edges', 'Inspection', 'shaded', true, false, false, 'Faceted surfaces with every non-coplanar polygon edge.'),
    preset('clay', 'Clay', 'Illustration', 'clay', true, false, true, 'Neutral material with shape outlines.'),
    preset('normals', 'Surface normals', 'Inspection', 'normals', false, false, false, 'World-space normal components mapped to RGB for diagnosis.')
]);
const aliases = Object.freeze({ '3dwireframe': 'wireframe', 'wireframe-visible': 'hidden', 'shades-of-gray': 'gray', 'x-ray': 'xray', realisticedges: 'realistic-edges', shaded: 'shaded' });
export function visualStyle(id) { const key = aliases[id] || id; const value = VISUAL_STYLES.find(s => s.id === key); if (!value) throw new RangeError('Unknown 3D visual style: ' + id); return value; }
export const ENVIRONMENTS = Object.freeze([
    Object.freeze({ id: 'studio', label: 'Design studio', light: [-.3, -.6, 1], sky: [.66, .76, .92], floor: [.16, .18, .22] }),
    Object.freeze({ id: 'soft', label: 'Soft light', light: [.5, -.3, 1], sky: [.85, .87, .9], floor: [.3, .32, .35] }),
    Object.freeze({ id: 'outdoor', label: 'Daylight', light: [-.6, -.2, .9], sky: [.44, .66, 1], floor: [.24, .21, .17] }),
    Object.freeze({ id: 'dark', label: 'Dark studio', light: [.1, -.5, 1], sky: [.25, .29, .4], floor: [.04, .045, .065] })
].map(e=>Object.freeze({...e,light:Object.freeze(e.light),sky:Object.freeze(e.sky),floor:Object.freeze(e.floor)})));
export const MATERIAL_PRESETS = Object.freeze([
    { id: 'paint', label: 'Paint', color: '#568e9b', metallic: 0, roughness: .36, opacity: 1 },
    { id: 'aluminum', label: 'Aluminum', color: '#c7cdd1', metallic: 1, roughness: .24, opacity: 1 },
    { id: 'steel', label: 'Steel', color: '#9da8b2', metallic: 1, roughness: .32, opacity: 1 },
    { id: 'copper', label: 'Copper', color: '#c88455', metallic: 1, roughness: .28, opacity: 1 },
    { id: 'brass', label: 'Brass', color: '#d0b06a', metallic: 1, roughness: .22, opacity: 1 },
    { id: 'plastic', label: 'Polymer', color: '#365f7c', metallic: 0, roughness: .25, opacity: 1 },
    { id: 'rubber', label: 'Rubber', color: '#34383b', metallic: 0, roughness: .9, opacity: 1 },
    { id: 'ceramic', label: 'Ceramic', color: '#e2ddd0', metallic: 0, roughness: .18, opacity: 1 },
    { id: 'transparent', label: 'Transparent polymer', color: '#98c3c5', metallic: 0, roughness: .12, opacity: .28 }
].map(Object.freeze));
export const DEFAULT_DISPLAY_SETTINGS = Object.freeze({
    style: 'shaded-edges', environment: 'studio', exposure: 0, grid: true, ground: false,
    shadows: false, ambientOcclusion: false, aoStrength: .65, aoRadius: .06,
    background: 'solid', backgroundColor: '#f0f5f5', backgroundTop: '#cddde6', groundColor: '#e0e4e4',
    edgeColor: '#344d58', hiddenColor: '#80959d', edgeWidth: 1, silhouetteWidth: 1.8,
    creaseAngle: 35, edgeDetail: 'feature', hiddenDash: 7, xrayOpacity: .24,
    jitter: 1.1, overhang: 2.5, quality: 'balanced', sectionCaps: true, capColor: '#e2b86c', capHatch: true
});
const colors = ['backgroundColor', 'backgroundTop', 'groundColor', 'edgeColor', 'hiddenColor', 'capColor'];
const numbers = { exposure: [-6, 6], aoStrength: [0, 1.5], aoRadius: [.002, .5], edgeWidth: [.5, 5], silhouetteWidth: [0, 6], creaseAngle: [0, 89], hiddenDash: [2, 24], xrayOpacity: [.02, .95], jitter: [0, 4], overhang: [0, 10] };
const booleans = ['grid', 'ground', 'shadows', 'ambientOcclusion', 'sectionCaps', 'capHatch'];
/** Strict for commands, tolerant for untrusted saved view state. Never copies unknown keys. */
export function normalizeDisplaySettings(input = {}, { tolerant = false } = {}) {
    const out = { ...DEFAULT_DISPLAY_SETTINGS };
    const apply = (key, valid, value) => { if (!(key in input)) return; if (!valid) { if (!tolerant) throw new RangeError('Invalid 3D display setting: ' + key); } else out[key] = value; };
    if (!input || typeof input !== 'object' || Array.isArray(input)) { if (!tolerant) throw new TypeError('Display settings must be an object'); return out; }
    if ('style' in input) { try { out.style = visualStyle(input.style).id; } catch (e) { if (!tolerant) throw e; } }
    for (const k of colors) apply(k, /^#[0-9a-f]{6}$/i.test(input[k]), input[k]);
    for (const [k, [lo, hi]] of Object.entries(numbers)) apply(k, Number.isFinite(input[k]) && input[k] >= lo && input[k] <= hi, input[k]);
    for (const k of booleans) apply(k, typeof input[k] === 'boolean', input[k]);
    for (const [k, choices] of Object.entries({ environment: ENVIRONMENTS.map(e => e.id), background: ['solid', 'gradient'], edgeDetail: ['feature', 'all'], quality: ['draft', 'balanced', 'high'] })) apply(k, choices.includes(input[k]), input[k]);
    return out;
}
export function normalizeMaterial(input = {}, fallbackColor = '#648596') {
    const preset = MATERIAL_PRESETS.find(p => p.id === input?.preset) || MATERIAL_PRESETS[0];
    const number = (key, lo, hi, def) => Number.isFinite(input?.[key]) ? Math.max(lo, Math.min(hi, input[key])) : def;
    return { color: /^#[0-9a-f]{6}$/i.test(input?.color) ? input.color : fallbackColor, metallic: number('metallic', 0, 1, preset.metallic), roughness: number('roughness', .04, 1, preset.roughness), opacity: number('opacity', 0, 1, 1), emission: number('emission', 0, 4, 0) };
}
export function color3(hex) { const n = /^#[0-9a-f]{6}$/i.test(hex) ? parseInt(hex.slice(1), 16) : 0x648596; return [(n >> 16) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
export function faceMode(style) { return ['none', 'shaded', 'pbr', 'gooch', 'gray', 'clay', 'normals'].indexOf(visualStyle(style).faces); }

/** Attachment budget excludes CAD vertex buffers. Optional passes never allocate full-size targets when off. */
export function renderSize3D(width, height, deviceScale, settings, transparent = false, mobile = false, maxDimension = 8192) {
    if (!Number.isInteger(maxDimension) || maxDimension<1) throw new RangeError('Invalid attachment dimension limit');
    if (![width,height,deviceScale].every(Number.isFinite) || width<=0 || height<=0 || deviceScale<=0) throw new RangeError('Invalid 3D viewport size');
    const bytesPerPixel=56+(transparent?80:0)+(settings.ambientOcclusion?12:0);
    const budget=(mobile?96:256)*1024*1024-(settings.shadows?4*1024*1024:0);
    const pixelBudget=Math.min(budget/bytesPerPixel,settings.quality==='high'?6000000:settings.quality==='draft'?1200000:3000000);
    const scale=Math.min(deviceScale,settings.quality==='draft'?1:2,Math.sqrt(pixelBudget/(width*height)),maxDimension/width,maxDimension/height);
    const w=Math.max(1,Math.floor(width*scale)),h=Math.max(1,Math.floor(height*scale));
    return {width:w,height:h,scale,estimatedAttachmentBytes:w*h*bytesPerPixel+(settings.shadows?4*1024*1024:0)};
}
