import { fields3, openOperation3, readOperation3, selectionToolbar3, syncAuthoring3, authoringAction3 } from './authoring-workbench.js';
import { V3, add3, sub3, mul3, dot3, unit3, distance3, bounds3, meshProperties, validateMesh, triangles3 } from '@conduitcad/geometry3d';
import { MODELING_TOOLS, EXAMPLES_3D, create3DExample, addFeature, editFeature, removeFeature, bakeFeature, regenerateFeatures, sectionEntities, writeOBJ, writeSTL, controlPoints3, setControlPoint3 } from '@conduitcad/modeling';
import { SpatialRenderer, OrbitCamera } from '@conduitcad/renderer3d';
import { entity, clone, polyline, circle, isLocked } from '@conduitcad/model';
import { PointerController } from '@conduitcad/input';
import { downloadFile } from '@conduitcad/storage';
import { escapeHTML as E, icon, commandButton, entityIcon } from './icons.js';
import { EXAMPLE_ICONS } from './icon-map.js';
import { iconPreferencesMarkup } from './iconography.js';
const button = (action, label, cls = '', glyph = '') => commandButton(action,label,cls,'',glyph);
const format = n => Number.isFinite(n) ? Number(n.toPrecision(7)).toString() : '—';
const fields = fields3;
function xyz(source, evaluate) { const parts = []; let depth = 0, from = 0; for (let i = 0; i < source.length; i++) {
    if (source[i] === '(')
        depth++;
    if (source[i] === ')')
        depth--;
    if (source[i] === ',' && depth === 0) {
        parts.push(source.slice(from, i));
        from = i + 1;
    }
} parts.push(source.slice(from)); if (parts.length !== 3 || parts.some(s => !s.trim()) || depth)
    throw new Error('Enter exactly three expressions: X, Y, Z'); return V3(...parts.map(evaluate)); }
export class ModelingWorkbench {
    constructor(workbench) {
        this.w = workbench;
        this.camera = new OrbitCamera();
        this.active = false;
        this.showInputs = false;
        this.pickMode = 'body';
        this.navigation = 'orbit';
        this.rollback = null;
        this.disposed = false;
        this.stage = document.createElement('div');
        this.stage.className = 'model3d-stage';
        this.stage.hidden = true;
        this.stage.innerHTML = `<div class="viewport3d" tabindex="0" role="application" aria-label="3D CAD model. Drag to orbit, two fingers to pan and zoom; tap to select."></div><div class="model3d-top"><div class="model3d-mode"><span class="pill">3D MODEL</span><span class="model3d-backend">Initializing</span></div><div class="model3d-views" role="toolbar" aria-label="3D camera views">${button('3d-2d', '2D Draw')}${button('3d-view-iso', 'ISO')}${button('3d-view-top', 'Top')}${button('3d-view-front', 'Front')}${button('3d-view-right', 'Right')}${button('3d-fit', 'Fit')}${button('3d-view-options', 'View…')}</div></div>${selectionToolbar3()}<div class="model3d-info" role="status" aria-live="polite"></div><div class="model3d-bottom"><div class="model3d-context" role="toolbar" aria-label="Actions for selected 3D geometry"></div><div class="model3d-timeline" role="toolbar" aria-label="3D feature history"></div><div class="model3d-dock" role="toolbar" aria-label="3D modeling tools">${button('3d-tools', 'Create')}${button('3d-edit', 'Edit feature')}${button('3d-op-transform', 'Move / rotate')}${button('3d-bodies', 'Bodies')}${button('3d-measure', 'Inspect')}${button('3d-examples', 'Examples')}${button('3d-undo', 'Undo')}${button('3d-redo', 'Redo')}</div><p class="model3d-hint">Drag to orbit · two fingers pan / pinch · tap to select · axis handles move a body</p></div>`;
        const dock = this.stage.querySelector('.model3d-dock');
        dock.insertBefore(this.stage.querySelector('.model3d-context'), dock.children[1]);
        workbench.$('.canvas-area').append(this.stage);
        this.stage.querySelector('.model3d-timeline').addEventListener('dblclick', event => { if (event.target.closest('[data-action^="3d-select:"]')) this.action('3d-edit').catch(error => workbench.toast(error.message, true)); }, { signal: workbench.abort.signal });
        this.stage.querySelector('.model3d-timeline').addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            const items = [...this.stage.querySelectorAll('.model3d-feature')], index = items.indexOf(document.activeElement);
            if (index < 0) return;
            event.preventDefault(); event.stopPropagation();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
            items[next]?.focus({ preventScroll: true }); items[next]?.scrollIntoView({ block:'nearest', inline:'nearest' });
        }, { signal: workbench.abort.signal });
        this.host = this.stage.querySelector('.viewport3d');
        this.input = new PointerController(this.host, { down: p => this.pointerDown(p), move: p => this.pointerMove(p), up: p => this.pointerUp(p), cancel: () => this.cancelDrag(), gesture: ({ scale, dx, dy }) => { this.camera.zoom(scale); this.camera.pan(dx, dy); this.changedView(); }, gestureEnd: () => this.saveView(), wheel: p => { this.camera.zoom(Math.exp(-p.deltaY * .0015)); this.changedView(); this.saveView(); } });
        this.host.addEventListener('dblclick', () => this.fitSelection(), { signal: workbench.abort.signal });
        this.host.addEventListener('dragover', e => e.preventDefault(), { signal: workbench.abort.signal });
        this.host.addEventListener('drop', e => { e.preventDefault(); workbench.openFiles([...e.dataTransfer.files]); }, { signal: workbench.abort.signal });
        this.ready = Promise.resolve();
    }
    ensureRenderer() { if (this.renderer)
        return; const w = this.w, requested = w.options.backend3d || new URLSearchParams(location.search).get('renderer3d') || 'auto'; this.renderer = new SpatialRenderer(this.host, { backend: requested, camera: this.camera, onStatus: s => { this.stage.querySelector('.model3d-backend').textContent = s.backend; this.stage.querySelector('.model3d-backend').title = (s.reasons || []).join('\n'); } }); this.renderer.drawOverlay = (ctx, camera) => this.drawGizmo(ctx, camera); this.renderer.onFrame = s => { if (!this.active)
        return; w.$('.stats').textContent = `${s.triangles.toLocaleString()} triangles · ${s.frameMs.toFixed(1)} ms CPU`; }; this.ready = this.renderer.ready.then(() => { if (this.disposed)
        return; this.renderer.setDocument(w.doc, { showInputs: this.showInputs }); this.renderer.resize(); if (!w.model3dCamera)
        this.renderer.fit();
    else
        this.restoreView(); this.renderer.setSelection(w.selection, this.pickMode === 'face' ? this.hit : null); this.saveView(); }); }
    setActive(active) {
        const w = this.w;
        if (active && (w.doc.activeLayout || 'Model') !== 'Model')
            throw new Error('Choose Model space before entering 3D');
        w.input?.reset();
        this.input.reset();
        if (active) {
            w.closePanels();
            w.cancelGesture();
        }
        w.viewMode = active ? '3d' : '2d';
        this.sync();
        w.renderInspector();
        w.scheduleRecovery();
        return this.ready;
    }
    restoreView() { const s = this.w.model3dCamera; if (!s)
        return; const values = [s.yaw, s.pitch, s.distance, s.height, s.target?.x, s.target?.y, s.target?.z]; if (values.every(Number.isFinite) && s.distance > 0 && s.height > 0) {
        Object.assign(this.camera, s, { target: { ...s.target }, pitch: Math.max(-Math.PI / 2 + 1e-6, Math.min(Math.PI / 2 - 1e-6, s.pitch)) });
    } }
    saveView() { if (!this.active)
        return; this.w.model3dCamera = this.camera.snapshot(); this.w.scheduleRecovery(); }
    changedView() { this.renderer?.invalidate(); this.w.model3dCamera = this.camera.snapshot(); }
    sync() {
        const w = this.w, active = w.viewMode === '3d' && (w.doc.activeLayout || 'Model') === 'Model';
        this.active = active;
        this.stage.hidden = !active;
        w.$('.canvas-area').dataset.view = active ? '3d' : '2d';
        w.$('.viewport').inert = active;
        w.$('[data-action="mode-3d"]')?.classList.toggle('active', active);
        w.$('[data-action="mode-3d"]')?.setAttribute('aria-pressed', String(active));
        if (!active) {
            if (this.renderer)
                this.renderer.active = false;
            return;
        }
        this.ensureRenderer();
        this.renderer.active = true;
        const docChanged = this.document !== w.doc;
        if (docChanged) {
            this.document = w.doc;
            this.previewDocument = null;
            this.rollback = null;
            this.hit = null;
            this.renderer.marker = null;
            this.renderer.section = null;
            this.restoreView();
        }
        this.renderer.setDocument(this.previewDocument || w.doc, { showInputs: this.showInputs });
        this.renderer.setSelection(w.selection, this.pickMode === 'face' ? this.hit : null);
        this.renderer.resize();
        if (docChanged && !w.model3dCamera)
            this.renderer.fit();
        this.stage.querySelector('.model3d-info').textContent = this.renderer.scene.diagnostics.length ? `${this.renderer.scene.diagnostics.length} spatial display notice(s) · Inspect for details` : this.previewDocument ? 'PREVIEW · not committed' : `${w.doc.entities.filter(e => e.type === 'MESH' && !e.model3dConsumed && !e.feature3d?.suppressed && !e.hidden).length} visible mesh bodies`;
        this.syncTimeline();
        syncAuthoring3(this);
        this.stage.querySelector('[data-action="3d-undo"]').disabled = !w.history.canUndo;
        this.stage.querySelector('[data-action="3d-redo"]').disabled = !w.history.canRedo;
    }
    syncTimeline() {
        const w = this.w;
        const timeline = this.stage.querySelector('.model3d-timeline');
        const timelineHTML = w.doc.entities.filter(e => e.feature3d).map((e, i) => button('3d-select:' + e.id, `${i + 1} ${e.label || e.feature3d.kind}`, `model3d-feature ${w.selection.has(e.id) ? 'active' : ''} ${e.feature3d.suppressed ? 'suppressed' : ''}`, entityIcon(e))).join('') || '<span class="quiet">Create a primitive or extrude a 2D profile to begin feature history.</span>';
        const timelineKey = JSON.stringify([w.doc.id, w.doc.entities.filter(e => e.feature3d).map(e => [e.id, e.label, e.feature3d.kind, !!e.feature3d.suppressed, w.selection.has(e.id)])]);
        if (timeline.dataset.key !== timelineKey) {
            timeline.dataset.key = timelineKey;
            const left = timeline.scrollLeft, focus = document.activeElement?.closest('.model3d-feature')?.dataset.action;
            timeline.innerHTML = timelineHTML; timeline.scrollLeft = left;
            if (focus) [...timeline.children].find(el => el.dataset.action === focus)?.focus({ preventScroll: true });
        }
        for (const item of timeline.querySelectorAll('.model3d-feature')) item.setAttribute('aria-pressed', String(item.classList.contains('active')));
        const selectedKey = [...w.selection].join('|');
        if (selectedKey !== this.lastTimelineSelection) {
            this.lastTimelineSelection = selectedKey;
            const active = timeline.querySelector('.active');
            if (active) { const a = active.getBoundingClientRect(), b = timeline.getBoundingClientRect(); if (a.left < b.left) timeline.scrollLeft += a.left - b.left; else if (a.right > b.right) timeline.scrollLeft += a.right - b.right; }
        }
    }
    selectionChanged() { if (!this.active)
        return; this.renderer?.setSelection(this.w.selection, this.pickMode === 'face' ? this.hit : null); this.syncTimeline(); syncAuthoring3(this); }
    clearPreview() { const preview = !!this.previewDocument; this.previewDocument = null; this.operation = null; if (this.previewCamera) {
        Object.assign(this.camera, this.previewCamera);
        this.previewCamera = null;
    } if (preview && this.active)
        this.sync(); }
    selectionCenter() { const points = this.renderer?.scene.items.filter(i => this.w.selection.has(i.id)).flatMap(i => i.points) || []; if (!points.length)
        return null; const b = bounds3(points); return mul3(add3(b.min, b.max), .5); }
    gizmo() { const origin = this.selectionCenter(); if (!origin || this.w.selection.size !== 1 || this.pickMode !== 'body')
        return []; if (isLocked(this.w.selected()[0], this.w.doc))
        return []; const length = this.camera.height * .15; return [V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)].map((axis, i) => ({ origin, axis, label: ['X', 'Y', 'Z'][i], color: ['#c46655', '#448f71', '#4d81b8'][i], a: this.camera.project(origin), b: this.camera.project(add3(origin, mul3(axis, length))) })); }
    drawGizmo(ctx) { for (const g of this.gizmo()) {
        if (!g.a.visible || !g.b.visible)
            continue;
        ctx.strokeStyle = g.color;
        ctx.fillStyle = g.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(g.a.x, g.a.y);
        ctx.lineTo(g.b.x, g.b.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(g.b.x, g.b.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 12px system-ui';
        ctx.fillText(g.label, g.b.x + 8, g.b.y - 4);
    } }
    axisParameter(p, axis, origin) { const r = this.camera.ray(p.x, p.y), o = sub3(r.origin, origin), ad = dot3(axis, r.direction), den = 1 - ad * ad; if (den < 1e-8)
        throw new Error('This axis is parallel to the camera; use exact coordinates or orbit first'); return (dot3(axis, o) - ad * dot3(r.direction, o)) / den; }
    pointerDown(p) { this.navigating = false; this.start = { ...p }; this.last = { ...p }; this.drag = null; for (const g of this.gizmo()) {
        const dx = g.b.x - g.a.x, dy = g.b.y - g.a.y, den = dx * dx + dy * dy, t = den ? ((p.x - g.a.x) * dx + (p.y - g.a.y) * dy) / den : 0;
        if (t > .2 && t < 1.25 && Math.hypot(g.a.x + dx * t - p.x, g.a.y + dy * t - p.y) < 12) {
            try {
                this.drag = { axis: g.axis, origin: g.origin, start: this.axisParameter(p, g.axis, g.origin), id: [...this.w.selection][0], delta: 0 };
            }
            catch (error) {
                this.w.toast(error.message, true);
            }
            break;
        }
    } }
    pointerMove(p) {
        if (!this.start)
            return;
        if (!this.drag && !this.navigating && Math.hypot(p.x - this.start.x, p.y - this.start.y) < 7) return;
        this.navigating = true;
        const dx = p.x - this.last.x, dy = p.y - this.last.y;
        this.last = p;
        if (this.drag) {
            try {
                this.drag.delta = this.axisParameter(p, this.drag.axis, this.drag.origin) - this.drag.start;
                const draft = { ...this.w.doc, entities: clone(this.w.doc.entities) };
                const e = draft.entities.find(e => e.id === this.drag.id);
                if (e.type !== 'MESH')
                    throw new Error('Axis handles currently move mesh bodies; use exact XYZ editing for spatial curves');
                addFeature(draft, 'transform', { dx: this.drag.axis.x * this.drag.delta, dy: this.drag.axis.y * this.drag.delta, dz: this.drag.axis.z * this.drag.delta }, [e.id], { name: 'Move preview', color: e.color });
                this.previewDocument = draft;
                this.renderer.setDocument(draft, { showInputs: this.showInputs });
            }
            catch (error) {
                this.w.toast(error.message, true);
                this.cancelDrag();
            }
            return;
        }
        if (this.navigation === 'pan' || p.button === 1 || p.shift)
            this.camera.pan(dx, dy);
        else
            this.camera.orbit(dx, dy);
        this.changedView();
    }
    pointerUp(p) {
        const start = this.start, drag = this.drag;
        this.start = null;
        this.drag = null;
        if (drag) {
            this.previewDocument = null;
            if (Math.abs(drag.delta) > 1e-9) {
                let result;
                try {
                    this.w.edit('Move 3D body', () => { const e = this.w.doc.entities.find(e => e.id === drag.id); result = addFeature(this.w.doc, 'transform', { dx: drag.axis.x * drag.delta, dy: drag.axis.y * drag.delta, dz: drag.axis.z * drag.delta }, [e.id], { name: 'Move ' + (e.label || 'body'), color: e.color }); this.w.selection = new Set([result.id]); });
                }
                catch (error) {
                    this.w.toast(error.message, true);
                }
            }
            this.sync();
            this.saveView();
            return;
        }
        if (start && !this.navigating && Math.hypot(p.x - start.x, p.y - start.y) < 7) {
            this.hit = this.renderer.pick(p.x, p.y, { mode: this.pickMode, radius: p.pointerType === 'touch' ? 18 : 9 });
            if (!this.w.multi && !p.ctrl && !p.shift)
                this.w.selection.clear();
            if (this.hit) {
                if (this.w.selection.has(this.hit.id))
                    this.w.selection.delete(this.hit.id);
                else
                    this.w.selection.add(this.hit.id);
                this.renderer.marker = this.hit.point;
            }
            else
                this.renderer.marker = null;
            this.w.updateSelection();
            this.sync();
        }
        this.saveView();
    }
    cancelDrag() { this.start = null; this.drag = null; if (this.previewDocument && !this.operation) {
        this.previewDocument = null;
        if (this.active && this.renderer)
            this.renderer.setDocument(this.w.doc, { showInputs: this.showInputs });
    } }
    fitSelection() { const points = this.renderer.scene.items.filter(i => this.w.selection.has(i.id)).flatMap(i => i.points); if (points.length)
        this.camera.fit(points);
    else
        this.renderer.fit(); this.changedView(); this.saveView(); }
    async action(action) {
        const w = this.w;
        if (action === 'mode-3d') {
            await this.setActive(true);
            return;
        }
        if (action === '3d-examples') {
            this.examplesDialog();
            return;
        }
        if (action.startsWith('3d-example:')) {
            const doc = create3DExample(action.slice(11));
            w.openDocument(doc, { context: { viewMode: '3d', currentLayer: 'Annotations' } });
            w.model3dCamera = null;
            await this.setActive(true);
            this.renderer.fit();
            this.saveView();
            return;
        }
        if (!this.active)
            await this.setActive(true);
        if (authoringAction3(this, action)) return;
        if (action.startsWith('3d-op-')) {
            this.operationDialog(action.slice(6));
            return;
        }
        if (action.startsWith('3d-view-') && action !== '3d-view-options') {
            this.camera.view(action.slice(8));
            this.changedView();
            this.saveView();
            return;
        }
        if (action.startsWith('3d-select:')) {
            const id = action.slice(10);
            w.selection = new Set([id]);
            this.hit = null;
            w.updateSelection();
            this.sync();
            return;
        }
        switch (action) {
            case '3d-tools':
                this.toolsDialog();
                break;
            case '3d-fit':
                this.renderer.fit();
                this.saveView();
                break;
            case '3d-view-options':
                this.viewDialog();
                break;
            case '3d-edit': {
                const e = w.selected()[0];
                if (e?.feature3d)
                    this.operationDialog(e.feature3d.kind, e.id);
                else
                    this.vertexDialog();
                break;
            }
            case '3d-preview':
                this.previewOperation();
                break;
            case '3d-bodies':
                w.inspectorTab = 'properties';
                w.openPanel('inspector');
                w.renderInspector();
                break;
            case '3d-measure':
                this.measureDialog();
                break;
            case '3d-multi':
                w.multi = !w.multi;
                this.renderInspector();
                syncAuthoring3(this);
                break;
            case '3d-bake': {
                const e = w.selected()[0];
                if (!e)
                    throw new Error('Select a body');
                w.ask('Detach feature history', [{ name: 'confirm', label: 'Type BAKE to retain geometry but detach this feature', value: '' }], v => { if (v.confirm !== 'BAKE')
                    throw new Error('Type BAKE to confirm'); w.edit('Bake 3D feature', () => bakeFeature(w.doc, e.id)); });
                break;
            }
            case '3d-suppress': {
                const e = w.selected()[0];
                if (!e?.feature3d)
                    throw new Error('Select a feature');
                w.edit('Suppress / restore feature', () => editFeature(w.doc, e.id, { suppressed: !e.feature3d.suppressed }));
                break;
            }
            case '3d-remove': {
                const e = w.selected()[0];
                if (!e)
                    throw new Error('Select a feature');
                w.edit('Remove feature', () => removeFeature(w.doc, e.id));
                w.selection.clear();
                w.updateSelection();
                break;
            }
            case '3d-inputs':
                this.showInputs = !this.showInputs;
                this.sync();
                this.renderInspector();
                break;
            case '3d-vertex':
                this.vertexDialog();
                break;
            case '3d-appearance':
                this.appearanceDialog();
                break;
            case '3d-sketch':
                this.sketchDialog();
                break;
            case '3d-path':
                this.pathDialog();
                break;
            case '3d-section':
                this.sectionDialog();
                break;
            case '3d-obj':
                this.exportMesh('obj');
                break;
            case '3d-stl':
                this.exportMesh('stl');
                break;
            case '3d-2d':
                w.setTool('select');
                break;
            case '3d-undo':
                w.history.undo();
                this.sync();
                break;
            case '3d-redo':
                w.history.redo();
                this.sync();
                break;
            default: throw new Error('Unknown 3D action ' + action);
        }
    }
    examplesDialog() { const w = this.w; w.openModal('New 3D example drawing', `<p>Each example opens in a new document tab. Native meshes, source sketches and editable feature parameters are included. These are faceted concept models, not certified designs.</p><div class="model3d-example-grid">${EXAMPLES_3D.map((e, i) => `<button class="model3d-example" data-action="3d-example:${e.id}"><span class="model3d-example-icon">${icon(EXAMPLE_ICONS[e.id] || 'file-3d')}</span><span><small>${E(e.industry)}</small><strong>${E(e.name)}</strong><span>${E(e.description)}</span></span></button>`).join('')}</div>`, { wide: true }); }
    toolsDialog() { const w = this.w; w.openModal('3D modeling tools', `${iconPreferencesMarkup()}<p>Create mesh features or use selected profiles and bodies. Source order matters for cuts and sweeps. New results retain their dependency history.</p><label class="field">Find a tool<input id="model3d-search" type="search" placeholder="Extrude, revolve, pattern, vertex…"></label>${[...new Set(MODELING_TOOLS.map(t => t.group))].map(group => `<section><h3>${E(group)}</h3><div class="operation-grid">${MODELING_TOOLS.filter(t => t.group === group).map(t => button('3d-op-' + t.id, t.label, 'btn model3d-searchable')).join('')}</div></section>`).join('')}<h3>Sketch, inspect & exchange</h3><div class="operation-grid">${[['3d-sketch', 'Planar profile'], ['3d-path', '3D polyline'], ['3d-vertex', 'Exact XYZ vertices'], ['3d-section', 'Section analysis'], ['3d-measure', 'Measure & topology'], ['3d-obj', 'Export OBJ'], ['3d-stl', 'Export STL'], ['3d-examples', 'Example drawings'], ['3d-2d', 'Edit sketch in 2D']].map(([a, l]) => button(a, l, 'btn model3d-searchable')).join('')}</div>`, { wide: true }); w.modal.querySelector('#model3d-search').addEventListener('input', e => { const words = e.target.value.toLowerCase().split(/\s+/); for (const b of w.modal.querySelectorAll('.model3d-searchable'))
        b.hidden = !words.every(word => b.textContent.toLowerCase().includes(word)); }); }
    operationDialog(kind, id = null) { return openOperation3(this, kind, id); }
    readOperation() { return readOperation3(this); }
    previewOperation() { if (!this.operation)
        throw new Error('No active operation'); const v = this.readOperation(), doc = { ...this.w.doc, entities: clone(this.w.doc.entities) }; try {
        if (this.operation.id)
            editFeature(doc, this.operation.id, v);
        else
            addFeature(doc, this.operation.kind, v.parameters, v.inputs, { name: v.name });
        if (!this.previewCamera)
            this.previewCamera = this.camera.snapshot();
        this.previewDocument = doc;
        this.renderer.setDocument(doc, { showInputs: this.showInputs });
        this.renderer.fit();
        this.w.modal.querySelector('.model3d-preview-state').textContent = 'Preview shown behind this dialog. The document is unchanged.';
    }
    catch (error) {
        const operation = this.operation; this.clearPreview(); this.operation = operation;
        this.w.modal.querySelector('.model3d-preview-state').textContent = 'Preview rejected · drawing unchanged';
        this.w.modal.querySelector('.error-text').textContent = error.message;
    } }
    renderInspector() {
        if (!this.active)
            return false;
        const w = this.w, selected = w.selected(), e = selected[0];
        let report = '';
        if (e?.type === 'MESH')
            try {
                const p = meshProperties(e);
                report = `<dl class="model3d-properties"><dt>${icon('mesh')}Vertices / faces</dt><dd>${p.vertices} / ${p.faces}</dd><dt>${icon('area')}Surface area</dt><dd>${format(p.area)} ${E(w.doc.units)}²</dd><dt>${icon('volume')}Volume</dt><dd>${p.closed ? format(p.volume) + ' ' + E(w.doc.units) + '³' : 'Open / non-manifold'}</dd><dt>${icon('boundary')}Boundary edges</dt><dd>${p.boundaryEdges}</dd></dl>`;
            }
            catch (error) {
                report = `<p class="error-text">${E(error.message)}</p>`;
            }
        w.$('.inspector-content').innerHTML = `<h3 class="icon-heading">${icon(e ? entityIcon(e) : 'bodies')}${E(e?.label || e?.type || '3D design')}</h3><p class="muted-note">${selected.length ? selected.length + ' selected. ' + (this.hit?.vertex !== undefined ? 'Vertex ' + this.hit.vertex : this.hit?.face !== undefined ? 'Face ' + this.hit.face : 'Body selection') : 'Tap geometry to select. Drag empty space to orbit.'}</p>${report}<div class="model3d-inspector-actions">${button('3d-edit', 'Edit feature / geometry', 'btn primary')}${button('3d-appearance', 'Appearance / layer', 'btn')}${button('3d-vertex', 'Exact XYZ vertices', 'btn')}${button('3d-op-offset-face', 'Press / pull face', 'btn')}${button('3d-multi', w.multi ? 'Multi-select: on' : 'Multi-select: off', 'btn')}${button('3d-view-options', 'Selection & view options', 'btn')}${e?.feature3d ? button('3d-suppress', e.feature3d.suppressed ? 'Restore feature' : 'Suppress feature', 'btn', e.feature3d.suppressed ? 'play' : 'feature-off') + button('3d-bake', 'Detach feature history…', 'btn') + button('3d-remove', 'Delete (guard dependents)', 'btn danger') : ''}</div><h3>Bodies & source sketches</h3>${button('3d-inputs', this.showInputs ? 'Hide consumed inputs' : 'Show consumed inputs', 'btn', this.showInputs ? 'eye-off' : 'inputs')}<div class="model3d-body-list">${w.doc.entities.filter(e => e.feature3d || ['MESH', 'POLYLINE', 'LWPOLYLINE', 'CIRCLE', 'ELLIPSE', 'SPLINE', 'INSERT'].includes(e.type)).slice(0, 256).map(e => button('3d-select:' + e.id, (e.label || e.type), `${w.selection.has(e.id) ? 'active' : ''} ${e.model3dConsumed ? 'consumed' : ''} ${e.feature3d?.suppressed ? 'suppressed' : ''}`, e.feature3d?.suppressed ? 'feature-off' : entityIcon(e))).join('')}</div><p class="muted-note">Consumed source geometry remains in the document. Hidden bodies and complex features can be selected here.</p>`;
        return true;
    }
    vertexDialog() {
        const w = this.w, e = w.selected()[0];
        if (e && isLocked(e, w.doc))
            throw new Error('The selected entity is locked');
        if (!e)
            throw new Error('Select a spatial curve or mesh first');
        if (e.type === 'INSERT') {
            w.ask('Move native block insert in OCS', [{ name: 'xyz', label: 'Insertion X, Y, Z in OCS', value: [e.x || 0, e.y || 0, e.z || 0].join(', ') }], values => { const p = xyz(values.xyz, s => w.eval(s)); w.edit('Move spatial insert', () => { const target = w.doc.entities.find(q => q.id === e.id); if (target.attributes?.length)
                throw new Error('Moving attributed inserts in 3D requires attribute-frame regeneration; no edit was applied'); target.x = p.x; target.y = p.y; target.z = p.z; }); });
            return;
        }
        const points = controlPoints3(e);
        if (!points?.length)
            throw new Error('This entity has no supported direct spatial vertices');
        const initial = Math.min(this.hit?.vertex ?? 0, points.length - 1);
        w.openModal('Exact XYZ vertex editing', `<p>${E(e.type)} · ${points.length} WCS points. ${e.feature3d ? 'Applying detaches this body’s feature definition. Downstream dependencies keep its identity.' : ''} Mesh polygon faces are triangulated before direct deformation.</p>${fields([{ name: 'index', label: 'Vertex index · zero based', value: initial }, { name: 'xyz', label: 'X, Y, Z · expressions', value: [points[initial].x, points[initial].y, points[initial].z || 0].join(', ') }])}<p class="muted-note">Choose any valid index, including points beyond the preview table.</p><div class="model3d-vertex-table"><table><thead><tr><th>Index</th><th>X</th><th>Y</th><th>Z</th></tr></thead><tbody>${points.slice(0, 64).map((p, i) => `<tr><td>${i}</td><td>${format(p.x)}</td><td>${format(p.y)}</td><td>${format(p.z || 0)}</td></tr>`).join('')}</tbody></table></div><div class="error-text"></div>`, { confirm: e.feature3d ? 'Detach and apply' : 'Apply coordinates', onConfirm: () => { const values = Object.fromEntries([...w.modal.querySelectorAll('[data-model-field]')].map(el => [el.dataset.modelField, el.value])), index = w.eval(values.index), p = xyz(values.xyz, s => w.eval(s)); if (!Number.isInteger(index) || index < 0 || index >= points.length)
                throw new Error('Vertex index is out of range'); w.edit('Edit spatial vertex', () => { let target = w.doc.entities.find(q => q.id === e.id); if (target.feature3d)
                target = bakeFeature(w.doc, target.id); setControlPoint3(target, index, p); }); w.closeModal(); this.hit = null; this.sync(); } });
        w.modal.querySelector('[data-model-field=index]').addEventListener('input', event => { const i = Number(event.target.value); if (Number.isInteger(i) && points[i])
            w.modal.querySelector('[data-model-field=xyz]').value = [points[i].x, points[i].y, points[i].z || 0].join(', '); });
    }
    sketchDialog() { const w = this.w; w.openModal('Create a planar 3D profile', `<p>The profile remains a native 2D DXF entity with an extrusion normal. Extrude or loft it in 3D; the original 2D workspace remains available.</p><label class="field">Shape<select id="model3d-shape"><option value="rectangle">Rectangle</option><option value="circle">Circle</option></select></label><label class="field">Plane<select id="model3d-plane"><option>XY</option><option>XZ</option><option>YZ</option></select></label>${fields([{ name: 'origin', label: 'OCS origin X, Y, elevation', value: '0, 0, 0' }, { name: 'width', label: 'Width / radius', value: 80 }, { name: 'height', label: 'Rectangle height', value: 50 }])}<div class="error-text"></div>`, { confirm: 'Create profile', onConfirm: () => { const get = n => w.modal.querySelector(`[data-model-field=${n}]`).value, o = xyz(get('origin'), s => w.eval(s)), a = w.eval(get('width')), b = w.eval(get('height')); if (a <= 0 || b <= 0)
            throw new Error('Profile sizes must be positive'); const normal = { XY: V3(0, 0, 1), XZ: V3(0, -1, 0), YZ: V3(1, 0, 0) }[w.modal.querySelector('#model3d-plane').value], e = w.modal.querySelector('#model3d-shape').value === 'circle' ? circle(o, a) : polyline([V3(o.x, o.y), V3(o.x + a, o.y), V3(o.x + a, o.y + b), V3(o.x, o.y + b)], true); e.extrusion = normal; e.elevation = o.z; e.label = 'Sketch profile'; e.layer = 'Annotations'; w.edit('Create planar 3D profile', () => { w.doc.entities.push(e); w.selection = new Set([e.id]); }); w.closeModal(); this.sync(); this.fitSelection(); } }); }
    pathDialog() { const w = this.w; w.openModal('Create a 3D polyline', `<p>One WCS X, Y, Z triple per line. All coordinates support parameter expressions.</p><label class="field">Vertices<textarea id="model3d-path">0, 0, 0\n0, 0, 40\n40, 20, 70\n100, 20, 70</textarea></label><label><input id="model3d-path-closed" type="checkbox">Closed path</label><div class="error-text"></div>`, { confirm: 'Create path', onConfirm: () => { const points = w.modal.querySelector('#model3d-path').value.trim().split(/\n+/).map(line => xyz(line, s => w.eval(s))), closed = w.modal.querySelector('#model3d-path-closed').checked; if (points.length < 2 || points.length > 2048 || points.some((p, i) => i && distance3(p, points[i - 1]) < 1e-9))
            throw new Error('Use 2–2048 distinct adjacent vertices'); const e = entity('POLYLINE', { points, closed, flags: 8, label: '3D path', layer: 'Annotations' }); w.edit('Create 3D path', () => { w.doc.entities.push(e); w.selection = new Set([e.id]); }); w.closeModal(); this.sync(); this.fitSelection(); } }); }
    appearanceDialog() { const w = this.w, e = w.selected()[0]; if (!e)
        throw new Error('Select an entity'); if (isLocked(e, w.doc))
        throw new Error('The selected entity is locked'); w.openModal('3D appearance', `<label class="field">Name<input id="model3d-label" value="${E(e.label || e.type)}"></label><label class="field">Surface / line color<input id="model3d-color" type="color" value="${E(/^#[0-9a-f]{6}$/i.test(e.color) ? e.color : '#648596')}"></label><label class="field">Layer<select id="model3d-layer">${w.doc.layers.map(l => `<option ${l.name === e.layer ? 'selected' : ''}>${E(l.name)}</option>`).join('')}</select></label>`, { confirm: 'Apply appearance', onConfirm: () => { const label = w.modal.querySelector('#model3d-label').value.slice(0, 160), color = w.modal.querySelector('#model3d-color').value, layer = w.modal.querySelector('#model3d-layer').value; w.edit('3D appearance', () => Object.assign(w.doc.entities.find(q => q.id === e.id), { label, color, layer })); w.closeModal(); } }); }
    viewDialog() { const w = this.w; w.openModal('3D view and selection', `${iconPreferencesMarkup()}<label class="field">Projection<select id="model3d-projection"><option value="ortho">Orthographic</option><option value="perspective" ${this.camera.perspective ? 'selected' : ''}>Perspective</option></select></label><label class="field">Display style<select id="model3d-style">${['shaded-edges', 'shaded', 'wireframe'].map(s => `<option ${s === this.renderer.style ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label class="field">Selection mode<select id="model3d-pick">${['body', 'face', 'vertex'].map(s => `<option ${s === this.pickMode ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label class="field">One-finger / left-button drag<select id="model3d-nav"><option value="orbit">Orbit</option><option value="pan" ${this.navigation === 'pan' ? 'selected' : ''}>Pan</option></select></label><div class="operation-grid">${['iso', 'top', 'bottom', 'front', 'back', 'left', 'right'].map(s => button('3d-view-' + s, s, 'btn')).join('')}</div><p class="muted-note">${E(this.renderer.backend)}. CPU frame time does not measure GPU execution. Canvas fallback uses a bounded software Z-buffer; CPU timing is not GPU execution time.</p>`, { confirm: 'Apply view', onConfirm: () => { this.camera.perspective = w.modal.querySelector('#model3d-projection').value === 'perspective'; this.renderer.style = w.modal.querySelector('#model3d-style').value; this.pickMode = w.modal.querySelector('#model3d-pick').value; this.navigation = w.modal.querySelector('#model3d-nav').value; this.renderer.upload(); this.changedView(); this.saveView(); w.closeModal(); w.renderInspector(); } }); }
    measureDialog() { const w = this.w, selected = w.selected().filter(e => e.type === 'MESH'), items = (selected.length ? selected : w.doc.entities.filter(e => e.type === 'MESH' && !e.model3dConsumed && !e.feature3d?.suppressed)); const values = items.map(e => { try {
        const p = meshProperties(e);
        return `<section><h3>${E(e.label || e.id)}</h3><p>${p.closed ? 'Closed oriented mesh' : 'Open or non-manifold mesh'} · ${p.vertices} vertices · ${p.faces} faces</p><p>Area: ${format(p.area)} ${E(w.doc.units)}²<br>Volume: ${p.volume === null ? 'not reported for an open mesh' : format(p.volume) + ' ' + E(w.doc.units) + '³'}<br>Boundary edges: ${p.boundaryEdges}; non-manifold/orientation edges: ${p.nonManifoldEdges}</p>${p.centroid ? '<p>Volume centroid: ' + [p.centroid.x, p.centroid.y, p.centroid.z].map(format).join(', ') + '</p>' : ''}</section>`;
    }
    catch (error) {
        return `<p>${E(error.message)}</p>`;
    } }).join(''); w.openModal('3D measurements & display diagnostics', `${values || '<p>Select a mesh body to measure its surface and topology.</p>'}${this.hit ? '<p>Picked WCS point: ' + [this.hit.point.x, this.hit.point.y, this.hit.point.z].map(format).join(', ') + '</p>' : ''}<h3>Display diagnostics</h3>${this.renderer.scene.diagnostics.map(d => `<p>${E(d.id)}: ${E(d.message)}</p>`).join('') || '<p>No unsupported spatial entities in this scene.</p>'}<p class="muted-note">Area/volume calculations are for the faceted mesh. Closed edge incidence alone is not a self-intersection certificate. External overlapping bodies are measured individually.</p>`); }
    sectionDialog() { const w = this.w; w.openModal('Section analysis', `<p>Clip the 3D view, or create native LINE section segments from a selected mesh. This is analysis, not a capped solid split.</p><label class="field">Plane normal<select id="model3d-section-axis"><option>x</option><option>y</option><option selected>z</option></select></label>${fields([{ name: 'offset', label: 'Plane offset', value: this.renderer.section?.offset ?? 25 }])}<label><input id="model3d-section-enable" type="checkbox" checked>Enable display clipping</label><label><input id="model3d-section-lines" type="checkbox">Create section LINE entities in drawing</label><div class="error-text"></div>`, { confirm: 'Apply section', onConfirm: () => { const axis = w.modal.querySelector('#model3d-section-axis').value, offset = w.eval(w.modal.querySelector('[data-model-field=offset]').value), normal = { x: V3(1, 0, 0), y: V3(0, 1, 0), z: V3(0, 0, 1) }[axis]; if (w.modal.querySelector('#model3d-section-lines').checked) {
            const e = w.selected().find(e => e.type === 'MESH');
            if (!e)
                throw new Error('Select a mesh for native section output');
            w.edit('Create mesh section', () => w.doc.entities.push(...sectionEntities(e, axis, offset)));
        } this.renderer.section = w.modal.querySelector('#model3d-section-enable').checked ? { normal, offset } : null; this.renderer.invalidate(); w.closeModal(); } }); }
    exportMesh(format) { const e = this.w.selected().find(e => e.type === 'MESH'); if (!e)
        throw new Error('Select a MESH body to export'); downloadFile(this.w.basename() + '.' + format, format === 'obj' ? writeOBJ(e) : writeSTL(e), 'text/plain'); this.w.closeModal(); }
    dispose() { this.disposed = true; this.input.dispose(); this.renderer?.dispose(); this.stage.remove(); }
}
