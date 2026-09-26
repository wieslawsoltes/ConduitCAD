import { MODELING_TOOLS, addFeature, editFeature, faceFrame3, faceCoordinates3, profileOnFace3 } from '@conduitcad/modeling';
import { isLocked } from '@conduitcad/model';
import { escapeHTML as E } from './icons.js';

const button = (action, label, extra = '') => `<button type="button" data-action="${E(action)}" ${extra}>${E(label)}</button>`;
export function fields3(values) {
    return values.map(f => `<label class="field" data-model-row="${E(f.name)}">${E(f.label)}${f.options
        ? `<select data-model-field="${E(f.name)}">${f.options.some((_, i) => String(f.value) === String(i)) ? '' : `<option value="${E(String(f.value))}" selected>Expression: ${E(String(f.value))}</option>`}${f.options.map((label, i) => `<option value="${i}" ${String(f.value) === String(i) ? 'selected' : ''}>${E(label)}</option>`).join('')}</select>`
        : `<input data-model-field="${E(f.name)}" value="${E(String(f.value ?? ''))}" autocomplete="off" spellcheck="false">`}</label>`).join('');
}
const isProfile = e => ['CIRCLE', 'ELLIPSE', 'LWPOLYLINE', 'POLYLINE', 'SPLINE'].includes(e.type);
function options(entities, chosen) {
    return entities.map(e => `<option value="${E(e.id)}" ${e.id === chosen ? 'selected' : ''}>${E(e.label || e.type + ' ' + e.id)}${e.model3dConsumed ? ' · history input' : ''}</option>`).join('');
}

export function readOperation3(m) {
    const modal = m.w.modal;
    if (!modal) throw new Error('No modeling dialog');
    const parameters = Object.fromEntries([...modal.querySelectorAll('[data-model-field]')].map(e => [e.dataset.modelField, e.value]));
    const inputs = [...modal.querySelectorAll('[data-model-input]')].map(e => e.value);
    if (m.operation?.kind === 'extrude' && m.w.eval(parameters.operation)) inputs.push(modal.querySelector('[data-model-target]')?.value || '');
    return { parameters, inputs, name: modal.querySelector('[data-model-name]')?.value || 'Feature', reattach: !!modal.querySelector('[data-model-reattach]')?.checked };
}

/** A single inspector form for desktop and touch; preview and apply share the exact evaluator. */
export function openOperation3(m, kind, id = null) {
    const w = m.w, tool = MODELING_TOOLS.find(t => t.id === kind), doc = w.doc;
    if (!tool) throw new Error('Unknown modeling tool');
    const existing = id ? doc.entities.find(e => e.id === id) : null;
    if (id && !existing?.feature3d) throw new Error('Feature no longer exists');
    if (existing && isLocked(existing, doc)) throw new Error('The selected body is locked');
    const candidates = doc.entities.filter(e => e.id !== id && !e.feature3d?.suppressed &&
        (['extrude', 'revolve', 'loft'].includes(kind) ? isProfile(e) : kind === 'sweep' ? isProfile(e) || e.type === 'LINE' : e.type === 'MESH'));
    const selected = [...w.selection].filter(id => candidates.some(e => e.id === id));
    const count = tool.multiple ? Math.max(tool.inputs, selected.length, existing?.feature3d.inputs.length || 0) : tool.inputs || 0;
    const chosenInputs = Array.from({ length: count }, (_, i) => existing?.feature3d.inputs[i] || selected[i] || candidates[i]?.id);
    const names = kind === 'subtract' ? ['Target body', 'Cutting body'] : kind === 'sweep' ? ['Profile', 'Path'] : kind === 'hole' ? ['Target body'] : ['extrude', 'revolve'].includes(kind) ? ['Profile'] : [];
    const inputs = chosenInputs.map((chosen, i) => `<label class="field">${names[i] || 'Input ' + (i + 1)}<select data-model-input>${options(candidates, chosen)}</select></label>`).join('');
    const inputFields = tool.fields.map(f => ({ ...f, value: existing?.feature3d.parameters?.[f.name] ?? f.value }));
    if (!count) for (const axis of ['x', 'y', 'z']) inputFields.push({ name: axis, label: 'Position ' + axis.toUpperCase(), value: existing?.feature3d.parameters?.[axis] ?? 0 });
    const set = (name, value) => { const f = inputFields.find(f => f.name === name); if (f) f.value = value; };
    if (!id && kind === 'extrude') set('useNormal', 1);
    if (!id && ['offset-face', 'hole'].includes(kind) && m.hit?.id === chosenInputs[0] && m.hit.face !== undefined) {
        set('face', m.hit.face);
        if (kind === 'hole') {
            const uv = faceCoordinates3(faceFrame3(candidates.find(e => e.id === m.hit.id), m.hit.face), m.hit.point);
            set('u', Number(uv.u.toPrecision(12))); set('v', Number(uv.v.toPrecision(12)));
        }
    }
    const bodies = doc.entities.filter(e => e.type === 'MESH' && e.id !== id && !e.feature3d?.suppressed);
    const target = existing?.feature3d.inputs[1] || [...w.selection].find(id => bodies.some(e => e.id === id)) || bodies.find(e => !e.model3dConsumed)?.id;
    const targetField = kind === 'extrude' ? `<label class="field" data-model-target-row>Target body<select data-model-target><option value="">Select target…</option>${options(bodies, target)}</select></label>` : '';
    const help = kind === 'extrude' ? 'Choose a profile, extent and operation. Symmetric distance is the total length. Cut/Join/Intersect requires a target mesh.'
        : kind === 'hole' ? 'Pick a planar face first, or choose its index. U/V offsets are measured from the face center along its local axes. Through all follows target thickness.'
        : 'Numeric fields accept design parameter expressions. Apply commits a single undoable feature.';
    w.openModal((id ? 'Edit ' : 'Create ') + tool.label,
        `<p class="model3d-operation-help">${E(help)}</p>${inputs}<div class="model3d-fields">${fields3(inputFields)}</div>${targetField}
        ${existing?.feature3d.attachment ? '<label class="model3d-reattach"><input type="checkbox" data-model-reattach> Reattach to the current face topology</label>' : ''}
        <label class="field">Feature name<input data-model-name value="${E(existing?.label || tool.label)}"></label>
        ${button('3d-preview', 'Preview without saving', 'class="btn"')}<div class="model3d-preview-state" role="status">Not applied</div><div class="error-text" role="alert"></div>`,
        { confirm: id ? 'Apply feature edit' : 'Create feature', onConfirm: () => {
            if (w.doc !== doc) throw new Error('The active drawing changed; reopen the operation');
            const values = m.readOperation(); let result;
            w.edit(id ? 'Edit 3D feature' : 'Create ' + tool.label, () => {
                result = id ? editFeature(w.doc, id, values) : addFeature(w.doc, kind, values.parameters, values.inputs, { name: values.name, color: w.selected()[0]?.color });
                w.selection = new Set([result.id]);
            });
            w.closeModal(); m.hit = null; m.sync();
            // Preserve view while modifying an existing body; only new standalone bodies refit.
            if (!id && !w.eval(values.parameters.operation ?? 0) && kind !== 'hole') { m.renderer.fit(); m.saveView(); }
        } });
    m.operation = { kind, id };
    w.modal.querySelector('.modal').classList.add('model3d-operation-dialog');
    const updateFields = () => {
        const value = n => { try { return w.eval(w.modal?.querySelector(`[data-model-field="${n}"]`)?.value); } catch { return NaN; } };
        const visible = (name, shown) => { const el = w.modal?.querySelector(`[data-model-row="${name}"]`); if (el) el.hidden = !shown; };
        if (kind === 'extrude') {
            visible('distance2', value('extent') === 2);
            for (const axis of ['nx', 'ny', 'nz']) visible(axis, value('useNormal') === 0);
            w.modal.querySelector('[data-model-target-row]').hidden = !value('operation');
        }
        if (kind === 'hole') {
            visible('depth', !value('through'));
            visible('counterDiameter', value('holeType') !== 0);
            visible('counterDepth', value('holeType') === 1);
            visible('sinkAngle', value('holeType') === 2);
        }
    };
    const invalidate = () => {
        updateFields();
        const operation = m.operation;
        if (m.previewDocument) { m.clearPreview(); m.operation = operation; }
        const state = w.modal?.querySelector('.model3d-preview-state');
        if (state) state.textContent = 'Changed · Preview or Apply to evaluate';
    };
    w.modal.addEventListener('input', invalidate); w.modal.addEventListener('change', invalidate);
    updateFields();
}

export function selectionToolbar3() {
    return `<div class="model3d-selection-tools" role="toolbar" aria-label="3D selection and navigation">
        ${['body', 'face', 'vertex'].map(mode => button('3d-pick:' + mode, mode[0].toUpperCase() + mode.slice(1), `aria-pressed="${mode === 'body'}"`)).join('')}
        ${button('3d-nav-toggle', 'Orbit', 'aria-label="Toggle orbit or pan navigation"')}
        ${button('3d-multi', 'Multi', 'aria-pressed="false"')}${button('3d-clear', 'Clear', 'aria-label="Clear 3D selection"')}
        </div>`;
}

export function syncAuthoring3(m) {
    const w = m.w, items = w.selected(), one = items.length === 1 ? items[0] : null;
    const face = one?.type === 'MESH' && m.hit?.id === one.id && m.hit?.face !== undefined && m.pickMode === 'face';
    for (const mode of ['body', 'face', 'vertex']) m.stage.querySelector(`[data-action="3d-pick:${mode}"]`)?.setAttribute('aria-pressed', String(m.pickMode === mode));
    const nav = m.stage.querySelector('[data-action="3d-nav-toggle"]');
    if (nav) { nav.textContent = m.navigation === 'pan' ? 'Pan' : 'Orbit'; nav.setAttribute('aria-pressed', String(m.navigation === 'pan')); }
    m.stage.querySelector('[data-action="3d-multi"]')?.setAttribute('aria-pressed', String(w.multi));
    const hint = m.stage.querySelector('.model3d-hint');
    const gesture = m.navigation === 'pan' ? 'pan' : 'orbit';
    if (hint) hint.textContent = `Drag to ${gesture} · two fingers pan / pinch · tap to select ${m.pickMode}`;
    m.host?.setAttribute('aria-label', `3D CAD model. Drag to ${gesture}, two fingers pan and zoom; tap to select ${m.pickMode}.`);
    const context = m.stage.querySelector('.model3d-context');
    const actions = face ? [['3d-face-profile', 'Sketch on face'], ['3d-op-hole', 'Hole'], ['3d-op-offset-face', 'Press / pull'], ['3d-look-face', 'Look at face']]
        : one && isProfile(one) ? [['3d-op-extrude', 'Extrude'], ['3d-op-revolve', 'Revolve'], ['3d-vertex', 'Edit profile']]
        : one?.type === 'MESH' ? [['3d-op-transform', 'Move'], ['3d-pick:face', 'Select face'], ['3d-visibility', one.hidden ? 'Show body' : 'Hide body']]
        : items.filter(e => e.type === 'MESH').length === 2 ? [['3d-op-union', 'Join'], ['3d-op-subtract', 'Cut'], ['3d-op-intersect', 'Intersect']]
        : [['3d-sketch', 'Create profile'], ['3d-op-box', 'Box'], ['3d-op-cylinder', 'Cylinder']];
    const label = face ? 'Face ' + m.hit.face : one ? one.label || one.type : items.length ? items.length + ' selected' : 'Start modeling';
    const html = `<span class="model3d-selection-label" title="${E(label)}">${E(label)}</span>${actions.map(([a, b]) => button(a, b)).join('')}`;
    if (context && context.innerHTML !== html) context.innerHTML = html;
    for (const action of ['3d-edit', '3d-op-transform', '3d-measure']) {
        const b = m.stage.querySelector(`.model3d-dock [data-action="${action}"]`);
        if (b) b.disabled = action === '3d-op-transform' ? one?.type !== 'MESH' : action === '3d-edit' ? !one : false;
    }
}

export function faceProfileDialog3(m) {
    const w = m.w, target = w.selected()[0], hit = m.hit;
    if (w.selection.size !== 1 || target?.type !== 'MESH' || hit?.id !== target.id || hit.face === undefined) throw new Error('Select one planar mesh face first');
    const uv = faceCoordinates3(faceFrame3(target, hit.face), hit.point);
    w.openModal('Sketch profile on selected face', `<p>Create a native face-aligned profile, then Extrude it. This profile is a snapshot, not an associative sketch-on-face constraint.</p>
        <label class="field">Shape<select id="face-profile-shape"><option value="rectangle">Rectangle</option><option value="circle">Circle</option></select></label>
        ${fields3([{ name: 'width', label: 'Width', value: 30 }, { name: 'height', label: 'Height', value: 20 }, { name: 'radius', label: 'Circle radius', value: 10 }, { name: 'u', label: 'Face U offset', value: uv.u }, { name: 'v', label: 'Face V offset', value: uv.v }, { name: 'offset', label: 'Normal offset', value: 0 }])}<div class="error-text" role="alert"></div>`,
        { confirm: 'Create profile', onConfirm: () => {
            const values = Object.fromEntries([...w.modal.querySelectorAll('[data-model-field]')].map(e => [e.dataset.modelField, w.eval(e.value)]));
            const profile = profileOnFace3(target, hit.face, { ...values, shape: w.modal.querySelector('#face-profile-shape').value });
            w.edit('Create face-aligned profile', () => { w.doc.entities.push(profile); w.selection = new Set([profile.id]); });
            w.closeModal(); m.hit = null; m.sync();
        } });
    const update = () => {
        const round = w.modal.querySelector('#face-profile-shape').value === 'circle';
        for (const field of ['width', 'height', 'radius']) w.modal.querySelector(`[data-model-row="${field}"]`).hidden = field === 'radius' ? !round : round;
    };
    w.modal.querySelector('#face-profile-shape').addEventListener('change', update); update();
    w.modal.querySelector('.modal').classList.add('model3d-operation-dialog');
}

export function authoringAction3(m, action) {
    const w = m.w;
    if (action.startsWith('3d-pick:')) {
        const mode = action.slice(8); if (!['body', 'face', 'vertex'].includes(mode)) throw new Error('Unknown selection mode');
        m.pickMode = mode; m.hit = null; m.renderer.marker = null; m.selectionChanged(); m.renderInspector();
    } else if (action === '3d-clear') {
        w.selection.clear(); m.hit = null; m.renderer.marker = null; w.updateSelection();
    } else if (action === '3d-nav-toggle') m.navigation = m.navigation === 'pan' ? 'orbit' : 'pan';
    else if (action === '3d-face-profile') faceProfileDialog3(m);
    else if (action === '3d-look-face') {
        const e = w.selected()[0]; if (e?.type !== 'MESH' || m.hit?.id !== e.id || m.hit.face === undefined) throw new Error('Select a planar face');
        const frame = faceFrame3(e, m.hit.face);
        m.camera.target = { ...frame.origin }; m.camera.yaw = Math.atan2(frame.normal.y, frame.normal.x);
        m.camera.pitch = Math.max(-Math.PI / 2 + 1e-6, Math.min(Math.PI / 2 - 1e-6, Math.asin(frame.normal.z)));
        m.camera.perspective = false; m.changedView(); m.saveView();
    } else if (action === '3d-visibility') {
        const e = w.selected()[0]; if (!e || isLocked(e, w.doc)) throw new Error('Select an unlocked body');
        w.edit(e.hidden ? 'Show 3D body' : 'Hide 3D body', () => { w.doc.entities.find(q => q.id === e.id).hidden = !e.hidden; });
    } else return false;
    syncAuthoring3(m); return true;
}
