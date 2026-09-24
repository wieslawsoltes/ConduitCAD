/** Local-only recovery store. No accounts, telemetry, network upload, or cloud persistence. */
export class ProjectStore {
    constructor({ database = 'conduit-cad', onStatus = () => { } } = {}) { this.database = database; this.onStatus = onStatus; this.timer = null; this.ready = this.open(); }
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
        return new Promise((resolve, reject) => { const r = db.transaction('projects', 'readonly').objectStore('projects').getAll(); r.onsuccess = () => resolve(r.result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); r.onerror = () => reject(r.error); });
    }
    dispose() { clearTimeout(this.timer); this.ready.then(db => db?.close()); }
}
export function downloadFile(filename, contents, type = 'application/octet-stream') { const blob = contents instanceof Blob ? contents : new Blob([contents], { type }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
