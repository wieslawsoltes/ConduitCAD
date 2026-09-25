/** Local-only recovery store. No accounts, telemetry, network upload, or cloud persistence. */
export class ProjectStore {
    constructor({ database = 'conduit-cad', onStatus = () => { } } = {}) { this.database = database; this.onStatus = onStatus; this.timer = null; this.ready = this.open().catch(() => null); }
    async open() {
        if (!globalThis.indexedDB)
            return null;
        return new Promise(resolve => {
            const request = indexedDB.open(this.database, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('projects'))
                    db.createObjectStore('projects', { keyPath: 'id' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
            request.onblocked = () => resolve(null);
        });
    }
    async save(document, id = 'autosave') {
        const value = { id, name: document.name, updatedAt: new Date().toISOString(), document: JSON.parse(JSON.stringify(document)) };
        this.onStatus('saving');
        try {
            const db = await this.ready;
            if (db)
                await new Promise((resolve, reject) => { const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put(value); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted')); });
            else
                localStorage.setItem(this.database + ':' + id, JSON.stringify(value));
            this.onStatus('saved');
            return value;
        }
        catch (e) {
            this.onStatus('error', e);
            throw e;
        }
    }
    schedule(document, id = 'autosave') { clearTimeout(this.timer); this.timer = setTimeout(() => { this.save(document, id).catch(() => { }); }, 550); }
    async load(id = 'autosave') {
        try {
            const db = await this.ready;
            if (!db)
                return JSON.parse(localStorage.getItem(this.database + ':' + id) || 'null');
            return await new Promise((resolve, reject) => { const tx = db.transaction('projects', 'readonly'), r = tx.objectStore('projects').get(id); r.onsuccess = () => resolve(r.result || null); r.onerror = () => reject(r.error); });
        }
        catch {
            return null;
        }
    }
    async list() {
        const db = await this.ready;
        if (!db) {
            const saved = await this.load();
            return saved ? [saved] : [];
        }
        return new Promise((resolve, reject) => { const r = db.transaction('projects', 'readonly').objectStore('projects').getAll(); r.onsuccess = () => resolve(r.result.filter(record => record.kind !== 'workspace').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); r.onerror = () => reject(r.error); });
    }
    /** Atomically checkpoint open drawing records and their ordered workspace manifest. */
    async saveWorkspace(records, manifest, key = 'default') {
        const id = 'workspace:' + key;
        if (!Array.isArray(records) || records.some(record => !record.document || !Array.isArray(record.document.entities))) throw new TypeError('Invalid workspace document');
        const ids = records.map(record => record.id);
        if (ids.length > 128 || ids.some(value => typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) || new Set(ids).size !== ids.length
            || manifest?.version !== 1 || !Array.isArray(manifest.ids) || manifest.ids.length !== ids.length || new Set(manifest.ids).size !== ids.length
            || manifest.ids.some(value => !ids.includes(value)) || (ids.length ? !ids.includes(manifest.activeId) : manifest.activeId !== null)) {
            throw new TypeError('Invalid workspace manifest or session IDs');
        }
        const snapshot = JSON.parse(JSON.stringify({ records, manifest }));
        const updatedAt = new Date().toISOString();
        const db = await this.ready;
        if (!db) {
            // One localStorage value is atomic; never publish a manifest before its documents.
            const previous = JSON.parse(localStorage.getItem(this.database + ':' + id) || 'null');
            const all = new Map((previous?.records || []).map(record => [record.id, record]));
            for (const record of snapshot.records) all.set(record.id, { ...record, updatedAt });
            localStorage.setItem(this.database + ':' + id, JSON.stringify({ ...snapshot, records: [...all.values()], updatedAt }));
            return;
        }
        await new Promise((resolve, reject) => {
            const tx = db.transaction('projects', 'readwrite'), store = tx.objectStore('projects');
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error || new Error('Recovery write failed'));
            tx.onabort = () => reject(tx.error || new Error('Recovery transaction aborted'));
            try {
                store.put({ id, kind: 'workspace', updatedAt, manifest: snapshot.manifest });
                for (const record of snapshot.records) store.put({
                    ...record, id: id + ':' + record.id, sessionId: record.id,
                    kind: 'drawing-session', name: record.document.name, updatedAt
                });
            } catch (error) {
                // A synchronous DataError must not let an already-enqueued manifest commit.
                try { tx.abort(); } catch { /* Transaction may already have aborted. */ }
                reject(error);
            }
        });
    }
    async loadWorkspace(key = 'default') {
        const id = 'workspace:' + key, db = await this.ready;
        if (!db) {
            const saved = JSON.parse(localStorage.getItem(this.database + ':' + id) || 'null');
            if (!saved) return null;
            return { ...saved, records: saved.manifest.ids.map(sessionId => saved.records.find(record => record.id === sessionId)) };
        }
        return new Promise((resolve, reject) => {
            const tx = db.transaction('projects', 'readonly'), store = tx.objectStore('projects');
            let result = null;
            tx.onerror = () => reject(tx.error || new Error('Recovery read failed'));
            tx.onabort = () => reject(tx.error || new Error('Recovery read aborted'));
            tx.oncomplete = () => resolve(result);
            const request = store.get(id);
            request.onsuccess = () => {
                const manifest = request.result?.manifest;
                if (!manifest) return;
                if (manifest.version !== 1 || !Array.isArray(manifest.ids) || manifest.ids.length > 128) {
                    tx.abort(); return;
                }
                result = { manifest, records: new Array(manifest.ids.length) };
                manifest.ids.forEach((sessionId, index) => {
                    const record = store.get(id + ':' + sessionId);
                    record.onsuccess = () => { if (record.result) result.records[index] = { ...record.result, id: sessionId }; };
                });
            };
        });
    }
    async listWorkspace(key = 'default') {
        const prefix = 'workspace:' + key + ':', db = await this.ready;
        let records;
        if (!db) records = JSON.parse(localStorage.getItem(this.database + ':workspace:' + key) || 'null')?.records || [];
        else records = await new Promise((resolve, reject) => {
            const request = db.transaction('projects', 'readonly').objectStore('projects').getAll(IDBKeyRange.bound(prefix, prefix + '\uffff'));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return records.map(record => ({ id: record.sessionId || record.id, name: record.document?.name || record.name,
            entities: record.document?.entities?.length || 0, updatedAt: record.updatedAt, blockDraft: !!record.state?.block
        })).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    }
    async loadWorkspaceRecord(sessionId, key = 'default') {
        const db = await this.ready;
        if (db) {
            const record = await this.load('workspace:' + key + ':' + sessionId);
            return record ? { ...record, id: sessionId } : null;
        }
        return JSON.parse(localStorage.getItem(this.database + ':workspace:' + key) || 'null')?.records?.find(record => record.id === sessionId) || null;
    }
    dispose() { clearTimeout(this.timer); this.ready.then(db => db?.close()); }
}
export function downloadFile(filename, contents, type = 'application/octet-stream') { const blob = contents instanceof Blob ? contents : new Blob([contents], { type }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
