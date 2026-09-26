import { DocumentWorkspace } from '@conduitcad/workspace';
import { History } from '@conduitcad/history';
import { createDocument, validateDocument, clone, beginBlockEdit } from '@conduitcad/model';
import { DrawingSession } from '@conduitcad/drawing';
import { renderBlockBar, restoreHistory, refreshCalculations } from './parametric-workbench.js';
import { escapeHTML as E, icon } from './icons.js';
import { commandButton, commandContent } from './icons.js';

const defaults = () => ({ viewMode: '2d', model3dCamera: null, tool: 'select', category: 'P&ID', librarySearch: '', inspectorTab: 'properties', currentLayer: 'Process', lineStyle: 'process', gridSnap: true, objectSnap: true, ortho: false, multi: false, showConstraintAnnotations: false, draft: [], drawingSession: null, drawingOptions: {}, connectionStart: null, pendingSymbol: null, previewSymbol: null, blockSession: null, lastSolve: null, constraintLabels: [], lastRoutedIds: null, grid: true });
const fields = Object.keys(defaults());
const cameraState = w => ({ x: w.camera.x, y: w.camera.y, scale: w.camera.scale });
const dirty = session => session.revision !== session.savedRevision;
const button = (action,label,cls='') => commandButton(action,label,`btn ${cls}`);

export function createDocumentHistory(w) {
    return new History({
        capture: () => w.doc,
        restore: document => {
            w.doc = document;
            w.selection = new Set([...w.selection].filter(id => document.entities.some(e => e.id === id)));
            w.lastSolve = null;
            refreshCalculations(w);
            w.renderer.setDocument(document);
            w.updateUI();
        },
        onChange: () => {
            w.updateHistory();
            documentChanged(w);
            w.root.dispatchEvent(new CustomEvent('conduit:change', { detail: { document: w.doc, documentId: w.documents?.activeId } }));
        }
    });
}
export function captureActiveDocument(w) {
    const session = w.documents?.active;
    if (!session) return;
    const context = {};
    for (const key of fields) context[key] = key === 'grid' ? w.renderer.grid : w[key] ?? defaults()[key];
    context.doc = w.doc;
    context.history = w.history;
    context.selection = w.selection;
    context.camera = cameraState(w);
    context.libraryScroll = w.$('.library-scroll').scrollTop;
    context.inspectorScroll = w.$('.inspector-content').scrollTop;
    session.context = context;
    session.document = w.blockSession?.parentDocument || w.doc;
}
function snapshotSession(session) {
    const c = session.context, block = c.blockSession;
    const state = { model3dCamera: c.model3dCamera, camera: c.camera, selection: [...(c.selection || [])], settings: {}, libraryScroll: c.libraryScroll, inspectorScroll: c.inspectorScroll };
    for (const key of ['viewMode', 'category', 'librarySearch', 'inspectorTab', 'currentLayer', 'lineStyle', 'gridSnap', 'objectSnap', 'ortho', 'grid', 'showConstraintAnnotations', 'drawingOptions']) state.settings[key] = c[key];
    state.tool = block?.testing ? 'select' : c.tool;
    state.draft = block?.testing ? [] : c.draft;
    state.drawing = !block?.testing && c.drawingSession ? { tool: c.tool, options: c.drawingSession.options, points: c.drawingSession.points } : null;
    if (block) state.block = {
        name: block.name, signature: block.signature, draft: block.testing ? block.testDraft : c.doc,
        parentCamera: block.parentCamera, parentSelection: block.parentSelection,
        parentLayer: block.parentLayer, parentCategory: block.parentCategory
    };
    if (block && !block.testing && c.history?.pending) state.block.draft = JSON.parse(c.history.pending.before);
    if (block?.testing) { state.camera = block.testCamera; state.selection = block.testSelection; }
    return { document: !block && c.history?.pending ? JSON.parse(c.history.pending.before) : session.document, state };
}
function restoreContext(w, document, state = {}) {
    const context = { ...defaults(), doc: document, history: createDocumentHistory(w), selection: new Set(), camera: { x: 0, y: 0, scale: 1 } };
    for (const key of ['viewMode', 'category', 'librarySearch', 'inspectorTab', 'currentLayer', 'lineStyle']) if (typeof state.settings?.[key] === 'string') context[key] = state.settings[key];
    for (const key of ['gridSnap', 'objectSnap', 'ortho', 'grid', 'showConstraintAnnotations']) if (typeof state.settings?.[key] === 'boolean') context[key] = state.settings[key];
    for (const key of ['x', 'y', 'scale']) if (Number.isFinite(state.camera?.[key])) context.camera[key] = state.camera[key];
    if(state.model3dCamera && typeof state.model3dCamera === "object") context.model3dCamera = clone(state.model3dCamera);
    context.camera.scale = Math.min(5000, Math.max(.00001, context.camera.scale));
    if (state.settings?.drawingOptions && typeof state.settings.drawingOptions === 'object') context.drawingOptions = clone(state.settings.drawingOptions);
    if (state.block) {
        const block = state.block;
        const session = beginBlockEdit(document, block.name);
        session.draft = validateDocument(block.draft);
        if (!session.draft.blockEditing) throw new Error('Missing recovered block draft');
        Object.assign(session, { signature: block.signature, parentDocument: document, parentHistory: context.history, parentSelection: block.parentSelection || [], parentCamera: block.parentCamera || context.camera, parentLayer: block.parentLayer || '0', parentCategory: block.parentCategory || 'Custom' });
        context.blockSession = session;
        context.doc = session.draft;
        context.history = restoreHistory(w);
    }
    context.selection = new Set((Array.isArray(state.selection) ? state.selection : []).filter(id => context.doc.entities.some(e => e.id === id)));
    // Recovery resumes accepted geometry, never a partially applied pointer drag.
    if (state.drawing) {
        const session = new DrawingSession(state.drawing.tool, state.drawing.options);
        if (!Array.isArray(state.drawing.points) || state.drawing.points.length > 512 || state.drawing.points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('Invalid recovered drawing command');
        session.points = clone(state.drawing.points);
        context.tool = state.drawing.tool;
        context.drawingSession = session;
        context.draft = session.points;
    } else if (['line', 'polyline', 'rect', 'circle', 'dimension'].includes(state.tool)) {
        if (Array.isArray(state.draft) && state.draft.length <= 512 && state.draft.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) {
            context.tool = state.tool; context.draft = clone(state.draft);
        }
    }
    context.libraryScroll = Math.max(0, Number(state.libraryScroll) || 0);
    context.inspectorScroll = Math.max(0, Number(state.inspectorScroll) || 0);
    return context;
}
function recoveryIdentity(w) {
    if (w.options.workspaceKey) return { key: w.options.workspaceKey, recoveryKey: w.options.workspaceKey };
    let key, previous;
    try { key = sessionStorage.getItem('conduit-workspace-id'); previous = localStorage.getItem('conduit-recent-workspace'); } catch {}
    const recoveryKey = key || previous || 'default';
    key ||= globalThis.crypto?.randomUUID?.() || 'tab-' + Date.now().toString(36);
    try { sessionStorage.setItem('conduit-workspace-id', key); } catch {}
    return { key, recoveryKey };
}
export function initializeDocuments(w) {
    const identity = recoveryIdentity(w);
    w.recoveryKey = identity.recoveryKey;
    w.documents = new DocumentWorkspace({
        store: w.store, key: identity.key, maxDocuments: w.options.maxDocuments ?? 32,
        beforeSave: () => { if (!w.disposed) captureActiveDocument(w); }, capture: snapshotSession,
        onChange: event => {
            if (w.disposed) return;
            renderDocuments(w);
            if (event.type === 'saved') {
                try { localStorage.setItem('conduit-recent-workspace', w.documents.key); } catch {}
            }
            if (event.type === 'error') w.toast('Device recovery failed. Your tabs remain open; export a project copy.', true);
        }
    });
    w.documents.add(w.doc, { context: {} });
    captureActiveDocument(w);
    w.documentImportQueue = Promise.resolve();
    const nav = document.createElement('nav'); nav.className = 'document-bar'; nav.setAttribute('aria-label', 'Open drawings');
    nav.innerHTML = `<div class="document-tabs" role="tablist" aria-label="Drawing documents"></div><button type="button" class="document-new" data-action="new" aria-label="New drawing tab" title="New drawing tab">${icon('plus')}</button><button type="button" class="document-switcher" data-action="document-list" aria-label="Manage open drawings" title="Manage open drawings">${icon('layers')}<span class="document-count"></span></button>`;
    w.$('.appbar').after(nav);
    w.$('.workspace').id = 'document-panel';
    w.$('.workspace').setAttribute('role', 'tabpanel');
    const signal = w.abort.signal;
    nav.addEventListener('keydown', event => {
        const tabs = [...nav.querySelectorAll('[role="tab"]')], index = tabs.indexOf(event.target);
        if (index < 0) return;
        const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
        if (direction || ['Home', 'End'].includes(event.key)) {
            event.preventDefault(); event.stopPropagation();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + direction + tabs.length) % tabs.length;
            tabs.forEach((tab, i) => { tab.tabIndex = i === next ? 0 : -1; });
            tabs[next].focus();
        } else if (event.key === 'Delete') {
            event.preventDefault(); event.stopPropagation(); requestCloseDocument(w, event.target.dataset.documentId);
        }
    }, { signal });
    window.addEventListener('beforeunload', event => {
        if (w.documents.dirty || w.blockSession && w.history.pending) { event.preventDefault(); event.returnValue = ''; }
    }, { signal });
    window.addEventListener('pagehide', () => { if(!w.initializing)w.documents.saveAll().catch(() => {}); }, { signal });
    renderDocuments(w);
}
export async function claimWorkspace(w) {
    if (w.options.workspaceKey || !navigator.locks?.request) return;
    for (let attempt = 0; attempt < 3; attempt++) {
        const result = await new Promise(resolve => {
            navigator.locks.request('conduit-workspace:' + w.documents.key, { ifAvailable: true }, lock => {
                resolve(lock ? 'acquired' : 'busy');
                if (lock) return new Promise(release => { w.releaseWorkspaceLock = release; });
            }).catch(() => resolve('unavailable'));
        });
        if (result === 'acquired') return;
        w.documents.key = globalThis.crypto?.randomUUID?.() || 'window-' + Date.now().toString(36) + '-' + attempt;
        try { sessionStorage.setItem('conduit-workspace-id', w.documents.key); } catch {}
        if (result === 'unavailable') return;
        // A fork also needs a held lease: subsequently duplicating that page must fork again.
    }
    throw new Error('Could not acquire an exclusive recovery workspace');
}
export async function forkRecoveryWorkspace(w) {
    // Never overwrite damaged/partially recovered records with a new blank manifest.
    w.releaseWorkspaceLock?.(); w.releaseWorkspaceLock = null;
    w.documents.key = globalThis.crypto?.randomUUID?.() || 'recovered-' + Date.now().toString(36);
    try { sessionStorage.setItem('conduit-workspace-id', w.documents.key); } catch {}
    await claimWorkspace(w);
}
export async function recoverDocuments(w) {
    let recovery;
    try { recovery = await w.store.loadWorkspace(w.recoveryKey); }
    catch (error) { w.recoveryIncomplete = true; w.toast('Saved workspace could not be read. The recovery data has not been deleted.', true); return false; }
    if (!recovery?.records?.length) return false;
    if (recovery.manifest?.version !== 1 || !Array.isArray(recovery.records) || recovery.records.length > w.documents.maxDocuments) {
        w.recoveryIncomplete = true;
        w.toast('Saved workspace exceeds the document limit or has an unsupported format.', true); return false;
    }
    const restored = [], errors = [];
    for (const record of recovery.records) {
        try {
            if (!record || !/^[a-zA-Z0-9_-]{1,128}$/.test(record.id)) throw new Error('Missing drawing record');
            const document = validateDocument(record.document), context = restoreContext(w, document, record.state);
            if (restored.some(s => s.id === record.id)) throw new Error('Duplicate drawing session');
            restored.push({ id: record.id, document, context });
        } catch (error) { errors.push(error.message); }
    }
    if (!restored.length) { w.recoveryIncomplete = true; w.toast('No saved drawings could be recovered; original recovery records were retained.', true); return false; }
    w.documents.sessions = []; w.documents.activeId = null;
    for (const record of restored) w.documents.add(record.document, { id: record.id, context: record.context, saved: true, activate: false });
    if (errors.length) w.recoveryIncomplete = true;
    const id = w.documents.get(recovery.manifest.activeId)?.id || restored[0].id;
    applyDocument(w, w.documents.activate(id));
    w.toast(`Recovered ${restored.length} drawing${restored.length === 1 ? '' : 's'}${errors.length ? `; ${errors.length} record(s) could not be read` : ' from this device'}.`, errors.length > 0);
    return true;
}
export function documentChanged(w) {
    if (!w.documents || w.disposed) return;
    w.documents.markChanged();
    w.documents.schedule();
}
export function scheduleRecovery(w) { if (w.documents && !w.disposed && !w.initializing) w.documents.schedule(); }
function applyDocument(w, session) {
    const context = session.context;
    for (const key of fields) if (key !== 'grid') w[key] = context[key] ?? defaults()[key];
    w.doc = context.doc || session.document;
    w.history = context.history || createDocumentHistory(w);
    w.selection = context.selection || new Set();
    Object.assign(w.camera, context.camera || { x: 0, y: 0, scale: 1 });
    w.renderer.grid = context.grid ?? true;
    w.cursor = null; w.snap = null; w.preview = null; w.hoveredPort = null; w.drag = null; w.pointer = null;
    w.$('#symbol-search').value = w.librarySearch || '';
    w.$('.block-editor-bar')?.remove();
    for (const el of w.root.querySelectorAll('.appbar button:disabled')) el.disabled = false;
    renderBlockBar(w);
    w.renderer.setDocument(w.doc); w.renderer.resize(); w.updateUI(); w.renderer.invalidate();
    w.$('.library-scroll').scrollTop = context.libraryScroll || 0;
    w.$('.inspector-content').scrollTop = context.inspectorScroll || 0;
    if (!context.camera) { w.renderer.fit(); context.camera = cameraState(w); }
    renderDocuments(w);
}
export function activateDocument(w, id) {
    if (!w.documents.get(id)) throw new Error('Drawing is no longer open');
    w.closeModal(); w.closePanels(); w.hideContext();
    if (id === w.documents.activeId) return w.documents.active;
    w.input.reset(); w.cancelGesture(); captureActiveDocument(w);
    const previousId = w.documents.activeId;
    const session = w.documents.activate(id);
    applyDocument(w, session);
    scheduleRecovery(w);
    w.$(`[data-document-id="${id}"][role="tab"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    w.root.dispatchEvent(new CustomEvent('conduit:documentchange', { detail: { previousId, documentId: id, document: session.document } }));
    return session;
}
export function openDocument(w, document, options = {}) {
    // Capacity and validation are checked before cancelling any source gesture.
    if (w.documents.sessions.length >= w.documents.maxDocuments) throw new Error(`Close a drawing before opening more than ${w.documents.maxDocuments} documents`);
    validateDocument(document);
    w.closeModal(); w.closePanels(); w.input.reset(); w.cancelGesture(); captureActiveDocument(w);
    const context = { ...defaults(), ...(document.metadata?.modeling?.preferredMode === "3d" ? {viewMode:"3d"} : {}), ...options.context, doc: document, history: createDocumentHistory(w), selection: new Set() };
    const session = w.documents.add(document, { context });
    applyDocument(w, session); captureActiveDocument(w); scheduleRecovery(w);
    w.root.dispatchEvent(new CustomEvent('conduit:documentchange', { detail: { documentId: session.id, document } }));
    return session;
}
export function renderDocuments(w) {
    const workspace = w.documents, host = w.$('.document-tabs');
    if (!workspace || !host) return;
    const active = workspace.active;
    const data = workspace.sessions.map(session => ({ id: session.id, name: session.id === active?.id ? (w.blockSession?.parentDocument || w.doc).name : session.document.name, spatial: (session.id === active?.id ? w.viewMode : session.context.viewMode) === '3d', dirty: dirty(session), error: !!session.error, editing: session.id === active?.id ? !!w.blockSession : !!session.context.blockSession }));
    const signature = JSON.stringify([workspace.activeId, data]);
    if (w.documentTabSignature !== signature) {
        const scroll = host.scrollLeft, focusedNode = host.contains(document.activeElement) ? document.activeElement : null;
        const focused = focusedNode?.dataset?.documentId, operation = focusedNode?.dataset?.documentOperation;
        const reveal = w.lastRevealedDocument !== workspace.activeId;
        host.innerHTML = data.map(s => `<div class="document-tab-item ${s.id === workspace.activeId ? 'active' : ''}" role="presentation" data-dirty="${s.dirty}" data-recovery-error="${s.error}"><button type="button" role="tab" id="tab-${s.id}" data-document-id="${s.id}" data-document-operation="activate" aria-selected="${s.id === workspace.activeId}" aria-label="${E(s.name || 'Untitled drawing')}${s.editing ? ' · Block editor' : ''}${s.error ? ' · Recovery failed' : s.dirty ? ' · Not saved on device' : ' · Saved on device'}" aria-controls="document-panel" tabindex="${s.id === workspace.activeId ? 0 : -1}" title="${E(s.name)}${s.editing ? ' · Block editor' : ''}${s.dirty ? ' · Not saved on device' : ''}"><span class="document-indicator ${s.error ? 'error' : s.dirty ? 'dirty' : ''}" aria-hidden="true">${icon(s.editing ? 'block-edit' : s.spatial ? 'file-3d' : 'file-cad')}${s.error || s.dirty ? `<i class="document-state">${icon(s.error ? 'warning' : 'dot')}</i>` : ''}</span><span class="document-tab-name">${E(s.name || 'Untitled drawing')}</span>${s.editing ? '<span class="document-editing">Block</span>' : ''}</button><button type="button" class="document-tab-close" data-document-id="${s.id}" data-document-operation="close" tabindex="-1" aria-label="Close ${E(s.name)}">${icon('close')}</button></div>`).join('');
        host.scrollLeft = scroll;
        if (focused) host.querySelector(`[data-document-id="${focused}"][data-document-operation="${operation}"]`)?.focus({ preventScroll: true });
        if (reveal) {
            w.lastRevealedDocument = workspace.activeId;
            requestAnimationFrame(() => {
                if (w.disposed) return;
                const tab = host.querySelector('.document-tab-item.active');
                if (!tab) return;
                const a = tab.getBoundingClientRect(), b = host.getBoundingClientRect();
                if (a.right > b.right) host.scrollLeft += a.right - b.right + 4;
                else if (a.left < b.left) host.scrollLeft += a.left - b.left - 4;
            });
        }
        w.documentTabSignature = signature;
    }
    w.$('.document-count').textContent = String(workspace.sessions.length);
    w.$('.workspace').setAttribute('aria-labelledby', `tab-${workspace.activeId}`);
    w.$('.doc-name').textContent = data.find(s=>s.id===workspace.activeId)?.name || w.doc.name;
    const status = active?.error ? 'Recovery failed' : active?.saving ? 'Saving on device…' : active && dirty(active) ? 'Not yet saved on device' : 'Saved on device';
    const stateIcon=active?.error?'warning':active?.saving?'loading':active&&dirty(active)?'dot':'check-circle';
    const save=w.$('.save-status'); if(save.dataset.state!==status){save.dataset.state=status;save.innerHTML=`${icon(stateIcon)}<span>${E(status)}</span>`;}
    w.$('.document-switcher').title = `${workspace.sessions.length} open drawings · ${status}`;
    document.title = `${w.doc.name} — Conduit CAD`;
}
async function performClose(w, id, mode) {
    const workspace = w.documents, session = workspace.get(id);
    if (!session) return;
    if (mode === 'save') {
        await workspace.saveAll();
        if (dirty(session)) throw new Error('Drawing changed while saving; save it again before closing');
    }
    const wasActive = id === workspace.activeId;
    if (wasActive) { w.input.reset(); w.cancelGesture(); captureActiveDocument(w); }
    workspace.remove(id, { discard: mode === 'discard' });
    w.closeModal(); w.closePanels();
    if (workspace.active && wasActive) applyDocument(w, workspace.active);
    else if (workspace.active) renderDocuments(w);
    else openDocument(w, createDocument('Untitled drawing'));
    scheduleRecovery(w);
    w.$(`[role="tab"][data-document-id="${workspace.activeId}"]`)?.focus();
}
export function requestCloseDocument(w, id) {
    captureActiveDocument(w);
    const session = w.documents.get(id);
    if (!session) return;
    if (dirty(session) || session.context.blockSession || session.context.draft?.length) {
        w.openModal('Close drawing?', `<p><strong>${E(session.document.name)}</strong></p><p>${session.context.blockSession ? 'This tab has a block authoring session. Save on device keeps its recovery draft; it does not commit the draft into the block definition.' : 'Save a recovery copy on this device before closing. Export a project file for a portable backup.'}</p><div class="document-close-actions">${button('document-close-save:'+id,'Save on device & close','primary')}${button('document-close-discard:'+id,'Close without saving','danger')}${button('modal-close','Cancel')}</div><div class="error-text" role="alert"></div>`);
        return;
    }
    return performClose(w, id, 'saved');
}
export function documentList(w) {
    captureActiveDocument(w);
    w.openModal('Open drawings', `<p>Each drawing keeps its own undo history, view, selection and block-editing draft. Device recovery is not a downloaded project backup.</p><input type="search" id="document-search" aria-label="Find open drawing" placeholder="Find a drawing…"><div class="document-list">${w.documents.sessions.map((session, index) => `<section data-document-search="${E(session.document.name.toLowerCase())}"><button class="document-list-open" aria-current="${session.id === w.documents.activeId}" data-document-id="${session.id}" data-document-operation="activate"><strong>${E(session.document.name)}</strong><small>${session.id === w.documents.activeId ? 'Active · ' : ''}${session.document.entities.length} entities · ${session.document.units} · ${session.error ? 'Recovery failed' : dirty(session) ? 'Not saved' : 'Saved on device'}${session.context.blockSession ? ' · Block draft' : ''}</small></button><div class="document-list-actions">${button('document-rename:'+session.id,'Rename')}${button('document-duplicate:'+session.id,'Duplicate')}${button('document-reorder:'+session.id,'Move left',index === 0 ? 'first-document' : '')}${button('document-reorder-right:'+session.id,'Move right',index === w.documents.sessions.length - 1 ? 'first-document' : '')}${button('document-close:'+session.id,'Close')}</div></section>`).join('')}</div><details class="document-recent"><summary>Recently closed on this device</summary><div class="document-recent-list">Loading saved drawings…</div></details><div class="document-list-footer">${button('new','New drawing','primary')}${button('open','Open files')}${button('document-save-all','Save all on device')}</div>`, { wide: true });
    const modal = w.modal;
    w.store.listWorkspace?.(w.documents.key).then(records => {
        if (w.modal !== modal) return;
        const recent = records.filter(record => !w.documents.get(record.id)).slice(0, 30);
        modal.querySelector('.document-recent-list').innerHTML = recent.length ? recent.map(record => `<div><span>${E(record.name)}${record.blockDraft ? ' · Block draft' : ''}</span>${button('document-reopen:'+record.id,'Reopen')}</div>`).join('') : '<p>No closed drawings saved in this workspace.</p>';
    }).catch(() => { if (w.modal === modal) modal.querySelector('.document-recent-list').textContent = 'Device recovery is unavailable.'; });
    w.modal.querySelector('#document-search').addEventListener('input', event => {
        const query = event.target.value.toLowerCase();
        w.modal.querySelectorAll('[data-document-search]').forEach(row => { row.hidden = !row.dataset.documentSearch.includes(query); });
    });
}
export async function documentAction(w, action) {
    const separator = action.indexOf(':'), command = separator < 0 ? action : action.slice(0, separator), id = separator < 0 ? w.documents.activeId : action.slice(separator + 1);
    if (command === 'document-list') documentList(w);
    else if (command === 'document-save-all') { await w.documents.saveAll(); w.toast('All open drawings saved on this device.'); w.closeModal(); }
    else if (command === 'document-reopen') {
        if (w.documents.get(id)) { activateDocument(w, id); return; }
        const record = await w.store.loadWorkspaceRecord(id, w.documents.key);
        if (!record) throw new Error('Saved drawing could not be found');
        const document = validateDocument(record.document), context = restoreContext(w, document, record.state);
        if (w.documents.sessions.length >= w.documents.maxDocuments) throw new Error('Close a drawing before reopening more files');
        w.input.reset(); w.cancelGesture(); captureActiveDocument(w); w.closeModal(); w.closePanels();
        const session = w.documents.add(document, { id, context, saved: true });
        applyDocument(w, session); scheduleRecovery(w);
    }
    else if (command === 'document-close') await requestCloseDocument(w, id);
    else if (command === 'document-close-save') await performClose(w, id, 'save');
    else if (command === 'document-close-discard') await performClose(w, id, 'discard');
    else if (command === 'document-duplicate') {
        captureActiveDocument(w);
        const session = w.documents.get(id); if (!session) throw new Error('Drawing is no longer open');
        const copied = clone(session.document); copied.name += ' — copy';
        openDocument(w, copied); w.toast('Independent copy opened; unsaved block drafts are not committed into the copy.');
    } else if (command === 'document-rename') {
        const session = w.documents.get(id); if (!session) throw new Error('Drawing is no longer open');
        if (session.context.blockSession || id === w.documents.activeId && w.blockSession) throw new Error('Save or close this drawing’s block editor before renaming');
        w.ask('Rename drawing', [{ name: 'name', label: 'Drawing name', value: session.document.name }], values => {
            const name = values.name.trim(); if (!name || name.length > 200) throw new Error('Enter a drawing name of 1–200 characters');
            activateDocument(w, id);
            w.edit('Rename drawing', () => { (w.blockSession?.parentDocument || w.doc).name = name; });
        });
    } else if (command === 'document-reorder-right') {
        const index = w.documents.sessions.findIndex(session => session.id === id);
        if (index >= 0 && index < w.documents.sessions.length - 1) { w.documents.move(id, index + 1); scheduleRecovery(w); documentList(w); }
    } else if (command === 'document-reorder') {
        const index = w.documents.sessions.findIndex(session => session.id === id);
        if (index > 0) { w.documents.move(id, index - 1); scheduleRecovery(w); documentList(w); }
    } else throw new Error('Unknown document command');
}
export function documentKeyDown(w, event) {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 's' && !w.modal) {
        event.preventDefault(); documentAction(w, 'document-save-all').catch(error => w.toast(error.message, true)); return true;
    }
    if (event.altKey && ['PageUp', 'PageDown'].includes(event.key) && !w.modal) {
        event.preventDefault(); const sessions = w.documents.sessions, index = sessions.findIndex(s => s.id === w.documents.activeId);
        activateDocument(w, sessions[(index + (event.key === 'PageUp' ? -1 : 1) + sessions.length) % sessions.length].id); return true;
    }
    return !!event.target.closest?.('.document-bar');
}
export function disposeDocuments(w) {
    captureActiveDocument(w);
    const pending = w.documents.saveAll();
    w.disposed = true; w.documents.dispose();
    return pending.catch(() => {}).finally(() => { w.releaseWorkspaceLock?.(); w.store.dispose(); });
}
