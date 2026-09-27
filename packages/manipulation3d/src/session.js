import { V3, add3, sub3, mul3, bounds3, faceNormal, unit3 } from '@conduitcad/geometry3d';
import { clone, isLocked } from '@conduitcad/model';
import { MODELING_TOOLS, addFeature, editFeature, bakeFeature, curvePoints3, regenerateFeatures, faceFrame3, faceCoordinates3, profileOnFace3, controlPoints3, setControlPoint3 } from '@conduitcad/modeling';
import { evaluateExpression, resolveParameters } from '@conduitcad/constraints';
import { expressionDelta3, snapValue3 } from './gestures.js';
export const PROFILE_TYPES = Object.freeze(['CIRCLE', 'ELLIPSE', 'LWPOLYLINE', 'POLYLINE', 'SPLINE']);
const synthetic = [
    { id: 'sketch-profile', label: 'Planar sketch profile', group: 'Sketch', fields: [
        { name: 'shape', label: 'Shape', value: 0, options: ['Rectangle', 'Circle'] },
        { name: 'width', label: 'Width', value: 60 }, { name: 'height', label: 'Height', value: 40 }, { name: 'radius', label: 'Radius', value: 20 },
        { name: 'plane', label: 'Plane', value: 0, options: ['XY', 'XZ', 'YZ'] }
    ] },
    { id: 'face-profile', label: 'Sketch on face', inputs: 1, group: 'Sketch', fields: [
        { name: 'shape', label: 'Shape', value: 0, options: ['Rectangle', 'Circle'] },
        { name: 'width', label: 'Width', value: 30 }, { name: 'height', label: 'Height', value: 20 }, { name: 'radius', label: 'Radius', value: 10 },
        { name: 'u', label: 'Face U', value: 0 }, { name: 'v', label: 'Face V', value: 0 }, { name: 'offset', label: 'Normal offset', value: 0 }, { name: 'face', label: 'Face index', value: 1 }
    ] },
    { id: 'vertex', label: 'Edit native vertex', inputs: 1, group: 'Modify', fields: [
        { name: 'x', label: 'X', value: 0 }, { name: 'y', label: 'Y', value: 0 }, { name: 'z', label: 'Z', value: 0 },
        { name: 'index', label: 'Vertex index', value: 0 }, { name: 'detach', label: 'Detach feature history', value: 0, options: ['Keep feature link', 'Detach and edit vertex'] }
    ] }
];
export const VISUAL_TOOLS = Object.freeze([...MODELING_TOOLS, ...synthetic].map(t => Object.freeze({ ...t, fields: Object.freeze(t.fields.map(f => Object.freeze({ ...f, ...(f.options ? {options:Object.freeze([...f.options])} : {}) }))) })));
export function visualTool3(kind) {
    const tool = VISUAL_TOOLS.find(t => t.id === kind);
    if (!tool) throw new Error('Unsupported visual operation: ' + kind);
    return tool;
}
export function inputAccepts3(kind, index, e) {
    if (!e || e.feature3d?.suppressed) return false;
    if (kind === 'vertex') { try { return controlPoints3(e).length > 0; } catch { return false; } }
    if (['extrude', 'revolve', 'loft'].includes(kind) && !(kind === 'extrude' && index === 1)) return PROFILE_TYPES.includes(e.type);
    if (kind === 'sweep') return PROFILE_TYPES.includes(e.type) || (index === 1 && ['LINE', 'HELIX'].includes(e.type));
    return e.type === 'MESH';
}
/** Source document never mutates until the host's explicit history transaction calls commit(). */
export class VisualEditSession {
    constructor(document, kind, { id = null, inputs = [], parameters = {}, name, hit = null } = {}) {
        this.tool = visualTool3(kind); this.kind = kind; this.source = document; this.sourceVersion = document.version;
        this.signature = JSON.stringify(document); this.base = clone(document); this.id = id;
        this.closed = false; this.revision = 0; this.validatedRevision = -1; this.preview = null; this.resultId = null;
        this.error = null; this.undoStack = []; this.redoStack = []; this.evaluations = 0;
        const e = id ? document.entities.find(e => e.id === id) : null;
        if (id && (!e?.feature3d || e.feature3d.kind !== kind)) throw new Error('Select a matching editable feature');
        if (e && (isLocked(e, document) || e.feature3d.suppressed)) throw new Error('The feature is locked or suppressed');
        this.parameters = Object.fromEntries(this.tool.fields.map(f => [f.name, f.value]));
        if (!this.tool.inputs) Object.assign(this.parameters, { x: 0, y: 0, z: 0 });
        if (kind === 'extrude' && !id) this.parameters.useNormal = 1;
        Object.assign(this.parameters, e?.feature3d?.parameters || {}, parameters);
        this.inputs = (e?.feature3d?.inputs || inputs).slice();
        this.name = name || e?.label || this.tool.label;
        if (!id && hit && hit.id === this.inputs[0] && hit.face !== undefined && ['hole', 'offset-face', 'face-profile'].includes(kind)) {
            const target = this.base.entities.find(e => e.id === hit.id), frame = faceFrame3(target, hit.face);
            this.parameters.face = hit.face;
            if (kind !== 'offset-face') { const uv = faceCoordinates3(frame, hit.point || frame.origin); this.parameters.u = uv.u; this.parameters.v = uv.v; }
        }
        if (kind === 'vertex' && this.inputs[0]) this.loadVertex(hit?.vertex ?? this.parameters.index);
        if (!id && kind === 'transform' && this.inputs[0]) {
            const target = document.entities.find(e => e.id === this.inputs[0]);
            const b = bounds3(target.points), c = mul3(add3(b.min, b.max), .5);
            Object.assign(this.parameters, { px: c.x, py: c.y, pz: c.z });
        }
        this.initial = this.snapshot();
    }
    assertOpen() { if (this.closed) throw new Error('Visual edit session is closed'); }
    snapshot() { return clone({ parameters: this.parameters, inputs: this.inputs, name: this.name }); }
    restore(snapshot) { this.assertOpen(); Object.assign(this, clone(snapshot)); this.invalidate(); }
    checkpoint(snapshot = this.snapshot()) {
        if (JSON.stringify(snapshot) !== JSON.stringify(this.undoStack.at(-1))) this.undoStack.push(clone(snapshot));
        if (this.undoStack.length > 64) this.undoStack.shift(); this.redoStack.length = 0;
    }
    undo() { if (!this.undoStack.length) return false; this.redoStack.push(this.snapshot()); this.restore(this.undoStack.pop()); return true; }
    redo() { if (!this.redoStack.length) return false; this.undoStack.push(this.snapshot()); this.restore(this.redoStack.pop()); return true; }
    invalidate() { this.revision++; this.preview = null; this.validatedRevision = -1; this.error = null; }
    set(name, value) {
        this.assertOpen();
        if (typeof name !== 'string' || !Object.hasOwn(this.parameters, name)) throw new Error('Unknown parameter: ' + name);
        if (!['number', 'string'].includes(typeof value) || String(value).length > 1024) throw new Error('Invalid parameter value');
        if (this.parameters[name] === value) return;
        this.parameters[name] = value; this.invalidate();
        // Switching to New body must not leave a stale target attached.
        if (this.kind === 'extrude' && name === 'operation') {
            try { if (this.value('operation') === 0) this.inputs = this.inputs.slice(0, 1); } catch { /* retain invalid draft for correction */ }
        }
    }
    values() {
        const variables = resolveParameters(this.base.parameters || {});
        return Object.fromEntries(Object.entries(this.parameters).map(([key, value]) => [key, evaluateExpression(String(value), variables)]));
    }
    value(name) { return evaluateExpression(String(this.parameters[name]), resolveParameters(this.base.parameters || {})); }
    inputCount() { return this.kind === 'extrude' && this.value('operation') ? 2 : this.tool.multiple ? Math.max(this.tool.inputs, this.inputs.length) : this.tool.inputs || 0; }
    setInput(index, id, hit = null) {
        this.assertOpen();
        if (!Number.isInteger(index) || index < 0 || index >= (this.tool.multiple ? 32 : this.inputCount())) throw new RangeError('Input index is out of range');
        const e = this.base.entities.find(e => e.id === id);
        if (!inputAccepts3(this.kind, index, e) || id === this.id) throw new Error('Pick a compatible source entity');
        if (isLocked(e, this.base)) throw new Error('The picked input is locked');
        if (this.inputs.some((v, i) => i !== index && v === id)) throw new Error('Inputs must be distinct');
        const patch = {};
        if (hit?.face !== undefined && ['hole', 'offset-face', 'face-profile'].includes(this.kind)) {
            const frame = faceFrame3(e, hit.face); patch.face = hit.face;
            if (this.kind !== 'offset-face') { const uv = faceCoordinates3(frame, hit.point || frame.origin); patch.u = uv.u; patch.v = uv.v; }
        }
        if (this.kind === 'vertex') {
            const index = hit?.vertex ?? 0, p = controlPoints3(e)[index];
            if (!p) throw new Error('Select a native control vertex');
            Object.assign(patch, {x:p.x,y:p.y,z:p.z,index});
        }
        if (this.kind === 'transform' && !this.id && index === 0 && !this.inputs[0]) {
            const bounds = bounds3(e.points), center = mul3(add3(bounds.min,bounds.max),.5);
            Object.assign(patch,{px:center.x,py:center.y,pz:center.z});
        }
        this.inputs[index] = id; Object.assign(this.parameters,patch);
        this.invalidate();
    }
    loadVertex(index) {
        const e = this.base.entities.find(e => e.id === this.inputs[0]), p = controlPoints3(e)[index];
        if (!p) throw new Error('Select a native control vertex');
        Object.assign(this.parameters, { x: p.x, y: p.y, z: p.z, index });
    }
    dragValue(name, delta, original, originalValue, step = 0) {
        const value = snapValue3(originalValue + delta, step);
        this.set(name, expressionDelta3(original, value - originalValue, originalValue));
    }
    assertSource(document) {
        this.assertOpen();
        if (document !== this.source || JSON.stringify(document) !== this.signature) throw new Error('The drawing changed during preview; restart this operation');
    }
    evaluate() {
        this.assertOpen();
        if (this.preview && this.validatedRevision === this.revision) return this.preview;
        this.preview = null; this.error = null;
        try {
            const count = this.inputCount();
            if (this.inputs.length !== count || this.inputs.some((id, i) => !id || !inputAccepts3(this.kind, i, this.base.entities.find(e => e.id === id)))) throw new Error('Pick all required source geometry on the canvas');
            if (new Set(this.inputs).size !== this.inputs.length || this.inputs.includes(this.id)) throw new Error('Feature inputs must be distinct');
            if (this.inputs.some(id => isLocked(this.base.entities.find(e => e.id === id), this.base))) throw new Error('An input is locked');
            const draft = clone(this.base); let result;
            if (this.kind === 'sketch-profile') {
                const p = this.values();
                if (![0,1,2].includes(p.plane) || ![0,1].includes(p.shape)) throw new Error('Select a valid sketch plane and shape');
                const c = V3(p.x,p.y,p.z), u = p.plane === 2 ? V3(0,1,0) : V3(1,0,0), v = p.plane === 0 ? V3(0,1,0) : V3(0,0,1);
                const support = {points:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>add3(c,add3(mul3(u,a),mul3(v,b)))),faces:[[0,1,2,3]]};
                result = profileOnFace3(support,0,{...p,shape:p.shape?'circle':'rectangle'});result.label=this.name;draft.entities.push(result);
            } else if (this.kind === 'face-profile') {
                const p = this.values();
                if (![0, 1].includes(p.shape)) throw new Error('Unknown profile shape');
                result = profileOnFace3(draft.entities.find(e => e.id === this.inputs[0]), p.face, { ...p, shape: p.shape ? 'circle' : 'rectangle' });
                result.label=this.name;draft.entities.push(result);
            } else if (this.kind === 'vertex') {
                const p = this.values(); result = draft.entities.find(e => e.id === this.inputs[0]);
                if (result.feature3d && p.detach !== 1) throw new Error('Direct vertex editing requires explicitly detaching this feature');
                if (result.feature3d) result = bakeFeature(draft, result.id);
                setControlPoint3(result, p.index, V3(p.x, p.y, p.z)); regenerateFeatures(draft);
                this.resultId = result.id;
            } else {
                result = this.id ? editFeature(draft, this.id, { parameters: this.parameters, inputs: this.inputs, name: this.name })
                    : addFeature(draft, this.kind, this.parameters, this.inputs, { name: this.name, color: this.base.entities.find(e => e.id === this.inputs[0])?.color });
            }
            this.resultId ||= result.id;
            if (result.id !== this.resultId) result.id = this.resultId;
            this.preview = draft; this.validatedRevision = this.revision; this.evaluations++;
            return draft;
        } catch (error) { this.error = error.message; throw error; }
    }
    /** Call inside the host history transaction. Only validated geometry is copied, never stale metadata. */
    commit(document) {
        this.assertSource(document);
        const preview = this.evaluate();
        document.entities = clone(preview.entities);
        return document.entities.find(e => e.id === this.resultId);
    }
    cancel() { this.closed = true; this.preview = null; this.base = null; this.source = null; this.undoStack.length = this.redoStack.length = 0; }
}
export function visibleFields3(session) {
    const p = (() => { try { return session.values(); } catch { return {}; } })();
    const fields = session.tool.fields.slice();
    if (!session.tool.inputs) fields.push(...['x', 'y', 'z'].map(name => ({ name, label: 'Position ' + name.toUpperCase(), value: 0 })));
    return fields.filter(f => {
        if (session.kind === 'extrude') return f.name === 'distance2' ? p.extent === 2 : ['nx', 'ny', 'nz'].includes(f.name) ? p.useNormal === 0 : true;
        if (session.kind === 'hole') return f.name === 'depth' ? p.through === 0 : f.name === 'counterDiameter' ? !!p.holeType : f.name === 'counterDepth' ? p.holeType === 1 : f.name === 'sinkAngle' ? p.holeType === 2 : true;
        if (['face-profile','sketch-profile'].includes(session.kind)) return f.name === 'radius' ? p.shape === 1 : ['width', 'height'].includes(f.name) ? p.shape === 0 : true;
        if (session.kind === 'vertex' && f.name === 'detach') return !!session.base.entities.find(e => e.id === session.inputs[0])?.feature3d;
        return true;
    });
}
