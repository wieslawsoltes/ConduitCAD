/** In-memory CAD sessions. Context belongs to the host; it is never serialized implicitly. */
export class DocumentWorkspace {
    constructor({ store, key = 'default', capture = session => ({ document: session.document }), beforeSave = () => {}, onChange = () => {}, maxDocuments = 32, debounce = 650 } = {}) {
        if (!Number.isInteger(maxDocuments) || maxDocuments < 1 || maxDocuments > 128) throw new RangeError('Invalid document limit');
        if (!Number.isFinite(debounce) || debounce < 0) throw new RangeError('Invalid recovery delay');
        this.store = store;
        this.key = key;
        this.capture = capture;
        this.beforeSave = beforeSave;
        this.onChange = onChange;
        this.maxDocuments = maxDocuments;
        this.debounce = debounce;
        this.sessions = [];
        this.activeId = null;
        this.sequence = 0;
        this.queue = Promise.resolve();
        this.timer = null;
        this.disposed = false;
        this.error = null;
    }
    get active() { return this.sessions.find(session => session.id === this.activeId) || null; }
    get dirty() { return this.sessions.some(session => session.revision !== session.savedRevision); }
    get(id) { return this.sessions.find(session => session.id === id) || null; }
    add(document, { id, context = {}, saved = false, activate = true } = {}) {
        if (this.disposed) throw new Error('Workspace is closed');
        if (this.sessions.length >= this.maxDocuments) throw new Error(`Close a drawing before opening more than ${this.maxDocuments} documents`);
        if (!document || typeof document !== 'object' || !Array.isArray(document.entities)) throw new TypeError('A CAD document is required');
        id ||= globalThis.crypto?.randomUUID?.() || `drawing-${Date.now().toString(36)}-${++this.sequence}`;
        if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id) || this.get(id)) throw new Error('Invalid or duplicate document session ID');
        const session = { id, document, context, revision: 0, savedRevision: saved ? 0 : -1, saving: false, savedAt: null, error: null };
        this.sessions.push(session);
        if (activate || !this.activeId) this.activeId = id;
        this.onChange({ type: 'open', session });
        return session;
    }
    activate(id) {
        const session = this.get(id);
        if (!session) throw new Error('Drawing is not open');
        this.activeId = id;
        this.onChange({ type: 'activate', session });
        return session;
    }
    markChanged(id = this.activeId) {
        const session = this.get(id);
        if (!session) return;
        session.revision++;
        session.error = null;
        this.onChange({ type: 'change', session });
    }
    remove(id, { discard = false } = {}) {
        const index = this.sessions.findIndex(session => session.id === id);
        if (index < 0) return false;
        const session = this.sessions[index];
        if (!discard && session.revision !== session.savedRevision) throw new Error('Save or explicitly discard unsaved changes first');
        this.sessions.splice(index, 1);
        if (this.activeId === id) this.activeId = this.sessions[Math.min(index, this.sessions.length - 1)]?.id || null;
        this.onChange({ type: 'close', session });
        return true;
    }
    move(id, index) {
        const from = this.sessions.findIndex(session => session.id === id);
        if (from < 0 || !Number.isInteger(index) || index < 0 || index >= this.sessions.length) throw new RangeError('Invalid tab position');
        const [session] = this.sessions.splice(from, 1);
        this.sessions.splice(index, 0, session);
        this.onChange({ type: 'reorder', session });
    }
    schedule() {
        if (this.disposed) return;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => { this.timer = null; this.saveAll().catch(() => {}); }, this.debounce);
    }
    /** Serialized snapshots + an atomic store transaction prevent late saves from overwriting newer edits. */
    saveAll() {
        if (this.disposed) return Promise.reject(new Error('Workspace is closed'));
        clearTimeout(this.timer);
        this.timer = null;
        const operation = this.queue.catch(() => {}).then(async () => {
            let captured = [];
            try {
                this.beforeSave();
                captured = this.sessions.map(session => ({ session, revision: session.revision, record: { ...this.capture(session), id: session.id } }));
                // Capture before the first await: callers can continue editing while storage is busy.
                const records = JSON.parse(JSON.stringify(captured.map(item => item.record)));
                const manifest = { version: 1, activeId: this.activeId, ids: captured.map(item => item.session.id) };
                for (const { session } of captured) session.saving = true;
                this.onChange({ type: 'saving' });
                if (!this.store?.saveWorkspace) throw new Error('Recovery storage is unavailable');
                await this.store.saveWorkspace(records, manifest, this.key);
                const savedAt = new Date().toISOString();
                this.error = null;
                for (const { session, revision } of captured) {
                    session.savedRevision = revision;
                    session.savedAt = savedAt;
                    session.error = null;
                }
                return manifest;
            } catch (error) {
                this.error = error;
                for (const session of this.sessions) session.error = error;
                throw error;
            } finally {
                for (const { session } of captured) session.saving = false;
                this.onChange({ type: this.error ? 'error' : 'saved', error: this.error });
            }
        });
        this.queue = operation;
        return operation;
    }
    flush() { return this.saveAll(); }
    dispose() { clearTimeout(this.timer); this.timer = null; this.disposed = true; }
}

/** Merge reachable DXF block definitions; names are case-insensitive and never overwritten. */
export function mergeClipboardBlocks(destination, source, entities) {
    const clone = value => JSON.parse(JSON.stringify(value));
    const indexNames = definitions => {
        const index = new Map();
        for (const name of Object.keys(definitions)) {
            const folded = name.toUpperCase();
            if (index.has(folded)) throw new Error('Ambiguous case-insensitive clipboard block names');
            index.set(folded, name);
        }
        return index;
    };
    const sourceIndex = indexNames(source), destinationIndex = indexNames(destination);
    const names = new Map(), visiting = new Set(), result = Object.create(null), allocated = new Set();
    const resolve = requested => {
        if (!requested) return requested;
        const name = sourceIndex.get(requested.toUpperCase());
        if (!name) return destinationIndex.get(requested.toUpperCase()) || requested;
        if (visiting.has(name)) throw new Error('Circular clipboard block reference');
        if (names.has(name)) return names.get(name);
        visiting.add(name);
        const block = clone(source[name]);
        for (const entity of block.entities || []) if (entity.block) entity.block = resolve(entity.block);
        const existing = destinationIndex.get(name.toUpperCase());
        let next = existing || name;
        const equivalent = candidate => JSON.stringify({ ...candidate, name: undefined }) === JSON.stringify({ ...block, name: undefined });
        if (existing && !equivalent(destination[existing])) {
            let index = 1;
            do { next = `${name}_copy${index++}`; }
            while (destinationIndex.has(next.toUpperCase()) || allocated.has(next.toUpperCase()) || sourceIndex.has(next.toUpperCase()));
        }
        names.set(name, next);
        visiting.delete(name);
        block.name = next;
        if (!destinationIndex.has(next.toUpperCase())) {
            result[next] = block;
            allocated.add(next.toUpperCase());
        }
        return next;
    };
    const copied = clone(entities);
    for (const entity of copied) if (entity.block) entity.block = resolve(entity.block);
    return { blocks: result, entities: copied, names };
}
