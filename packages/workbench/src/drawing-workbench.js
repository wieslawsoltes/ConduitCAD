import { DRAWING_TOOLS, drawingTool, DrawingSession, createDrawingEntity, parseDrawingPoint, hatchFromEntities, validateBoundary } from '@conduitcad/drawing';
import { entity, polyline, clone, isLocked } from '@conduitcad/model';
import { distance, TAU } from '@conduitcad/geometry';
import { icon, escapeHTML, commandContent, toolIcon } from './icons.js';

const E = escapeHTML;
const number = n => Number(n.toFixed(6)).toString();
const action = (id, label, ic = 'properties') => `<button type="button" data-action="${id}" aria-label="${E(label)}">${commandContent(id,label,ic)}</button>`;
const finite = (value, name, positive = false) => {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12 || (positive && value <= 1e-8)) throw new Error(`Invalid ${name}`);
    return value;
};
const defaults = { sides: 6, circumscribed: false, pattern: 'solid', angle: 45, spacing: 10, height: 12, text: 'Multiline text' };

export function beginDrawing(w, id) {
    w.drawingSession = drawingTool(id) ? new DrawingSession(id, { ...defaults, ...w.drawingOptions?.[id] }) : null;
    if (w.drawingSession) w.draft = w.drawingSession.points;
}
function properties(w) {
    const layer = w.doc.layers.find(l => l.name === w.currentLayer) || w.doc.layers.find(l => l.name === '0') || w.doc.layers[0];
    if (!layer || layer.locked || layer.visible === false) throw new Error('Choose a visible, unlocked drawing layer');
    return { layer: layer.name, layout: w.doc.activeLayout };
}
export function commitDrawing(w, e) {
    const p = properties(w); Object.assign(e, p);
    w.edit('Draw ' + (drawingTool(w.tool)?.label || e.type), () => { w.doc.entities.push(e); w.selection = new Set([e.id]); });
    // Leave the command armed for repeated placement, with no stale preview or points.
    beginDrawing(w, w.tool); w.preview = null; w.snap = null;
    w.updateTools(); w.updateSelection(); w.renderer.invalidate();
    return e;
}
export function acceptDrawingPoint(w, p) {
    if (!w.drawingSession) throw new Error('Choose a drawing tool first');
    const e = w.drawingSession.add(p, properties(w), w.doc);
    if (e) commitDrawing(w, e);
    else { w.draft = w.drawingSession.points; w.preview = null; w.updateTools(); w.renderer.invalidate(); }
    return e;
}
export function drawingPointerUp(w, drag, end, moved) {
    const session = w.drawingSession;
    if (!session) return;
    if (session.tool.drag && !session.points.length && moved > 6) acceptDrawingPoint(w, drag.start);
    acceptDrawingPoint(w, end);
}
export function drawingPreview(w, a, b) {
    const session = w.drawingSession, props = { id: 'drawing-preview', layer: w.currentLayer, color: '#259e87', width: 1.7 };
    if (w.drag?.kind === 'native-draw' && session.tool.drag && !session.points.length) {
        try { return createDrawingEntity(w.tool, [a, b], session.options, props, w.doc); } catch { return polyline([a, b], false, props); }
    }
    return session.preview(b, props, w.doc);
}
export function updateDrawingControls(w) {
    const session = w.drawingSession, path = w.tool === 'polyline', active = !!session || path;
    const hint = w.$('.tool-hint');
    if (session) hint.textContent = `${session.tool.label} · ${session.points.length + 1}${session.tool.count ? '/' + session.tool.count : ''}: ${session.prompt}`;
    w.$('.canvas-area').classList.toggle('drawing-active', active);
    hint.setAttribute('role', 'status'); hint.setAttribute('aria-live', 'polite');
    const controls = w.$('.drawing-session-controls');
    if (!controls) return;
    controls.classList.toggle('hide', !active);
    controls.querySelector('[data-action="draw-back"]').disabled = !w.draft.length;
    controls.querySelector('[data-action="draw-close"]').classList.toggle('hide', !(path || session?.tool.canClose));
    controls.querySelector('[data-action="draw-close"]').disabled = w.draft.length < 3;
    controls.querySelector('[data-action="draw-options"]').classList.toggle('hide', !session?.tool.options);
    const finish = w.$('.finish-button');
    finish.classList.toggle('hide', !(path && w.draft.length >= 2 || session?.canFinish));
    finish.innerHTML = `${icon('check')} Finish`;
}
export function finishDrawing(w, closed = false) {
    if (w.drawingSession) { commitDrawing(w, w.drawingSession.finish(closed, properties(w), w.doc)); return true; }
    if (closed && w.tool === 'polyline') {
        const points = validateBoundary(w.draft);
        const e = polyline(points, true, properties(w));
        w.edit('Draw closed polyline', () => { w.doc.entities.push(e); w.selection = new Set([e.id]); });
        w.setTool('select'); return true;
    }
    return false;
}

export function drawingToolSections(w) {
    const groups = new Map();
    for (const t of DRAWING_TOOLS) { if (!groups.has(t.group)) groups.set(t.group, []); groups.get(t.group).push(t); }
    return `<label class="field drawing-tool-search">Find a drawing tool<input data-drawing-search type="search" placeholder="Arc, hatch, spline, ordinate…" aria-label="Find a drawing tool"></label>` +
        [...groups].map(([group, tools]) => `<section class="drawing-tool-group"><h3>${E(group)}</h3><div class="operation-grid">${tools.map(t => `<button type="button" data-tool="${t.id}" data-tool-search="${E((t.label + ' ' + group + ' ' + t.id).toLowerCase())}" title="${E(t.steps.join(' → '))}">${icon(toolIcon(t.id,t.icon),'command-icon')}<span class="command-label">${E(t.label)}</span></button>`).join('')}</div></section>`).join('') +
        `<section class="drawing-tool-group"><h3>Existing boundaries</h3><div class="operation-grid">${action('hatch-selection', 'Hatch selected boundaries', 'hatch').replace('<button ', '<button data-tool-search="hatch selected boundaries" ')}</div></section>`;
}
export function bindDrawingSearch(w) {
    const status = document.createElement('div'); status.className = 'drawing-search-status'; status.setAttribute('role', 'status');
    w.modal?.querySelector('.drawing-tool-search')?.append(status);
    w.modal?.querySelector('[data-drawing-search]')?.addEventListener('input', event => {
        const words = event.target.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
        for (const b of w.modal.querySelectorAll('[data-tool-search]')) b.hidden = !words.every(word => b.dataset.toolSearch.includes(word));
        for (const section of w.modal.querySelectorAll('.drawing-tool-group')) section.hidden = ![...section.querySelectorAll('[data-tool-search]')].some(b => !b.hidden);
        const count = [...w.modal.querySelectorAll('[data-tool-search]')].filter(b => !b.hidden).length;
        status.textContent = count ? `${count} matching tools` : 'No matching tools. Try a shape or editing command.';
    });
}
export function drawingOptionsDialog(w, selected = false) {
    const id = selected ? 'hatch' : w.tool, current = { ...defaults, ...w.drawingOptions?.[id], ...(!selected ? w.drawingSession?.options : {}) };
    let fields = '';
    if (id === 'polygon') fields = `<label class="field">Sides<input name="sides" value="${current.sides}" inputmode="numeric"></label><label class="field">Construction<select name="circumscribed"><option value="false">Inscribed · pick vertex</option><option value="true" ${current.circumscribed ? 'selected' : ''}>Circumscribed · pick side midpoint</option></select></label>`;
    if (id === 'hatch') fields = `<label class="field">Fill<select name="pattern">${['solid', 'lines', 'cross'].map(p => `<option ${p === current.pattern ? 'selected' : ''}>${p}</option>`).join('')}</select></label><label class="field">Line spacing<input name="spacing" value="${current.spacing}" inputmode="decimal"></label><label class="field">Angle · degrees<input name="angle" value="${current.angle}" inputmode="decimal"></label>`;
    if (id === 'mtext') fields = `<label class="field full">Text<textarea name="text" rows="5">${E(current.text)}</textarea></label><label class="field">Text height<input name="height" value="${current.height}" inputmode="decimal"></label>`;
    w.openModal(selected ? 'Hatch selected closed boundaries' : 'Drawing tool options', `<div class="fields">${fields}</div><p class="muted-note">${id === 'hatch' ? 'Closed circles, ellipses and planar polylines become native hatch boundaries with even-odd islands. The hatch is a non-associative snapshot. Line/cross patterns are user-defined.' : 'Numeric values accept parameter expressions. Settings are retained for this tool.'}</p><div class="error-text"></div>`, { confirm: selected ? 'Create hatch' : 'Apply', onConfirm: () => {
        const next = { ...current }, modal = w.modal;
        for (const input of modal.querySelectorAll('[name]')) next[input.name] = input.name === 'text' || input.name === 'pattern' ? input.value : input.name === 'circumscribed' ? input.value === 'true' : w.eval(input.value);
        if (id === 'polygon' && (!Number.isInteger(next.sides) || next.sides < 3 || next.sides > 512)) throw new Error('Use 3–512 polygon sides');
        if (id === 'hatch') { finite(next.spacing, 'spacing', true); finite(next.angle, 'angle'); }
        if (id === 'mtext') { finite(next.height, 'text height', true); if (!next.text.trim() || next.text.length > 16000) throw new Error('Enter 1–16000 text characters'); }
        if (selected) {
            const e = hatchFromEntities(w.selected(), w.doc, next, properties(w));
            w.edit('Hatch selected boundaries', () => { w.doc.entities.push(e); w.selection = new Set([e.id]); });
        } else w.drawingSession.options = next;
        w.drawingOptions = { ...w.drawingOptions, [id]: next }; w.preview = null;
        w.closeModal(); w.updateTools(); w.renderer.invalidate();
    } });
}
export function drawingAction(w, id) {
    if (id === 'draw-back') {
        if (w.drawingSession) w.drawingSession.undo(); else w.draft.pop();
        w.preview = null; w.updateTools(); w.renderer.invalidate(); return true;
    }
    if (id === 'draw-close') { finishDrawing(w, true); return true; }
    if (id === 'draw-cancel') { w.setTool('select'); return true; }
    if (id === 'draw-options' || id === 'hatch-selection') { drawingOptionsDialog(w, id === 'hatch-selection'); return true; }
    if (id === 'draw-exact-point') {
        w.ask('Next drawing point', [{ name: 'point', label: 'x,y · @dx,dy · @length<degrees', value: w.cursor ? `${number(w.cursor.x)},${number(w.cursor.y)}` : '0,0' }], values => {
            const p = parseDrawingPoint(values.point, w.draft.at(-1), s => w.eval(s));
            if (w.drawingSession) acceptDrawingPoint(w, p);
            else if (w.tool === 'polyline') { if (w.draft.length && distance(w.draft.at(-1), p) < 1e-8) throw new Error('Choose a distinct point'); w.draft.push(p); w.updateTools(); w.renderer.invalidate(); }
        }); return true;
    }
    if (id === 'native-vertices') { editVertices(w); return true; }
    return false;
}

/** Commands with no arguments arm their point-driven tool; arguments use the same factories. */
export function drawingCommand(w, command, rest) {
    const aliases = { ARC: 'arc', A: 'arc', ARC3P: 'arc', ARCCENTER: 'arc-center', CIRCLE3P: 'circle-3p', CIRCLE2P: 'circle-diameter', ELLIPSE: 'ellipse', EL: 'ellipse', ELLIPSEARC: 'ellipse-arc', SPLINE: 'spline', SPL: 'spline', BEZIER: 'bezier', POLYGON: 'polygon', POINT: 'point', PO: 'point', RAY: 'ray', XLINE: 'xline', XL: 'xline', DONUT: 'donut', SOLID: 'solid', '3DFACE': 'face', HATCH: 'hatch', WIPEOUT: 'wipeout', LEADER: 'leader', MTEXT: 'mtext', DIMALI: 'dim-aligned', DIMLINEAR: 'dim-horizontal', DIMHORIZONTAL: 'dim-horizontal', DIMVERTICAL: 'dim-vertical', DIMRADIUS: 'dim-radius', DIMDIAMETER: 'dim-diameter', DIMANGULAR: 'dim-angular', DIMANGULAR2: 'dim-angular-lines', DIMORDINATEX: 'dim-ordinate-x', DIMORDINATEY: 'dim-ordinate-y' };
    if (command === 'NEXT') { acceptDrawingPoint(w, parseDrawingPoint(rest, w.draft.at(-1), s => w.eval(s))); return true; }
    if (command === 'FINISH') { w.finishPath(); return true; }
    if (command === 'CLOSE') { if (!finishDrawing(w, true)) throw new Error('No closable path is active'); return true; }
    const id = aliases[command]; if (!id) return false;
    if (!rest) { w.setTool(id); return true; }
    const pieces = rest.split(/\s+/), options = { ...defaults, ...w.drawingOptions?.[id] };
    if (id === 'polygon') options.sides = w.eval(pieces.shift());
    const pts = []; for (const piece of pieces) pts.push(parseDrawingPoint(piece, pts.at(-1), s => w.eval(s)));
    const e = createDrawingEntity(id, pts, options, properties(w), w.doc);
    // Exact commands do not destroy an unfinished interactive session on a rejected edit.
    w.edit(command + ' command', () => { w.doc.entities.push(e); w.selection = new Set([e.id]); });
    return true;
}

function planar(e) {
    const n = e.extrusion;
    return !(n && (Math.abs(n.x || 0) > 1e-10 || Math.abs(n.y || 0) > 1e-10 || Math.abs((n.z ?? 1) - 1) > 1e-10));
}
export function nativeGrips(e) {
    if (!planar(e)) return [];
    if (e.type === 'ARC') return [{ ...e.c, key: 'c' }, ...['start', 'end'].map(k => ({ x: e.c.x + e.r * Math.cos(e[k]), y: e.c.y + e.r * Math.sin(e[k]), key: `native:${k}` })), { x: e.c.x + e.r, y: e.c.y, key: 'radius' }];
    if (e.type === 'ELLIPSE') {
        const a = e.major, n = { x: -a.y * e.ratio, y: a.x * e.ratio };
        return [{ ...e.c, key: 'c' }, { x: e.c.x + a.x, y: e.c.y + a.y, key: 'native:major' }, { x: e.c.x + n.x, y: e.c.y + n.y, key: 'native:minor' }];
    }
    if (e.type === 'SPLINE') return (e.controlPoints || []).slice(0, 512).map((p, i) => ({ ...p, key: 'native:control', index: i }));
    if (e.type === 'XLINE' || e.type === 'RAY') return [{ ...e.p, key: 'p' }, { x: e.p.x + e.direction.x * 50, y: e.p.y + e.direction.y * 50, key: 'native:direction' }];
    if (e.type === 'HATCH' && !e.associative && !e.loops?.some(l => l.edges?.length)) return (e.loops || []).flatMap((l, i) => (l.points || []).map((p, j) => ({ ...p, key: 'native:hatch-point', loop: i, index: j }))).slice(0, 512);
    return null;
}
export function changeNativeGrip(e, g, q) {
    if (!g.key.startsWith('native:')) return false;
    if (!planar(e)) throw new Error('Projected OCS geometry has no planar native grips');
    const key = g.key.slice(7);
    if (key === 'start' || key === 'end') { if (distance(e.c, q) < 1e-8) throw new Error('Arc endpoint cannot be its center'); e[key] = Math.atan2(q.y - e.c.y, q.x - e.c.x); }
    else if (key === 'major') { const x = q.x - e.c.x, y = q.y - e.c.y; finite(Math.hypot(x, y), 'major axis', true); e.major = { ...e.major, x, y }; }
    else if (key === 'minor') { const a = e.major, r = Math.abs((q.x - e.c.x) * -a.y + (q.y - e.c.y) * a.x) / (a.x * a.x + a.y * a.y); if (r > 1) throw new Error('Minor radius cannot exceed the major radius'); e.ratio = finite(r, 'minor axis', true); }
    else if (key === 'control') {
        const closed = e.closed && distance(e.controlPoints[0], e.controlPoints.at(-1)) < 1e-8;
        e.controlPoints[g.index] = { ...e.controlPoints[g.index], ...q };
        if (closed && (g.index === 0 || g.index === e.controlPoints.length - 1)) { e.controlPoints[0] = { ...q }; e.controlPoints[e.controlPoints.length - 1] = { ...q }; }
        e.fitPoints = []; // Controls now define the edited spline; stale fit data must not survive.
    } else if (key === 'direction') { const dx = q.x - e.p.x, dy = q.y - e.p.y, l = finite(Math.hypot(dx, dy), 'direction', true); e.direction = { x: dx / l, y: dy / l, z: 0 }; }
    else if (key === 'hatch-point') { e.loops[g.loop].points[g.index] = { ...e.loops[g.loop].points[g.index], ...q }; if (!e.loops[g.loop].points.some(p => p.bulge)) validateBoundary(e.loops[g.loop].points); }
    else throw new Error('Unknown native grip');
    return true;
}
export function renderDrawingInspector(w, e, host) {
    if (!e || w.inspectorTab !== 'properties') return;
    const field = (key, label, value) => `<label class="field"><span>${E(label)}</span><input data-native-prop="${key}" value="${E(value)}" inputmode="decimal"></label>`;
    let fields = '', content = '';
    if (e.type === 'ARC') fields = field('start', 'Start · degrees', number(e.start * 180 / Math.PI)) + field('end', 'End · degrees', number(e.end * 180 / Math.PI));
    if (e.type === 'ELLIPSE') fields = field('majorX', 'Major axis X', number(e.major.x)) + field('majorY', 'Major axis Y', number(e.major.y)) + field('ratio', 'Minor / major', number(e.ratio)) + field('ellipseStart', 'Start parameter · degrees', number((e.start || 0) * 180 / Math.PI)) + field('ellipseEnd', 'End parameter · degrees', number((e.end ?? TAU) * 180 / Math.PI));
    if (e.type === 'RAY' || e.type === 'XLINE') fields = field('directionAngle', 'Direction · degrees', number(Math.atan2(e.direction.y, e.direction.x) * 180 / Math.PI));
    if (e.type === 'MTEXT') fields = `<label class="field full">Multiline content<textarea data-native-prop="mtextContent" rows="4">${E(e.text.replace(/\\P/g, '\n'))}</textarea></label>` + field('mtextWidth', 'Reference-box width', number(e.mtextWidth || 0)) + field('attachment', 'Attachment · 1–9', e.attachment || 1);
    if (e.type === 'LWPOLYLINE') fields = field('constantWidth', 'Constant width', e.constantWidth || 0);
    const hasVertices = ['LWPOLYLINE', 'POLYLINE', 'LEADER', 'SOLID', '3DFACE', 'SPLINE'].includes(e.type);
    if (hasVertices) content = `<p class="muted-note">${e.controlPoints?.length || e.points?.length || 0} ${e.type === 'SPLINE' ? 'native control points; edits preserve knots and weights' : 'native vertices'}. Grip editing and exact coordinates retain the entity type.</p>${action('native-vertices', 'Edit vertices / controls', 'polyline')}`;
    if (e.type === 'CIRCLE' || e.type === 'ELLIPSE' || ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.closed)) content += action('hatch-selection', 'Hatch this boundary', 'hatch');
    if (!fields && !content) return;
    const section = document.createElement('section'); section.className = 'inspector-section native-entity-editor';
    section.innerHTML = `<h3>Native ${E(e.type)} editing</h3><div class="fields">${fields}</div>${content}`; host.append(section);
}
export function nativePropertyChange(w, target) {
    const key = target.dataset.nativeProp;
    if (!key) return false;
    const e = w.selected()[0]; if (!e || w.selection.size !== 1) return true;
    if (isLocked(e, w.doc) || !planar(e)) throw new Error('Unlock and use planar geometry before editing native parameters');
    const v = key === 'mtextContent' ? target.value : finite(w.eval(target.value), key);
    w.edit('Edit native ' + key, () => {
        if (key === 'mtextContent') { if (v.length > 16000) throw new Error('Text is too long'); e.text = v.replace(/\r\n?/g, '\n').replace(/\n/g, '\\P'); }
        else if (key === 'start' || key === 'end') e[key] = v * Math.PI / 180;
        else if (key === 'ellipseStart' || key === 'ellipseEnd') e[key === 'ellipseStart' ? 'start' : 'end'] = v * Math.PI / 180;
        else if (key === 'majorX' || key === 'majorY') { e.major[key === 'majorX' ? 'x' : 'y'] = v; finite(Math.hypot(e.major.x, e.major.y), 'major axis', true); }
        else if (key === 'ratio') { if (v > 1) throw new Error('Ellipse ratio must not exceed 1'); e.ratio = finite(v, 'ratio', true); }
        else if (key === 'directionAngle') e.direction = { x: Math.cos(v * Math.PI / 180), y: Math.sin(v * Math.PI / 180), z: 0 };
        else if (key === 'attachment') { if (!Number.isInteger(v) || v < 1 || v > 9) throw new Error('Attachment must be an integer 1–9'); e.attachment = v; }
        else if (key === 'mtextWidth' || key === 'constantWidth') { if (v < 0) throw new Error('Width cannot be negative'); e[key] = v; }
        else throw new Error('Unknown native property');
        e.dirty = true; w.reroute(new Set([e.id]));
    });
    return true;
}
function editVertices(w) {
    const e = w.selected()[0]; if (!e || isLocked(e, w.doc) || !planar(e)) throw new Error('Select one unlocked planar entity');
    if (e.type === 'POLYLINE' && (e.flags & (16 | 64))) throw new Error('Mesh topology is not editable in the vertex table');
    const controls = e.type === 'SPLINE', points = controls ? e.controlPoints : e.points;
    if (!points?.length || points.length > (controls ? 2048 : 512)) throw new Error('Exact editor supports 512 vertices or 2048 spline controls');
    const rows = points.map((p, i) => `<tr><th>${i + 1}</th><td><input data-vertex="${i}" data-axis="x" aria-label="Point ${i + 1} X" value="${p.x}" inputmode="decimal"></td><td><input data-vertex="${i}" data-axis="y" aria-label="Point ${i + 1} Y" value="${p.y}" inputmode="decimal"></td>${e.type === 'LWPOLYLINE' ? `<td><input data-vertex="${i}" data-axis="bulge" aria-label="Point ${i + 1} bulge" value="${p.bulge || 0}" inputmode="decimal"></td>` : ''}</tr>`).join('');
    w.openModal(controls ? 'Edit native spline control points' : 'Edit native vertices', `<p>Values accept expressions. Point count, Z and topology remain unchanged.</p><div class="native-vertex-scroll"><table><thead><tr><th>#</th><th>X</th><th>Y</th>${e.type === 'LWPOLYLINE' ? '<th>Bulge</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div><div class="error-text"></div>`, { confirm: 'Apply vertices', wide: true, onConfirm: () => {
        const next = clone(points);
        for (const input of w.modal.querySelectorAll('[data-vertex]')) next[+input.dataset.vertex][input.dataset.axis] = finite(w.eval(input.value), 'vertex');
        if (e.type === 'SOLID' || e.type === '3DFACE') {
            const triangle = points.length === 4 && distance(points[2], points[3]) < 1e-8;
            if (triangle && distance(next[3], points[3]) < 1e-8) next[3] = { ...next[2] };
            validateBoundary(next.length === 4 && distance(next[2], next[3]) < 1e-8 ? next.slice(0, 3) : next);
        }
        if (controls && e.closed && distance(points[0], points.at(-1)) < 1e-8 && distance(next[0], next.at(-1)) > 1e-8) {
            const firstChanged=distance(next[0],points[0])>1e-8, lastChanged=distance(next.at(-1),points.at(-1))>1e-8;
            if(firstChanged && lastChanged) throw new Error('Closed spline endpoint controls must coincide');
            if(firstChanged)next[next.length-1]={...next[0]};else next[0]={...next.at(-1)};
        }
        w.edit('Edit native vertices', () => { if (controls) { e.controlPoints = next; e.fitPoints = []; } else e.points = next; e.dirty = true; w.reroute(new Set([e.id])); });
        w.closeModal();
    } });
}
