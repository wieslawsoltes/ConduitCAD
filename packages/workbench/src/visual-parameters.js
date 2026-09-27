import { ParameterEditSession } from '@conduitcad/manipulation2d';
import { ConstraintSolver, evaluateExpression, evaluateCalculations } from '@conduitcad/constraints';
import { regenerateFeatures } from '@conduitcad/modeling';
import { regenerateDimensions } from '@conduitcad/model';
import { icon } from './icons.js';

const format = n => Number.isFinite(n) ? Number(n.toPrecision(9)).toString() : '—';
const stepFor = n => Math.max(1e-6, 10 ** (Math.floor(Math.log10(Math.abs(n) || 1)) - 2));
const button = (id, label, glyph) => `<button type="button" data-parameter-command="${id}" aria-label="${label}">${icon(glyph)}<span>${label}</span></button>`;
/** Live, isolated whole-design parameter preview; canvas navigation stays available. */
export class VisualParameters {
    constructor(w) {
        this.w = w; this.session = null; this.frame = 0; this.nodes = new Map(); this.scrubbing = null;
        this.root = document.createElement('section'); this.root.className = 'live-parameters'; this.root.hidden = true;
        this.root.setAttribute('role', 'region'); this.root.setAttribute('aria-label', 'Parameters on canvas');
        this.root.innerHTML = `<header><strong>${icon('formula')}Live parameters</strong>${button('collapse', 'Preview model', 'eye')}</header>
          <div class="live-parameter-body"><p>Type an expression, or drag a calculated value left / right. Preview updates the whole design; Apply keeps one undoable change.</p>
          <input class="live-parameter-search" type="search" aria-label="Find parameters" placeholder="Find parameters…"><div class="live-parameter-rows"></div>
          ${button('add', 'Add parameter', 'plus')}<p class="live-parameter-hint">Canvas drag navigates during this preview. Angles in trig functions use radians.</p></div>
          <p class="live-parameter-error" role="alert" hidden></p><p class="live-parameter-status" role="status"></p>
          <footer><div>${button('undo', 'Undo draft', 'undo')}${button('redo', 'Redo draft', 'redo')}</div><div>${button('cancel', 'Cancel', 'close')}${button('apply', 'Apply', 'check')}</div></footer>`;
        w.$('.canvas-area').append(this.root);
        const opt = { signal: w.abort.signal };
        this.root.addEventListener('click', e => this.click(e), opt);
        this.root.addEventListener('input', e => this.input(e), opt);
        this.root.addEventListener('focusin', e => { if (e.target.matches('[data-parameter-field]')) this.focusBefore = this.session?.snapshot(); }, opt);
        this.root.addEventListener('focusout', e => { if (e.target.matches('[data-parameter-field]')) this.checkpointInput(); }, opt);
        this.root.addEventListener('pointerdown', e => this.scrubDown(e), opt);
        this.root.addEventListener('pointermove', e => this.scrubMove(e), opt);
        this.root.addEventListener('pointerup', e => this.scrubUp(e), opt);
        for (const type of ['pointercancel', 'lostpointercapture']) this.root.addEventListener(type, e => { if (this.scrubbing?.pointer === e.pointerId) this.cancelDrag(); }, opt);
        w.root.addEventListener('pointerdown', e => { if (this.scrubbing && this.scrubbing.pointer !== e.pointerId) this.cancelDrag(); }, { ...opt, capture: true });
        w.root.addEventListener('conduit:documentchange', () => this.cancel(), opt);
    }
    get active() { return !!this.session; }
    start() {
        this.cancel(); this.w.model3d.path?.cancel(); this.w.model3d.inspection.cancel(); this.w.model3d.visual.cancel(); this.w.visual2d.cancel(); this.w.visual2d.panel.close();
        this.w.closeModal(); this.w.closePanels(); if (!this.w.model3d.active) this.w.setTool('select'); this.w.cancelGesture(); this.w.input.reset(); this.w.model3d.input.reset();
        const facade = Object.create(this.w); facade.solver = new ConstraintSolver();
        this.session = new ParameterEditSession(this.w.doc, { process: draft => {
            facade.doc = draft;
            for (const e of draft.entities) facade.evaluateParametric(e);
            for (const p of draft.blockEditing?.dynamic?.parameters || []) {
                if (!Object.hasOwn(draft.parameters, p.name)) throw new Error('Keep block parameters; edit their schema through Parameters & actions');
                const record = draft.parameters[p.name], expression = record && typeof record === 'object' ? record.expression ?? record.value : record;
                if (p.expression !== undefined) p.expression = expression;
                else if (typeof p.default === 'number') p.default = evaluateExpression(expression, draft.parameters);
            }
            facade.solveConstraints();
            evaluateCalculations(draft.entities, draft.constraints || [], draft.parameters);
            regenerateFeatures(draft); regenerateDimensions(draft); facade.reroute();
            this.solveStatus = facade.lastSolve;
        }});
        this.view = this.w.viewMode; this.nodes.clear(); this.root.querySelector('.live-parameter-rows').replaceChildren(); this.root.querySelector('.live-parameter-search').value = '';
        this.root.hidden = false; this.root.classList.remove('collapsed'); this.w.$('.canvas-area').classList.add('parameters-active'); this.w.visual2d.sync();
        this.rejectedFields = new Map(); this.rejected = false; this.root.querySelector('[data-parameter-command=collapse] span').textContent = 'Preview model'; this.report(); this.renderRows(); this.requestPreview(true); this.root.querySelector('.live-parameter-search').focus({ preventScroll: true });
        return this.session;
    }
    report(message = '') { const e = this.root.querySelector('.live-parameter-error'); e.textContent = message; e.hidden = !message; }
    checkpointInput() { if (this.session && this.focusBefore) this.session.checkpoint(this.focusBefore); this.focusBefore = null; this.refresh(); }
    renderRows() {
        if (!this.session) return;
        const host = this.root.querySelector('.live-parameter-rows'), alive = new Set(this.session.rows.map(r => r.id));
        for (const [id, node] of this.nodes) if (!alive.has(id)) { node.remove(); this.nodes.delete(id); }
        for (const row of this.session.rows) {
            let node = this.nodes.get(row.id);
            if (!node) {
                node = document.createElement('div'); node.className = 'live-parameter-row'; node.dataset.parameterRow = row.id;
                node.innerHTML = `<label>Name<input data-parameter-field="name" maxlength="128" spellcheck="false" autocomplete="off"></label>
                  <button type="button" data-parameter-scrub role="spinbutton" title="Drag left / right; arrow keys adjust; Enter edits expression">${icon('move')}<output></output></button>
                  <button type="button" data-parameter-remove title="Remove parameter">${icon('trash')}</button>
                  <label class="live-parameter-expression">Expression<input data-parameter-field="expression" maxlength="4096" autocomplete="off" spellcheck="false"></label><small></small>`;
                this.nodes.set(row.id, node); host.append(node);
            }
            for (const field of ['name', 'expression']) {
                const input = node.querySelector(`[data-parameter-field=${field}]`);
                if (document.activeElement !== input || this.scrubbing) input.value = this.rejectedFields.get(row.id + ":" + field) ?? row[field];
                input.setAttribute('aria-invalid', String(this.rejectedFields.has(row.id + ":" + field)));
                input.setAttribute('aria-label', field === 'name' ? 'Parameter name' : 'Expression for ' + row.name);
            }
            node.querySelector('[data-parameter-remove]').setAttribute('aria-label', 'Remove ' + row.name);
        }
        this.filter(); this.refresh();
    }
    filter() {
        if (!this.session) return;
        const query = this.root.querySelector('.live-parameter-search').value.trim().toLowerCase();
        for (const row of this.session.rows) this.nodes.get(row.id).hidden = !(row.name + ' ' + row.expression).toLowerCase().includes(query);
    }
    refresh() {
        const s = this.session; if (!s) return;
        for (const row of s.rows) {
            const node = this.nodes.get(row.id); if (!node) continue;
            const value = s.values?.[row.name.trim()], control = node.querySelector('[data-parameter-scrub]');
            control.querySelector('output').textContent = format(value); control.setAttribute('aria-label', 'Adjust ' + row.name);
            control.setAttribute('aria-invalid', String(!Number.isFinite(value))); control.disabled = !Number.isFinite(value) && !this.scrubbing;
            if (Number.isFinite(value)) control.setAttribute('aria-valuenow', String(value)); else control.removeAttribute('aria-valuenow');
            let deps = []; try { deps = s.dependencies(row.id); } catch {} node.querySelector('small').textContent = deps.length ? 'Depends on ' + deps.join(', ') : 'Independent value';
        }
        this.root.querySelector('[data-parameter-command=apply]').disabled = this.rejected || !s.preview || s.validatedRevision !== s.revision;
        for (const id of ['undo', 'redo']) this.root.querySelector(`[data-parameter-command=${id}]`).disabled = !s[id + 'Stack'].length;
        this.root.querySelector('.live-parameter-status').textContent = s.preview ? `${s.rows.length} parameters · live ${this.view === '3d' ? '3D' : '2D'} preview · drawing unchanged` : 'No valid preview · correct the highlighted expression';
    }
    input(e) {
        if (e.target.matches('.live-parameter-search')) { this.filter(); return; }
        const field = e.target.dataset.parameterField, row = e.target.closest('[data-parameter-row]'); if (!field || !row || !this.session) return;
        const key = row.dataset.parameterRow + ":" + field;
        try { this.session.set(row.dataset.parameterRow, { [field]: e.target.value }); this.rejectedFields.delete(key); e.target.setAttribute('aria-invalid', 'false'); this.rejected = this.rejectedFields.size > 0; this.requestPreview(); }
        catch (error) { this.rejectedFields.set(key, e.target.value); e.target.setAttribute('aria-invalid', 'true'); this.reject(error); }
    }
    reject(error) { if (!this.session) return; this.rejected = true; this.session.invalidate(); this.session.error = error.message; cancelAnimationFrame(this.frame); this.frame = 0; this.showDocument(this.w.doc); this.report(error.message); this.refresh(); }
    showDocument(document) {
        if (this.w.model3d.active) { this.w.model3d.previewDocument = document === this.w.doc ? null : document; this.w.model3d.renderer.setDocument(document, { showInputs: this.w.model3d.showInputs }); this.w.model3d.renderer.invalidate(); }
        else { this.w.renderer.setDocument(document); this.w.renderer.invalidate(); }
    }
    requestPreview(immediate = false) {
        if (!this.session || this.rejected) return; cancelAnimationFrame(this.frame); this.frame = 0; this.refresh();
        const run = () => {
            this.frame = 0; if (!this.session) return;
            if (this.session.source !== this.w.doc || this.session.version !== this.w.doc.version) { this.cancel(); return; }
            try { this.showDocument(this.session.evaluate()); this.report(); } catch (error) { this.showDocument(this.w.doc); this.report(error.message); }
            this.renderRows();
        };
        if (immediate) run(); else this.frame = requestAnimationFrame(run);
    }
    scrubDown(e) {
        const control = e.target.closest('[data-parameter-scrub]'); if (!control || !this.session || this.rejectedFields.size || e.button !== 0 || this.scrubbing) return;
        const id = control.closest('[data-parameter-row]').dataset.parameterRow, value = this.session.values?.[this.session.row(id).name.trim()]; if (!Number.isFinite(value)) return;
        e.preventDefault(); this.checkpointInput(); control.focus({ preventScroll: true });
        this.scrubbing = { id, pointer: e.pointerId, x: e.clientX, value, step: stepFor(value), before: this.session.snapshot(), control, moved: false };
        try { control.setPointerCapture(e.pointerId); } catch { this.scrubbing = null; }
    }
    scrubMove(e) {
        const d = this.scrubbing; if (!d || d.pointer !== e.pointerId || !this.session) return;
        const dx = e.clientX - d.x; if (!d.moved && Math.abs(dx) < 5) return; d.moved = true;
        try { this.rejected = false; this.session.scrub(d.id, Math.round(dx) * d.step * (e.shiftKey ? .1 : 1), d.value, d.before); this.requestPreview(); } catch (error) { this.reject(error); }
    }
    releaseScrub() { const d = this.scrubbing; this.scrubbing = null; if (d) { try { d.control.releasePointerCapture(d.pointer); } catch {} } return d; }
    scrubUp(e) {
        if (this.scrubbing?.pointer !== e.pointerId) return; this.scrubMove(e); const d = this.releaseScrub();
        if (!this.session) return;
        if (d.moved) { this.session.checkpoint(d.before); this.requestPreview(true); }
        else this.nodes.get(d.id)?.querySelector('[data-parameter-field=expression]').focus({ preventScroll: true });
    }
    cancelDrag() { this.nav = null; const d = this.releaseScrub(); if (d && this.session) { this.rejectedFields.clear(); this.rejected = false; this.session.restore(d.before); this.requestPreview(true); } }
    pointerDown(p) { if (!this.active) return false; this.nav = p; return true; }
    pointerMove(p) { if (!this.active) return false; if (this.nav) { this.w.camera.pan(p.x - this.nav.x, p.y - this.nav.y); this.nav = p; this.w.renderer.invalidate(); } return true; }
    pointerUp() { if (!this.active) return false; this.nav = null; return true; }
    click(event) {
        const command = event.target.closest('[data-parameter-command]'), remove = event.target.closest('[data-parameter-remove]'); if (!command && !remove) return;
        event.preventDefault(); event.stopPropagation(); if (!this.session) return;
        try {
            this.checkpointInput(); const id = command?.dataset.parameterCommand;
            if (id === 'cancel') { this.cancel(); return; } if (id === 'apply') { this.apply(); return; }
            if (id === 'collapse') { const collapsed = this.root.classList.toggle('collapsed'); command.querySelector('span').textContent = collapsed ? 'Show parameters' : 'Preview model'; command.setAttribute('aria-expanded', String(!collapsed)); return; }
            if (this.rejectedFields.size && !['undo','redo'].includes(id)) { this.report('Repair the rejected field or undo the draft first'); return; }
            this.cancelDrag(); const before = this.session.snapshot();
            if (remove) this.session.remove(remove.closest('[data-parameter-row]').dataset.parameterRow);
            if (id === 'add') { this.root.querySelector('.live-parameter-search').value = ''; this.root.classList.remove('collapsed'); this.session.add(); }
            if (id === 'undo' || id === 'redo') this.session[id](); else this.session.checkpoint(before);
            this.rejectedFields.clear(); this.rejected = false; this.renderRows(); this.requestPreview(true);
            if (id === 'add') this.nodes.get(this.session.rows.at(-1).id).querySelector('input').focus();
        } catch (error) { this.reject(error); }
    }
    apply() {
        const s = this.session; if (!s || this.applying || this.rejected) return; this.checkpointInput(); this.cancelDrag(); this.requestPreview(true);
        if (!s.preview || s.error || s.validatedRevision !== s.revision) return;
        try {
            s.assertSource(this.w.doc);
            if (s.changed) { this.applying = true; this.w.edit('Edit live design parameters', () => s.commit(this.w.doc)); }
            this.finish();
        } catch (error) { this.report(error.message); if (s.source !== this.w.doc) this.finish(); } finally { this.applying = false; }
    }
    finish() {
        if (!this.session) return; cancelAnimationFrame(this.frame); this.frame = 0; this.releaseScrub(); this.focusBefore = null; this.nav = null;
        this.session.cancel(); this.session = null; this.root.hidden = true; this.w.$('.canvas-area').classList.remove('parameters-active'); this.w.model3d.previewDocument = null;
        this.showDocument(this.w.doc); this.w.visual2d.sync(); this.w.updateUI();
        (this.w.model3d.active ? this.w.model3d.host : this.w.$('.viewport')).focus({ preventScroll: true });
    }
    cancel() { if (!this.applying) this.finish(); }
    beforeEdit() { this.cancel(); }
    externalChange() { if (this.session && !this.applying && (this.session.source !== this.w.doc || this.session.version !== this.w.doc.version || this.view !== this.w.viewMode)) this.cancel(); }
    keyDown(e) {
        if (!this.active) return false;
        if (e.key === 'Escape') { e.preventDefault(); if (this.scrubbing) this.cancelDrag(); else if (this.focusBefore) { const row = e.target.closest('[data-parameter-row]'); this.rejectedFields.delete(row?.dataset.parameterRow + ':' + e.target.dataset.parameterField); this.rejected = this.rejectedFields.size > 0; this.session.restore(this.focusBefore); this.focusBefore = null; e.target.blur(); this.requestPreview(true); } else this.cancel(); return true; }
        const control = e.target.closest('[data-parameter-scrub]');
        if (control && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
            e.preventDefault(); const id = control.closest('[data-parameter-row]').dataset.parameterRow;
            if (e.key === 'Enter') { this.nodes.get(id).querySelector('[data-parameter-field=expression]').focus(); return true; }
            const value = this.session.values?.[this.session.row(id).name.trim()]; if (!Number.isFinite(value)) return true;
            const before = this.session.snapshot(); this.session.scrub(id, (['ArrowLeft', 'ArrowDown'].includes(e.key) ? -1 : 1) * stepFor(value) * (e.shiftKey ? .1 : 1), value, before); this.session.checkpoint(before); this.requestPreview(true); return true;
        }
        if (e.target.closest('input,textarea,select')) return false;
        if ((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase())) { e.preventDefault(); this.cancelDrag(); this.rejectedFields.clear(); this.rejected = false; this.session[e.shiftKey || e.key.toLowerCase() === 'y' ? 'redo' : 'undo'](); this.requestPreview(true); return true; }
        if (!e.ctrlKey && !e.metaKey && (e.key.length === 1 || ['Delete', 'Backspace', 'Enter'].includes(e.key))) return true;
        return false;
    }
    dispose() { this.cancel(); this.root.remove(); }
}
