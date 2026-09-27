import { SpatialPathSession, rayPlane3, beginAxisDrag3, updateAxisDrag3, beginPlaneDrag3, updatePlaneDrag3, layoutHandles3 } from '@conduitcad/manipulation3d';
import { evaluateExpression } from '@conduitcad/constraints';
import { faceFrame3 } from '@conduitcad/modeling';
import { V3, add3, mul3, dot3, cross3, unit3, distance3 } from '@conduitcad/geometry3d';
import { icon } from './icons.js';

const axes = { x: V3(1, 0, 0), y: V3(0, 1, 0), z: V3(0, 0, 1) };
const planes = { XY: { u: axes.x, v: axes.y, normal: axes.z }, XZ: { u: axes.x, v: axes.z, normal: V3(0, -1, 0) }, YZ: { u: axes.y, v: axes.z, normal: axes.x } };
const fmt = n => Number(n.toPrecision(10)).toString();
const b = (id, label, glyph = 'point') => `<button type="button" data-path-command="${id}" aria-label="${label}" title="${label}">${icon(glyph)}<span>${label}</span></button>`;
/** Non-modal native POLYLINE construction/editing on explicit WCS workplanes. */
export class VisualPath3D {
    constructor(m) {
        this.m = m; this.w = m.w; this.session = null; this.frame = 0; this.drag = null; this.nodes = new Map();
        this.root = document.createElement('div'); this.root.className = 'path3d'; this.root.hidden = true;
        this.root.innerHTML = `<div class="path3d-markers"></div><section class="path3d-panel" role="region" aria-label="Spatial path options" hidden>
          <header><strong>Spatial path</strong>${b('options-close', 'Preview model', 'eye')}</header><div class="path3d-panel-body">
          <label>Workplane<select data-path-plane><option>XY</option><option>XZ</option><option>YZ</option><option>View</option><option value="Face" disabled>Picked face</option></select></label>
          <label>Plane offset along normal<input data-path-offset value="0" autocomplete="off" spellcheck="false"></label>${b('face', 'Pick face plane', 'face')}
          <p>Tap to add points. Drag a vertex in the workplane, or use its X/Y/Z handles. Empty-space drag orbits; two fingers navigate.</p>
          <form class="path3d-next"><fieldset><legend>Add an exact WCS point</legend><div>${['x', 'y', 'z'].map(k => `<label>${k.toUpperCase()}<input data-path-next="${k}" value="0" autocomplete="off" spellcheck="false"></label>`).join('')}</div></fieldset><button type="submit">${icon('plus')}Add exact point</button></form>
          <p>Coordinates retain parameter expressions in Conduit metadata. Other DXF readers receive evaluated native vertices. Picked planes are snapshots, not associative face sketches.</p></div></section>
          <section class="path3d-controls" role="region" aria-label="Spatial path editing"><header><strong>${icon('polyline')}Spatial path</strong><span class="path3d-status" role="status"></span></header>
          <div class="path3d-commandbar"><div class="path3d-utilities">${b('add', 'Add points', 'plus')}${b('options', 'Plane / exact point', 'properties')}${b('midpoint', 'Insert midpoint', 'point')}${b('remove', 'Remove vertex', 'trash')}${b('closed', 'Close path', 'polyline')}${b('snap', 'Snap 1', 'snap')}${b('undo', 'Undo draft', 'undo')}${b('redo', 'Redo draft', 'redo')}${b('fit', 'Fit preview', 'fit')}</div><div class="path3d-confirm">${b('cancel', 'Cancel', 'close')}${b('apply', 'Apply', 'check')}</div></div>
          <div class="path3d-coordinates"><label>Vertex<select data-path-vertex aria-label="Active path vertex"></select></label>${['x', 'y', 'z'].map(k => `<label>${k.toUpperCase()}<input data-path-axis="${k}" aria-label="Path vertex ${k.toUpperCase()} expression" autocomplete="off" spellcheck="false"></label>`).join('')}</div><p class="path3d-error" role="alert" hidden></p></section>`;
        m.stage.append(this.root); const opt = { signal: this.w.abort.signal };
        this.root.addEventListener('click', e => this.click(e), opt);
        this.root.addEventListener('input', e => this.input(e), opt);
        this.root.addEventListener('change', e => this.change(e), opt);
        this.root.addEventListener('focusin', e => { if (e.target.matches('[data-path-axis]')) this.focusBefore = this.session?.snapshot(); }, opt);
        this.root.addEventListener('focusout', e => { if (e.target.matches('[data-path-axis]')) this.checkpointInput(); }, opt);
        this.root.querySelector('.path3d-next').addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); this.addExact(); }, opt);
        this.w.root.addEventListener('conduit:documentchange', () => this.cancel(), opt);
        let size = '';
        this.observer = new ResizeObserver(entries => { const r = entries[0].contentRect, key = r.width + ':' + r.height; if (size && key !== size) this.cancelDrag(); size = key; this.updatePositions(); });
        this.observer.observe(m.host);
    }
    get active() { return !!this.session; }
    start(id = null) {
        this.cancel(); this.w.parameters?.cancel(); this.m.inspection.cancel(); this.m.visual.cancel(); this.m.visual.closePalette(); this.w.visual2d.cancel(); this.w.visual2d.panel.close(); this.w.closeModal(); this.w.closePanels(); this.m.input.reset();
        const session = new SpatialPathSession(this.w.doc, { id, layer: this.w.currentLayer });
        this.rejectedFields = new Map(); this.rejected = false; this.session = session; this.initialSelection = new Set(this.w.selection); this.selected = session.state.coordinates.length - 1; this.placing = !id; this.snap = true; this.pickingFace = false; this.plane = planes.XY; this.offset = '0'; this.nodes.clear(); this.handles = [];
        this.root.querySelector('.path3d-markers').replaceChildren(); this.root.querySelector('[data-path-plane]').value = 'XY'; this.root.querySelector('[data-path-offset]').value = '0'; this.root.querySelector('.path3d-panel').hidden = true;
        this.root.hidden = false; this.root.classList.remove('options-open'); this.m.stage.classList.add('path3d-active'); this.lastCount = -1; this.report(); this.preview(true);
        this.root.querySelector('[data-path-command=add]').focus({ preventScroll: true }); return session;
    }
    value(source) { const n = evaluateExpression(source, this.session.base.parameters); if (Math.abs(n) > 1e12) throw new Error('Coordinates must stay within ±1e12'); return n; }
    points() { return this.session.state.coordinates.map(p => ({ x: this.value(p.x), y: this.value(p.y), z: this.value(p.z) })); }
    showOptions(open) { this.root.classList.toggle('options-open', open); this.root.querySelector('.path3d-panel').hidden = !open; this.root.querySelector('[data-path-command=options]').setAttribute('aria-expanded', String(open)); this.updatePositions(); }
    report(message = '') { const e = this.root.querySelector('.path3d-error'); e.textContent = message; e.hidden = !message; }
    reject(error) { if (!this.session) return; this.rejected = true; cancelAnimationFrame(this.frame); this.frame = 0; this.session.invalidate(); this.session.error = error.message; this.m.previewDocument = null; this.m.renderer.setDocument(this.w.doc, { showInputs: this.m.showInputs }); this.m.renderer.invalidate(); this.report(error.message); this.render(); }
    checkpointInput() { if (this.focusBefore && this.session) this.session.checkpoint(this.focusBefore); this.focusBefore = null; }
    preview(immediate = false) {
        if (!this.session || this.rejected) return; cancelAnimationFrame(this.frame); this.frame = 0;
        this.root.querySelector('[data-path-command=apply]').disabled = true;
        const run = () => {
            this.frame = 0; if (!this.session) return;
            if (this.session.source !== this.w.doc || this.session.version !== this.w.doc.version) { this.cancel(); return; }
            try {
                this.value(this.offset);
                const draft = this.session.evaluate(); this.m.previewDocument = draft; this.m.renderer.setDocument(draft, { showInputs: true }); this.report();
            } catch (error) { this.m.previewDocument = null; this.m.renderer.setDocument(this.w.doc, { showInputs: this.m.showInputs }); this.report(this.session.state.coordinates.length < 2 ? 'Tap two points to begin; or add exact WCS coordinates.' : error.message); }
            this.render(); this.m.renderer.invalidate();
        };
        if (immediate) run(); else this.frame = requestAnimationFrame(run);
    }
    render() {
        const s = this.session; if (!s) return; const count = s.state.coordinates.length;
        this.selected = Math.max(-1, Math.min(count - 1, this.selected));
        const selector = this.root.querySelector('[data-path-vertex]');
        if (this.lastCount !== count) { selector.innerHTML = count ? Array.from({ length: count }, (_, i) => `<option value="${i}">${i + 1} / ${count}</option>`).join('') : '<option value="-1">No points</option>'; this.lastCount = count; }
        selector.value = String(this.selected);
        for (const input of this.root.querySelectorAll('[data-path-axis]')) {
            const key = this.selected + ':' + input.dataset.pathAxis; input.disabled = this.selected < 0;
            input.setAttribute('aria-invalid', String(this.rejectedFields.has(key)));
            if (document.activeElement !== input || this.drag) input.value = this.rejectedFields.get(key) ?? (this.selected >= 0 ? String(s.state.coordinates[this.selected][input.dataset.pathAxis]) : '');
        }
        const apply = this.root.querySelector('[data-path-command=apply]'); apply.disabled = this.rejected || !s.preview || s.validatedRevision !== s.revision || !!s.error;
        try { this.value(this.offset); } catch { apply.disabled = true; }
        for (const id of ['undo', 'redo']) this.root.querySelector(`[data-path-command=${id}]`).disabled = !s[id + 'Stack'].length;
        this.root.querySelector('[data-path-command=remove]').disabled = this.selected < 0;
        this.root.querySelector('[data-path-command=midpoint]').disabled = count < 2 || (!s.state.closed && this.selected === count - 1);
        for (const [id, pressed] of [['add', this.placing], ['closed', s.state.closed], ['snap', this.snap]]) this.root.querySelector(`[data-path-command=${id}]`).setAttribute('aria-pressed', String(pressed));
        let length = 0; try { const points = this.points(); points.forEach((p, i) => { if (i) length += distance3(p, points[i - 1]); }); if (s.state.closed && count > 2) length += distance3(points.at(-1), points[0]); } catch {}
        this.root.querySelector('.path3d-status').textContent = this.pickingFace ? 'Tap a planar face' : `${count} points · ${fmt(length)} ${this.w.doc.units} · ${this.placing ? 'tap to add' : 'drag to edit'}`;
        this.updatePositions();
    }
    updatePositions() {
        if (!this.session || !this.m.renderer) return;
        const camera = this.m.camera, stage = this.m.host.getBoundingClientRect(), controls = this.root.querySelector('.path3d-controls').getBoundingClientRect();
        const panel = this.root.querySelector('.path3d-panel'); if (!panel.hidden) panel.style.bottom = Math.ceil(stage.bottom - controls.top + 8) + 'px';
        let points; try { points = this.points(); } catch { points = []; }
        const candidates = [], count = points.length, active = points[this.selected];
        // Bounded handle window; every vertex remains selectable by its native index.
        const indices = Array.from({ length: Math.min(count, 24) }, (_, n) => Math.max(0, Math.min(count - 24, this.selected - 12)) + n);
        for (const i of indices) { const raw = camera.project(points[i]); if (raw.visible) candidates.push({ id: 'p' + i, index: i, point: points[i], raw, ...raw, kind: 'point', label: String(i + 1) }); }
        if (active) {
            const d = camera.height * .13;
            for (const [axis, direction] of Object.entries(axes)) { const point = add3(active, mul3(direction, d)), raw = camera.project(point); if (raw.visible) candidates.unshift({ id: axis, index: this.selected, axis, direction, point, raw, ...raw, kind: 'axis', label: axis.toUpperCase() }); }
        }
        const bottom = Math.min(camera.pixelHeight - 8, controls.top - stage.top - 8), top = Math.min(60, bottom - 44), packed = layoutHandles3(candidates, { width: camera.width, height: camera.pixelHeight, top, bottom, labels: false });
        this.handles = candidates.map((h, i) => ({ ...h, ...packed[i], label: h.label })).filter(h => h.visible);
        const host = this.root.querySelector('.path3d-markers'), alive = new Set(this.handles.map(h => h.id));
        for (const [id, node] of this.nodes) if (!alive.has(id)) { node.remove(); this.nodes.delete(id); }
        for (const h of this.handles) {
            let node = this.nodes.get(h.id);
            if (!node) { node = document.createElement('button'); node.type = 'button'; node.className = 'path3d-handle'; node.dataset.pathHandle = h.id; node.innerHTML = '<span></span>'; this.nodes.set(h.id, node); host.append(node); }
            node.querySelector('span').textContent = h.label; node.classList.toggle('selected', h.index === this.selected); node.dataset.axis = h.axis || '';
            node.style.left = h.x - 22 + 'px'; node.style.top = h.y - 22 + 'px'; node.setAttribute('aria-label', h.axis ? `Move vertex ${h.index + 1} along ${h.label}` : `Path vertex ${h.index + 1}`);
        }
    }
    draw(ctx) {
        if (!this.session) return;
        let points; try { points = this.points(); } catch { return; }
        ctx.save();
        if (this.placing) {
            // A transient plane grid explains where a tap will land; it is not DXF geometry.
            try {
                const camera = this.m.camera, offset = this.value(this.offset), {u,v,normal} = this.plane;
                const step = 10 ** Math.floor(Math.log10(Math.max(camera.height / 10, 1e-8)));
                const center = add3(mul3(normal, offset), add3(mul3(u, Math.round(dot3(camera.target,u)/step)*step), mul3(v, Math.round(dot3(camera.target,v)/step)*step)));
                ctx.lineWidth = 1; ctx.strokeStyle = '#248b7760'; ctx.setLineDash([3,5]);
                for (let i=-6;i<=6;i++) for (const [a,b] of [[u,v],[v,u]]) {
                    const origin = add3(center,mul3(a,i*step)), p=camera.project(add3(origin,mul3(b,-6*step))), q=camera.project(add3(origin,mul3(b,6*step)));
                    if(p.visible&&q.visible){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}
                }
                ctx.setLineDash([]);
            } catch { /* Invalid offsets keep the accepted scene, not an invented plane. */ }
        }
        ctx.lineWidth = 2; ctx.strokeStyle = '#198777'; ctx.fillStyle = '#198777';
        const projected = points.map(p => this.m.camera.project(p));
        for (let i = 1; i < projected.length + (this.session.state.closed && projected.length > 2 ? 1 : 0); i++) { const a = projected[i - 1], b = projected[i % projected.length]; if (a.visible && b.visible) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
        for (const h of this.handles || []) { if (Math.hypot(h.x - h.raw.x, h.y - h.raw.y) > 4) { ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(h.raw.x, h.raw.y); ctx.lineTo(h.x, h.y); ctx.stroke(); } }
        const p = points[this.selected];
        if (p) { const raw = this.m.camera.project(p); for (const h of this.handles.filter(h => h.axis)) if (raw.visible) { ctx.setLineDash([]); ctx.strokeStyle = { x: '#bd655a', y: '#418c65', z: '#517da8' }[h.axis]; ctx.beginPath(); ctx.moveTo(raw.x, raw.y); ctx.lineTo(h.x, h.y); ctx.stroke(); } }
        ctx.restore();
    }
    planeAtPoint(point) { this.offset = fmt(dot3(point, this.plane.normal)); this.root.querySelector('[data-path-offset]').value = this.offset; }
    pointerDown(p) {
        if (!this.session || this.pickingFace || this.rejectedFields.size || p.button !== 0) return false;
        const h = this.handles?.find(h => Math.hypot(h.x - p.x, h.y - p.y) <= 22); if (!h) return false;
        this.checkpointInput(); this.selected = h.index; this.placing = false;
        try {
            const origin = this.points()[h.index]; this.planeAtPoint(origin);
            const motion = h.axis ? beginAxisDrag3(this.m.camera, h.point, h.direction, h.raw) : beginPlaneDrag3(this.m.camera, origin, this.plane.u, this.plane.v, h.raw);
            this.drag = { h, start: p, motion, before: this.session.snapshot(), moved: false, offset: { x: h.raw.x - p.x, y: h.raw.y - p.y } }; this.render();
        } catch (error) { this.report(error.message); this.render(); }
        return true;
    }
    pointerMove(p) {
        const d = this.drag; if (!d || !this.session) return false;
        if (!d.moved && Math.hypot(p.x - d.start.x, p.y - d.start.y) < 5) return true; d.moved = true;
        try {
            const pointer = { x: p.x + d.offset.x, y: p.y + d.offset.y }, snap = n => this.snap && !p.alt ? Math.round(n / (p.shift ? .1 : 1)) * (p.shift ? .1 : 1) : n;
            let delta;
            if (d.h.axis) delta = mul3(d.h.direction, snap(updateAxisDrag3(d.motion, pointer)));
            else { const uv = updatePlaneDrag3(d.motion, pointer); delta = add3(mul3(this.plane.u, snap(uv.u)), mul3(this.plane.v, snap(uv.v))); }
            this.session.drag(d.h.index, delta, d.before); this.rejected = false; this.preview();
        } catch (error) { this.reject(error); }
        return true;
    }
    pointerUp(p) {
        if (!this.drag) return false; this.pointerMove(p); const d = this.drag; this.drag = null;
        if (d.moved) { this.session.checkpoint(d.before); if (!this.session.error) this.preview(true); }
        else { this.render(); if (d.h.axis) this.root.querySelector(`[data-path-axis=${d.h.axis}]`).focus({ preventScroll: true }); }
        return true;
    }
    cancelDrag() { if (this.drag && this.session) { const before = this.drag.before; this.drag = null; this.rejectedFields.clear(); this.rejected = false; this.session.restore(before); this.preview(true); } }
    pickAt(p) {
        if (!this.session) return false;
        try {
            if (this.pickingFace) {
                const hit = this.m.renderer.pick(p.x, p.y, { mode: 'face', radius: 12 }), item = hit && this.m.renderer.scene.items.find(i => i.id === hit.id && i.sourceId === hit.sourceId && i.faces[hit.face]);
                if (!item) throw new Error('Tap a visible planar polygon face');
                const { normal } = faceFrame3(item, hit.face), u = unit3(cross3(Math.abs(normal.z) < .9 ? axes.z : axes.y, normal));
                this.plane = { normal, u, v: unit3(cross3(normal, u)) }; this.planeAtPoint(hit.point); this.root.querySelector('[data-path-plane]').value = 'Face'; this.pickingFace = false; this.report(); this.render(); return true;
            }
            if (!this.placing || this.rejectedFields.size) return true;
            const offset = this.value(this.offset), origin = mul3(this.plane.normal, offset), point = rayPlane3(this.m.camera.ray(p.x, p.y), origin, this.plane.normal);
            if (!point) throw new Error('Workplane is edge-on or behind the camera. Orbit or choose another plane.');
            const snap = n => this.snap && !p.alt ? Math.round(n) : n, u = snap(dot3(point, this.plane.u)), v = snap(dot3(point, this.plane.v));
            this.append(add3(origin, add3(mul3(this.plane.u, u), mul3(this.plane.v, v))));
        } catch (error) { this.report(error.message); }
        return true;
    }
    append(point) { if (this.rejectedFields.size) throw new Error('Repair the rejected coordinate or undo the draft before adding points'); const before = this.session.snapshot(); this.session.insert(this.session.state.coordinates.length, point); this.session.checkpoint(before); this.selected = this.session.state.coordinates.length - 1; this.rejected = false; this.preview(true); }
    addExact() {
        if (!this.session) return;
        try { const point = Object.fromEntries([...this.root.querySelectorAll('[data-path-next]')].map(e => [e.dataset.pathNext, e.value])); for (const value of Object.values(point)) this.value(value); this.append(point); this.placing = false; this.render(); } catch (error) { this.report(error.message); }
    }
    input(e) {
        if (!this.session) return;
        try {
            if (e.target.dataset.pathAxis) { this.session.set(this.selected, e.target.dataset.pathAxis, e.target.value); this.rejectedFields.delete(this.selected + ':' + e.target.dataset.pathAxis); this.rejected = this.rejectedFields.size > 0; this.preview(); }
            if (e.target.matches('[data-path-offset]')) { this.offset = e.target.value; this.value(this.offset); this.rejectedFields.delete('offset'); this.rejected = this.rejectedFields.size > 0; e.target.setAttribute('aria-invalid', 'false'); this.preview(); }
        } catch (error) { this.rejectedFields.set(e.target.dataset.pathAxis ? this.selected + ':' + e.target.dataset.pathAxis : 'offset', e.target.value); e.target.setAttribute('aria-invalid', 'true'); this.reject(error); }
    }
    change(e) {
        if (!this.session) return;
        try {
            if (e.target.matches('[data-path-vertex]')) { this.checkpointInput(); this.selected = Number(e.target.value); this.placing = false; this.render(); }
            if (e.target.matches('[data-path-plane]')) {
                this.cancelDrag(); const value = e.target.value, basis = this.m.camera.basis();
                this.plane = value === 'View' ? { u: basis.right, v: basis.up, normal: unit3(cross3(basis.right, basis.up)) } : planes[value];
                if (!this.plane) throw new Error('Choose XY, XZ, YZ or View'); this.planeAtPoint(this.points()[this.selected] || this.m.camera.target); this.preview(true);
            }
        } catch (error) { this.report(error.message); }
    }
    click(event) {
        const command = event.target.closest('[data-path-command]'), handle = event.target.closest('[data-path-handle]'); if (!command && !handle || !this.session) return;
        event.preventDefault(); event.stopPropagation(); this.checkpointInput();
        try {
            if (handle) { const h = this.handles.find(h => h.id === handle.dataset.pathHandle); if (h) { this.selected = h.index; this.placing = false; this.render(); } return; }
            const id = command.dataset.pathCommand;
            if (id === 'cancel') { this.cancel(); return; } if (id === 'apply') { this.apply(); return; }
            if (id === 'options' || id === 'options-close') { this.showOptions(id === 'options'); return; }
            if (this.rejectedFields.size && !['undo', 'redo', 'fit', 'snap'].includes(id)) { this.report('Repair the rejected coordinate or undo the draft first'); return; }
            this.cancelDrag(); const before = this.session.snapshot();
            if (id === 'add') { this.placing = !this.placing; this.pickingFace = false; this.showOptions(false); }
            if (id === 'face') { this.pickingFace = true; this.showOptions(false); }
            if (id === 'snap') this.snap = !this.snap;
            if (id === 'closed') this.session.setClosed(!this.session.state.closed);
            if (id === 'remove') { this.session.remove(this.selected); this.selected = Math.min(this.selected, this.session.state.coordinates.length - 1); }
            if (id === 'midpoint') {
                const a = this.session.state.coordinates[this.selected], n = (this.selected + 1) % this.session.state.coordinates.length, next = this.session.state.coordinates[n];
                if (!a || !next || !this.session.state.closed && !n) throw new Error('Select a vertex with a following segment');
                const point = Object.fromEntries(['x', 'y', 'z'].map(k => [k, `((${a[k]}) + (${next[k]})) / 2`])); this.session.insert(this.selected + 1, point); this.selected++;
            }
            if (id === 'fit') { const points = this.points(); if (points.length) { this.m.camera.fit(points); this.m.changedView(); } }
            if (id === 'undo' || id === 'redo') { this.session[id](); this.rejectedFields.clear(); this.rejected = false; } else this.session.checkpoint(before);
            this.render(); this.preview(true);
        } catch (error) { this.report(error.message); }
    }
    apply() {
        const s = this.session; if (!s || this.applying || this.rejected) return; this.checkpointInput(); this.cancelDrag(); this.preview(true);
        if (!s.preview || s.error || this.root.querySelector('[data-path-command=apply]').disabled) return;
        try { s.assertSource(this.w.doc); if (s.changed) { this.applying = true; this.w.edit(s.creation ? 'Create spatial path' : 'Edit spatial path', () => { s.commit(this.w.doc); this.w.selection = new Set([s.id]); }); } this.finish(); }
        catch (error) { this.report(error.message); if (s.source !== this.w.doc) this.finish(); } finally { this.applying = false; }
    }
    finish() {
        if (!this.session) return; cancelAnimationFrame(this.frame); this.frame = 0; this.drag = null; this.focusBefore = null; this.session.cancel(); this.session = null;
        this.m.previewDocument = null; this.root.hidden = true; this.m.stage.classList.remove('path3d-active'); this.m.renderer.setDocument(this.w.doc, { showInputs: this.m.showInputs }); this.m.sync(); this.w.updateSelection(); this.m.host.focus({ preventScroll: true });
    }
    cancel() { if (this.applying || !this.session) return; if (this.session.source === this.w.doc) this.w.selection = new Set(this.initialSelection); this.finish(); }
    beforeEdit() { this.cancel(); }
    externalChange() { if (this.session && !this.applying && (this.session.source !== this.w.doc || this.session.version !== this.w.doc.version || this.w.viewMode !== '3d')) this.cancel(); }
    keyDown(e) {
        if (!this.active) return false;
        if (e.key === 'Escape') { e.preventDefault(); if (this.drag) this.cancelDrag(); else if (this.pickingFace) { this.pickingFace = false; this.render(); } else if (this.focusBefore) { this.rejectedFields.delete(this.selected + ':' + e.target.dataset.pathAxis); this.rejected = this.rejectedFields.size > 0; this.session.restore(this.focusBefore); this.focusBefore = null; e.target.blur(); this.preview(true); } else if (!this.root.querySelector('.path3d-panel').hidden) this.showOptions(false); else this.cancel(); return true; }
        if (e.target.closest('input,textarea,select')) return false;
        const h = this.handles?.find(h => h.id === e.target.dataset.pathHandle);
        if (h && !this.rejectedFields.size && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            e.preventDefault(); const amount = (['ArrowLeft', 'ArrowDown'].includes(e.key) ? -1 : 1) * (e.shiftKey ? .1 : 1), direction = h.axis ? h.direction : ['ArrowLeft', 'ArrowRight'].includes(e.key) ? this.plane.u : this.plane.v, before = this.session.snapshot();
            try { this.session.drag(h.index, mul3(direction, amount), before); this.session.checkpoint(before); this.preview(true); } catch (error) { this.report(error.message); } return true;
        }
        if ((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase())) { e.preventDefault(); this.cancelDrag(); this.rejectedFields.clear(); this.rejected = false; this.session[e.shiftKey || e.key.toLowerCase() === 'y' ? 'redo' : 'undo'](); this.preview(true); return true; }
        if (e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); this.apply(); return true; }
        if (!e.ctrlKey && !e.metaKey && (e.key.length === 1 || ['Delete', 'Backspace'].includes(e.key))) return true;
        return false;
    }
    dispose() { this.cancel(); this.observer.disconnect(); this.root.remove(); }
}
