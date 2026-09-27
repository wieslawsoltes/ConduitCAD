import { clone, uid, isLocked } from '@conduitcad/model';
import { resolveParameters, reservedParameterNames, parameterDependencies } from '@conduitcad/constraints';
import { expressionDelta2 } from './session.js';

const MAX_PARAMETERS = 1024;
const MAX_EXPRESSION = 4096;
const expressionOf = value => value && typeof value === 'object' ? value.expression ?? value.value : value;
function checkRows(rows) {
    if (!Array.isArray(rows) || rows.length > MAX_PARAMETERS) throw new Error('Use at most 1024 parameters');
    const ids = new Set();
    for (const row of rows) {
        if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id) || typeof row.name !== 'string' || row.name.length > 128 || typeof row.expression !== 'string' || row.expression.length > MAX_EXPRESSION)
            throw new Error('Invalid parameter edit snapshot');
        ids.add(row.id);
    }
}
/** Document-independent parameter authoring state. The host owns regeneration and history. */
export class ParameterEditSession {
    constructor(document, { process = null } = {}) {
        this.source = document;
        this.version = document.version;
        this.signature = JSON.stringify(document);
        this.base = clone(document);
        this.process = process;
        this.records = new Map();
        this.rows = Object.entries(document.parameters || {}).map(([name, value]) => {
            const id = uid('parameter-draft');
            this.records.set(id, clone(value));
            return { id, name, expression: String(expressionOf(value) ?? '') };
        });
        checkRows(this.rows);
        this.initial = this.snapshot();
        this.undoStack = [];
        this.redoStack = [];
        this.closed = false;
        this.revision = 0;
        this.validatedRevision = -1;
        this.preview = null;
        this.values = null;
        this.error = null;
        this.evaluations = 0;
    }
    assertOpen() { if (this.closed) throw new Error('This parameter edit has ended'); }
    row(id) { this.assertOpen(); const row = this.rows.find(r => r.id === id); if (!row) throw new Error('Unknown parameter row'); return row; }
    snapshot() { return clone(this.rows); }
    get changed() { return JSON.stringify(this.rows) !== JSON.stringify(this.initial); }
    invalidate() { this.preview = null; this.values = null; this.error = null; this.validatedRevision = -1; this.revision++; }
    set(id, changes) {
        const row = this.row(id);
        if (!changes || Object.keys(changes).some(k => !['name', 'expression'].includes(k))) throw new Error('Unknown parameter field');
        const next = { ...row, ...changes };
        checkRows([next]);
        if (JSON.stringify(next) !== JSON.stringify(row)) { Object.assign(row, next); this.invalidate(); }
    }
    add(name = '', expression = '100') {
        this.assertOpen();
        if (!name) { let i = 1; do { name = 'Size' + i++; } while (this.rows.some(r => r.name === name)); }
        const row = { id: uid('parameter-draft'), name, expression: String(expression) };
        checkRows([...this.rows, row]);
        this.rows.push(row); this.invalidate(); return row.id;
    }
    remove(id) { this.row(id); this.rows = this.rows.filter(r => r.id !== id); this.invalidate(); }
    restore(rows) { this.assertOpen(); checkRows(rows); this.rows = clone(rows); this.invalidate(); }
    checkpoint(before) {
        checkRows(before);
        if (JSON.stringify(before) === JSON.stringify(this.rows)) return;
        this.undoStack.push(clone(before));
        if (this.undoStack.length > 60) this.undoStack.shift();
        this.redoStack = [];
    }
    undo() { this.assertOpen(); if (!this.undoStack.length) return false; this.redoStack.push(this.snapshot()); this.restore(this.undoStack.pop()); return true; }
    redo() { this.assertOpen(); if (!this.redoStack.length) return false; this.undoStack.push(this.snapshot()); this.restore(this.redoStack.pop()); return true; }
    parameterMap() {
        this.assertOpen(); checkRows(this.rows);
        const map = {}, reserved = new Set([...reservedParameterNames(), ...(this.base.constraints || []).map(c => c.name).filter(Boolean)]);
        for (const row of this.rows) {
            const name = row.name.trim();
            if (!/^[A-Za-z_]\w*$/.test(name) || reserved.has(name) || Object.hasOwn(map, name)) throw new Error('Invalid, reserved or duplicate parameter: ' + name);
            const record = this.records.get(row.id);
            // A numeric/string record remains byte-identical unless its expression is edited.
            if (record !== undefined && row.expression === String(expressionOf(record))) map[name] = clone(record);
            else if (record && typeof record === 'object') map[name] = { ...clone(record), [Object.hasOwn(record, 'expression') ? 'expression' : 'value']: row.expression };
            else map[name] = row.expression;
        }
        return map;
    }
    scrub(id, delta, originalValue, before) {
        this.row(id); checkRows(before);
        const row = before.find(r => r.id === id);
        if (!row) throw new Error('The scrubbed parameter no longer exists');
        this.set(id, { expression: String(expressionDelta2(row.expression, delta, originalValue)) });
    }
    dependencies(id) { return parameterDependencies(this.row(id).expression); }
    evaluate() {
        this.assertOpen();
        if (this.preview && this.validatedRevision === this.revision) return this.preview;
        this.preview = null; this.values = null; this.error = null; this.validatedRevision = -1;
        try {
            const parameters = this.parameterMap(), values = resolveParameters(parameters), draft = clone(this.base);
            draft.parameters = parameters;
            this.process?.(draft);
            // A global parameter edit must not bypass entity/layer locking.
            const updated = new Map(draft.entities.map(e => [e.id, e]));
            for (const e of this.base.entities) if (isLocked(e, this.base) && JSON.stringify({ ...e, dirty: undefined, model3dConsumed: undefined }) !== JSON.stringify({ ...updated.get(e.id), dirty: undefined, model3dConsumed: undefined }))
                throw new Error('Parameter change affects locked geometry: ' + (e.label || e.id));
            const originals = new Map(this.base.entities.map(e => [e.id, e]));
            for (const e of draft.entities) if (JSON.stringify({ ...e, dirty: undefined, model3dConsumed: undefined }) !== JSON.stringify({ ...originals.get(e.id), dirty: undefined, model3dConsumed: undefined })) e.dirty = true;
            this.values = values; this.preview = draft; this.validatedRevision = this.revision; this.evaluations++;
            return draft;
        } catch (error) { this.error = error.message; throw error; }
    }
    assertSource(document) {
        this.assertOpen();
        if (document !== this.source || JSON.stringify(document) !== this.signature) throw new Error('The drawing changed. Restart parameter editing.');
    }
    commit(document) {
        this.assertSource(document);
        const draft = this.evaluate();
        document.parameters = clone(draft.parameters);
        document.entities = clone(draft.entities);
        document.constraints = clone(draft.constraints);
        if (draft.blockEditing) document.blockEditing = clone(draft.blockEditing);
    }
    cancel() { this.closed = true; this.source = null; this.base = null; this.preview = null; this.values = null; this.process = null; this.records.clear(); this.undoStack = []; this.redoStack = []; }
}
