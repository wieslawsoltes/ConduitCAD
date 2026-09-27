import { evaluateExpression } from '@conduitcad/constraints';
import { clone, entity, isLocked } from '@conduitcad/model';
import { spatialPathPoints, regenerateFeatures } from '@conduitcad/modeling';
import { expressionDelta3 } from './gestures.js';

/** Isolated WCS polyline authoring, including point insertion/removal and dependent feature previews. */
export class SpatialPathSession {
    constructor(document, { id = null, layer = '0' } = {}) {
        this.source = document; this.version = document.version; this.signature = JSON.stringify(document); this.base = clone(document);
        const existing = id ? document.entities.find(e => e.id === id) : null;
        if (id && (!existing || existing.type !== 'POLYLINE' || !(existing.flags & 8) || (existing.flags & (2 | 4 | 16 | 64)) || existing.feature3d || existing.connector || existing.parametric && existing.parametric.kind !== 'spatial-path' || existing.points?.some(p => p.bulge)))
            throw new Error('Choose an ordinary native 3D polyline');
        if (existing && isLocked(existing, document)) throw new Error('The spatial path is locked');
        const outputLayer = document.layers.find(l => l.name === (existing?.layer || layer));
        if (!outputLayer || outputLayer.locked || outputLayer.visible === false) throw new Error('Choose an unlocked visible output layer');
        this.entity = existing ? clone(existing) : entity('POLYLINE', { points: [], closed: false, flags: 8, layer, layout: 'Model', label: 'Spatial path' });
        if ((this.entity.layout || 'Model') !== 'Model') throw new Error('Spatial paths require Model space');
        this.id = this.entity.id; this.creation = !existing;
        const coordinates = existing?.parametric?.kind === 'spatial-path' ? existing.parametric.coordinates : this.entity.points.map(p => ({ x: String(p.x), y: String(p.y), z: String(p.z ?? 0) }));
        this.state = { coordinates: clone(coordinates), origins: this.entity.points.map((_, i) => i), closed: !!this.entity.closed };
        this.validateState(this.state);
        this.initial = this.snapshot(); this.preview = null; this.error = null; this.revision = 0; this.validatedRevision = -1; this.closed = false; this.evaluations = 0;
        this.undoStack = []; this.redoStack = [];
    }
    assertOpen() { if (this.closed) throw new Error('This spatial path edit has ended'); }
    snapshot() { return clone(this.state); }
    get changed() { return this.creation || JSON.stringify(this.initial) !== JSON.stringify(this.state); }
    invalidate() { this.preview = null; this.validatedRevision = -1; this.error = null; this.revision++; }
    validateState(state) {
        if (!state || typeof state.closed !== 'boolean' || !Array.isArray(state.coordinates) || state.coordinates.length > 2048) throw new Error('Invalid spatial path snapshot');
        if (!Array.isArray(state.origins) || state.origins.length !== state.coordinates.length || state.origins.some(i => i !== null && (!Number.isInteger(i) || i < 0 || i >= this.entity.points.length)) || new Set(state.origins.filter(i => i !== null)).size !== state.origins.filter(i => i !== null).length) throw new Error('Invalid path vertex provenance');
        for (const p of state.coordinates) for (const axis of ['x', 'y', 'z']) if (!p || !['number', 'string'].includes(typeof p[axis]) || String(p[axis]).length > 4096) throw new Error('Invalid path coordinate');
    }
    restore(state) { this.assertOpen(); this.validateState(state); this.state = clone(state); this.invalidate(); }
    set(index, axis, expression) {
        this.assertOpen();
        if (!Number.isInteger(index) || index < 0 || index >= this.state.coordinates.length || !['x', 'y', 'z'].includes(axis)) throw new Error('Unknown path coordinate');
        const state = this.snapshot(); state.coordinates[index][axis] = expression; this.validateState(state);
        if (JSON.stringify(state) !== JSON.stringify(this.state)) this.restore(state);
    }
    insert(index, point) {
        this.assertOpen();
        if (!Number.isInteger(index) || index < 0 || index > this.state.coordinates.length) throw new Error('Invalid insertion index');
        const state = this.snapshot(); state.coordinates.splice(index, 0, clone(point)); state.origins.splice(index, 0, null); this.restore(state);
    }
    remove(index) {
        this.assertOpen();
        if (!Number.isInteger(index) || index < 0 || index >= this.state.coordinates.length) throw new Error('Unknown path vertex');
        const state = this.snapshot(); state.coordinates.splice(index, 1); state.origins.splice(index, 1); this.restore(state);
    }
    setClosed(value) { if (typeof value !== 'boolean') throw new Error('Expected a closed-path flag'); const state = this.snapshot(); state.closed = value; this.restore(state); }
    checkpoint(before) { this.validateState(before); if (JSON.stringify(before) === JSON.stringify(this.state)) return; this.undoStack.push(clone(before)); if (this.undoStack.length > 60) this.undoStack.shift(); this.redoStack = []; }
    undo() { this.assertOpen(); if (!this.undoStack.length) return false; this.redoStack.push(this.snapshot()); this.restore(this.undoStack.pop()); return true; }
    redo() { this.assertOpen(); if (!this.redoStack.length) return false; this.undoStack.push(this.snapshot()); this.restore(this.redoStack.pop()); return true; }
    drag(index, delta, before) {
        this.assertOpen(); this.validateState(before);
        const point = before.coordinates[index], next = this.snapshot();
        if (!point || !next.coordinates[index]) throw new Error('Unknown dragged vertex');
        for (const axis of ['x', 'y', 'z']) next.coordinates[index][axis] = expressionDelta3(point[axis], delta[axis] ?? 0, evaluateExpression(point[axis], this.base.parameters));
        this.restore(next);
    }
    evaluate() {
        this.assertOpen();
        if (this.preview && this.validatedRevision === this.revision) return this.preview;
        this.preview = null; this.error = null; this.validatedRevision = -1;
        try {
            const points = spatialPathPoints(this.state.coordinates, this.base.parameters, this.state.closed), draft = clone(this.base), e = clone(this.entity);
            e.points = points.map((p, i) => ({ ...(this.state.origins[i] === null ? {} : this.entity.points[this.state.origins[i]]), ...p }));
            e.closed = this.state.closed; e.flags = (e.flags | 8) & ~1 | (e.closed ? 1 : 0); e.dirty = true;
            e.parametric = { kind: 'spatial-path', version: 1, coordinates: clone(this.state.coordinates) };
            if (this.creation) draft.entities.push(e); else draft.entities[draft.entities.findIndex(q => q.id === this.id)] = e;
            regenerateFeatures(draft);
            const updated = new Map(draft.entities.map(e => [e.id, e]));
            for (const original of this.base.entities) if (isLocked(original, this.base) && JSON.stringify({ ...original, dirty: undefined, model3dConsumed: undefined }) !== JSON.stringify({ ...updated.get(original.id), dirty: undefined, model3dConsumed: undefined })) throw new Error('Path edit affects locked geometry: ' + (original.label || original.id));
            this.preview = draft; this.validatedRevision = this.revision; this.evaluations++; return draft;
        } catch (error) { this.error = error.message; throw error; }
    }
    assertSource(document) { this.assertOpen(); if (document !== this.source || JSON.stringify(document) !== this.signature) throw new Error('The drawing changed. Restart spatial path editing.'); }
    commit(document) { this.assertSource(document); const draft = this.evaluate(); document.entities = clone(draft.entities); return this.id; }
    cancel() { this.closed = true; this.source = null; this.base = null; this.preview = null; this.undoStack = []; this.redoStack = []; }
}
