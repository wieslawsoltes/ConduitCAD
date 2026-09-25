import test from 'node:test';
import assert from 'node:assert/strict';
import { DocumentWorkspace, mergeClipboardBlocks } from '@conduitcad/workspace';
import { ProjectStore } from '@conduitcad/storage';

const document = (name = 'Drawing') => ({ name, entities: [], blocks: {}, layers: [] });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const turn = () => new Promise(resolve => setImmediate(resolve));
const memory = () => ({ writes: [], async saveWorkspace(records, manifest, key) { this.writes.push(structuredClone({ records, manifest, key })); } });

test('sessions have independent IDs even for identical document names', () => {
    const w = new DocumentWorkspace(); const a = w.add(document()), b = w.add(document());
    assert.notEqual(a.id, b.id); assert.equal(w.sessions.length, 2); assert.equal(w.active, b);
});
test('caller session IDs are validated and duplicates refused before insertion', () => {
    const w = new DocumentWorkspace(); w.add(document(), { id: 'one' });
    for (const id of ['one', '../bad', 'a" onclick=', 'x'.repeat(129)]) assert.throws(() => w.add(document(), { id }));
    assert.equal(w.sessions.length, 1);
});
test('document cap never evicts existing drawings', () => {
    const w = new DocumentWorkspace({ maxDocuments: 1 }); const a = w.add(document());
    assert.throws(() => w.add(document()), /Close a drawing/); assert.equal(w.active, a);
});
test('workspace options reject invalid limits', () => {
    for (const maxDocuments of [0, -1, 129, 1.5, NaN]) assert.throws(() => new DocumentWorkspace({ maxDocuments }));
    assert.throws(() => new DocumentWorkspace({ debounce: NaN }));
});
test('activation retains opaque histories and geometry references', () => {
    const w = new DocumentWorkspace(), history = { undo: ['first'] };
    const a = w.add(document('A'), { context: { history } }), b = w.add(document('B'));
    w.activate(a.id); assert.equal(w.active.context.history, history); assert.equal(w.get(b.id), b);
    assert.throws(() => w.activate('missing')); assert.equal(w.active, a);
});
test('closed active tab selects its adjacent neighbor; last tab can be removed', () => {
    const w = new DocumentWorkspace(); const a = w.add(document(), { saved: true }), b = w.add(document(), { saved: true });
    w.remove(b.id); assert.equal(w.active, a); w.remove(a.id); assert.equal(w.active, null);
});
test('unsaved close requires explicit discard', () => {
    const w = new DocumentWorkspace(), a = w.add(document());
    assert.throws(() => w.remove(a.id), /Save/); assert.equal(w.active, a);
    assert.equal(w.remove(a.id, { discard: true }), true); assert.equal(w.remove(a.id), false);
});
test('closing an inactive session preserves active selection', () => {
    const w = new DocumentWorkspace(), a = w.add(document(), { saved: true }), b = w.add(document(), { saved: true });
    w.remove(a.id); assert.equal(w.active, b);
});
test('tab reorder does not change the active document', () => {
    const w = new DocumentWorkspace(), a = w.add(document()), b = w.add(document()), c = w.add(document());
    w.move(c.id, 0); assert.deepEqual(w.sessions.map(s => s.id), [c.id, a.id, b.id]); assert.equal(w.active, c);
    assert.throws(() => w.move(a.id, 3));
});
test('save snapshots all drawing records with one ordered active manifest', async () => {
    const store = memory(), w = new DocumentWorkspace({ store, key: 'example' });
    const a = w.add(document('A')), b = w.add(document('B')); w.activate(a.id);
    await w.saveAll(); assert.equal(w.dirty, false); assert.equal(store.writes.length, 1);
    assert.deepEqual(store.writes[0].manifest.ids, [a.id, b.id]); assert.equal(store.writes[0].manifest.activeId, a.id);
});
test('edits made during an asynchronous write stay dirty', async () => {
    const gate = deferred(), store = { async saveWorkspace(records) { this.records = records; await gate.promise; } };
    const w = new DocumentWorkspace({ store }), a = w.add(document());
    const save = w.saveAll(); await turn(); a.document.name = 'Later'; w.markChanged(a.id);
    assert.equal(store.records[0].document.name, 'Drawing'); gate.resolve(); await save;
    assert.equal(w.dirty, true); assert.equal(a.savedRevision, 0); assert.equal(a.revision, 1);
});
test('later save is serialized and captures fresh document data', async () => {
    const gate = deferred(), writes = [];
    const store = { async saveWorkspace(records) { writes.push(records); if (writes.length === 1) await gate.promise; } };
    const w = new DocumentWorkspace({ store }), a = w.add(document());
    const first = w.saveAll(); await turn(); a.document.name = 'New'; w.markChanged(); const second = w.saveAll();
    await turn(); assert.equal(writes.length, 1); gate.resolve(); await Promise.all([first, second]);
    assert.equal(writes[1][0].document.name, 'New'); assert.equal(w.dirty, false);
});
test('failed writes retain every dirty tab and recovery errors', async () => {
    const w = new DocumentWorkspace({ store: { async saveWorkspace() { throw new Error('quota'); } } });
    const a = w.add(document()), b = w.add(document()); await assert.rejects(w.saveAll(), /quota/);
    assert.equal(w.sessions.length, 2); assert.equal(w.dirty, true); assert.ok(a.error && b.error); assert.equal(a.saving, false);
});
test('save queue recovers after errors rather than poisoning subsequent attempts', async () => {
    const store = memory(), w = new DocumentWorkspace({ store }); w.add(document());
    const original = store.saveWorkspace; store.saveWorkspace = async () => { throw new Error('unavailable'); };
    await assert.rejects(w.saveAll()); store.saveWorkspace = original; await w.saveAll(); assert.equal(w.error, null); assert.equal(w.dirty, false);
});
test('closing during a save cannot resurrect a tab in the next manifest', async () => {
    const gate = deferred(), writes = [];
    const store = { async saveWorkspace(records, manifest) { writes.push({ records, manifest }); if (writes.length === 1) await gate.promise; } };
    const w = new DocumentWorkspace({ store }), a = w.add(document()), b = w.add(document());
    const first = w.saveAll(); await turn(); w.remove(b.id, { discard: true }); const last = w.saveAll(); gate.resolve(); await Promise.all([first, last]);
    assert.deepEqual(writes[1].manifest.ids, [a.id]); assert.equal(w.get(b.id), null);
});
test('explicit capture serializes view and draft but not host context functions', async () => {
    const store = memory(), w = new DocumentWorkspace({ store, capture: s => ({ document: s.document, state: { camera: s.context.camera } }) });
    w.add(document(), { context: { history: () => { throw new Error('never serialized'); }, camera: { x: 50 } } });
    await w.saveAll(); assert.deepEqual(store.writes[0].records[0].state.camera, { x: 50 });
});
test('beforeSave captures active state at execution, not queue admission', async () => {
    const store = memory(), w = new DocumentWorkspace({ store }); const a = w.add(document());
    w.beforeSave = () => { a.document.name = 'Captured'; }; await w.saveAll(); assert.equal(store.writes[0].records[0].document.name, 'Captured');
});
test('disposed workspace cancels timers and rejects new saves and documents', async () => {
    const store = memory(), w = new DocumentWorkspace({ store, debounce: 10 }); w.add(document()); w.schedule(); w.dispose();
    await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(store.writes.length, 0); await assert.rejects(w.saveAll()); assert.throws(() => w.add(document()));
});
test('save snapshots reject non-serializable models before issuing storage writes', async () => {
    const store = memory(), w = new DocumentWorkspace({ store }), a = w.add(document()); a.document.cycle = a.document;
    await assert.rejects(w.saveAll()); assert.equal(store.writes.length, 0); assert.equal(w.dirty, true);
});

const block = (name, entities) => ({ name, entities });
test('clipboard imports only reachable blocks', () => {
    const src = { A: block('A', [{ type: 'LINE' }]), Unused: block('Unused', []) };
    const out = mergeClipboardBlocks({}, src, [{ type: 'INSERT', block: 'A' }]);
    assert.deepEqual(Object.keys(out.blocks), ['A']); assert.equal(out.entities[0].block, 'A');
});
test('clipboard colliding definitions receive independent names', () => {
    const dst = { A: block('A', [{ x: 1 }]) }, src = { A: block('A', [{ x: 2 }]) };
    const out = mergeClipboardBlocks(dst, src, [{ type: 'INSERT', block: 'A' }]);
    assert.equal(out.entities[0].block, 'A_copy1'); assert.equal(dst.A.entities[0].x, 1); assert.equal(src.A.entities[0].x, 2);
});
test('clipboard collision rewrites transitive nested dependencies', () => {
    const dst = { A: block('A', [{ x: 1 }]), Parent: block('Parent', [{ type: 'INSERT', block: 'A' }]) };
    const src = { A: block('A', [{ x: 2 }]), Parent: block('Parent', [{ type: 'INSERT', block: 'A' }]) };
    const out = mergeClipboardBlocks(dst, src, [{ type: 'INSERT', block: 'Parent' }]);
    assert.equal(out.entities[0].block, 'Parent_copy1'); assert.equal(out.blocks.Parent_copy1.entities[0].block, 'A_copy1');
});
test('identical destination definitions are reused without mutation', () => {
    const src = { A: block('A', []) }; const out = mergeClipboardBlocks(structuredClone(src), src, [{ block: 'A' }]);
    assert.equal(Object.keys(out.blocks).length, 0); assert.equal(out.entities[0].block, 'A');
});
test('clipboard recursive nesting is rejected', () => {
    const src = { A: block('A', [{ block: 'B' }]), B: block('B', [{ block: 'A' }]) };
    assert.throws(() => mergeClipboardBlocks({}, src, [{ block: 'A' }]), /Circular/);
});
test('clipboard name allocation skips existing suffixed names', () => {
    const dst = { A: block('A', [{ x: 1 }]), A_copy1: block('A_copy1', []) };
    assert.equal(mergeClipboardBlocks(dst, { A: block('A', [{ x: 2 }]) }, [{ block: 'A' }]).entities[0].block, 'A_copy2');
});

function localStore() {
    const data = new Map();
    return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
test('localStorage fallback stores manifest and records atomically and round-trips order', async () => {
    const old = globalThis.localStorage; globalThis.localStorage = localStore();
    const store = new ProjectStore({ database: 'test-workspace' });
    try {
        const records = [{ id: 'a', document: document('A') }, { id: 'b', document: document('B') }];
        await store.saveWorkspace(records, { version: 1, ids: ['b', 'a'], activeId: 'a' });
        assert.equal(globalThis.localStorage.data.size, 1);
        const saved = await store.loadWorkspace(); assert.deepEqual(saved.records.map(r => r.document.name), ['B', 'A']);
    } finally { store.dispose(); globalThis.localStorage = old; }
});
test('closed saved drawing records remain available without reopening at startup', async () => {
    const old = globalThis.localStorage; globalThis.localStorage = localStore(); const store = new ProjectStore();
    try {
        await store.saveWorkspace([{ id: 'a', document: document('A') }, { id: 'b', document: document('B') }], { version: 1, ids: ['a', 'b'], activeId: 'b' });
        await store.saveWorkspace([{ id: 'a', document: document('A2') }], { version: 1, ids: ['a'], activeId: 'a' });
        assert.equal((await store.loadWorkspace()).records.length, 1);
        assert.equal((await store.loadWorkspaceRecord('b')).document.name, 'B'); assert.equal((await store.listWorkspace()).length, 2);
    } finally { store.dispose(); globalThis.localStorage = old; }
});
test('quota failure leaves previous localStorage checkpoint intact', async () => {
    const old = globalThis.localStorage, storage = localStore(); globalThis.localStorage = storage; const store = new ProjectStore();
    try {
        await store.saveWorkspace([{ id: 'a', document: document('Before') }], { version: 1, ids: ['a'], activeId: 'a' });
        storage.setItem = () => { throw new Error('quota'); };
        await assert.rejects(store.saveWorkspace([{ id: 'a', document: document('After') }], { version: 1, ids: ['a'], activeId: 'a' }), /quota/);
        assert.equal((await store.loadWorkspace()).records[0].document.name, 'Before');
    } finally { store.dispose(); globalThis.localStorage = old; }
});
test('workspace keys isolate different browser workspaces', async () => {
    const old = globalThis.localStorage; globalThis.localStorage = localStore(); const store = new ProjectStore();
    try {
        for (const key of ['one', 'two']) await store.saveWorkspace([{ id: 'a', document: document(key) }], { version: 1, ids: ['a'], activeId: 'a' }, key);
        assert.equal((await store.loadWorkspace('one')).records[0].document.name, 'one'); assert.equal((await store.loadWorkspace('two')).records[0].document.name, 'two');
    } finally { store.dispose(); globalThis.localStorage = old; }
});
test('invalid recovery records are rejected before any writes', async () => {
    const old = globalThis.localStorage; globalThis.localStorage = localStore(); const store = new ProjectStore();
    try { await assert.rejects(store.saveWorkspace([{ id: 'a' }], { ids: ['a'] })); assert.equal(globalThis.localStorage.data.size, 0); }
    finally { store.dispose(); globalThis.localStorage = old; }
});

test('clipboard collisions honor case-insensitive DXF block names', () => {
    const dst = { Motor: block('Motor', [{ x: 1 }]), MOTOR_COPY1: block('MOTOR_COPY1', []) };
    const src = { motor: block('motor', [{ x: 2 }]) };
    const out = mergeClipboardBlocks(dst, src, [{ block: 'MOTOR' }]);
    assert.equal(out.entities[0].block, 'motor_copy2'); assert.equal(dst.Motor.entities[0].x, 1);
});
test('clipboard identical case-variant definitions reuse the destination spelling', () => {
    const out = mergeClipboardBlocks({ MOTOR: block('MOTOR', []) }, { motor: block('motor', []) }, [{ block: 'Motor' }]);
    assert.equal(out.entities[0].block, 'MOTOR'); assert.equal(Object.keys(out.blocks).length, 0);
});
test('ambiguous case-duplicate block graphs are refused before importing', () => {
    assert.throws(() => mergeClipboardBlocks({}, { A: block('A', []), a: block('a', []) }, [{ block: 'a' }]), /Ambiguous/);
});
test('storage refuses duplicate and missing manifest IDs without writes', async () => {
    const old = globalThis.localStorage; globalThis.localStorage = localStore(); const store = new ProjectStore();
    try {
        for (const manifest of [{version:1,ids:['b'],activeId:'b'}, {version:1,ids:['a','a'],activeId:'a'}, {version:1,ids:['a'],activeId:null}])
            await assert.rejects(store.saveWorkspace([{id:'a',document:document()}], manifest), /manifest/);
        assert.equal(globalThis.localStorage.data.size, 0);
    } finally { store.dispose(); globalThis.localStorage = old; }
});
test('synchronous IndexedDB put failure aborts an enqueued manifest transaction', async () => {
    const store = new ProjectStore(); let puts = 0, aborted = false;
    const tx = { objectStore: () => ({ put: () => { if (++puts === 2) throw new Error('DataError'); } }), abort: () => { aborted = true; } };
    store.ready = Promise.resolve({ transaction: () => tx, close() {} });
    await assert.rejects(store.saveWorkspace([{ id:'a', document:document() }], {version:1,ids:['a'],activeId:'a'}), /DataError/);
    assert.equal(aborted, true); assert.equal(puts, 2); store.dispose();
});
