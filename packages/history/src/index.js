/** Atomic serializable transactions with bounded undo memory and redo invalidation. */
export class History {
    constructor({ capture, restore, onChange = () => { }, limit = 80, maxBytes = 32 * 1024 * 1024 }) { this.capture = capture; this.restore = restore; this.onChange = onChange; this.limit = limit; this.maxBytes = maxBytes; this.undoStack = []; this.redoStack = []; this.pending = null; }
    begin(label = 'Edit') {
        if (this.pending)
            return;
        this.pending = { label, before: JSON.stringify(this.capture()) };
    }
    commit() {
        if (!this.pending)
            return false;
        const item = this.pending;
        this.pending = null;
        const after = JSON.stringify(this.capture());
        if (after === item.before)
            return false;
        item.after = after;
        this.undoStack.push(item);
        this.redoStack = [];
        let bytes = this.undoStack.reduce((n, x) => n + x.before.length + x.after.length, 0);
        while (this.undoStack.length > 1 && (this.undoStack.length > this.limit || bytes > this.maxBytes)) {
            const old = this.undoStack.shift();
            bytes -= old.before.length + old.after.length;
        }
        this.onChange();
        return true;
    }
    cancel() {
        if (!this.pending)
            return;
        const p = this.pending;
        this.pending = null;
        this.restore(JSON.parse(p.before));
        this.onChange();
    }
    run(label, action) {
        this.begin(label);
        try {
            const result = action();
            this.commit();
            return result;
        }
        catch (error) {
            this.cancel();
            throw error;
        }
    }
    undo() {
        if (this.pending)
            this.cancel();
        const item = this.undoStack.pop();
        if (!item)
            return false;
        this.restore(JSON.parse(item.before));
        this.redoStack.push(item);
        this.onChange();
        return true;
    }
    redo() {
        if (this.pending)
            this.cancel();
        const item = this.redoStack.pop();
        if (!item)
            return false;
        this.restore(JSON.parse(item.after));
        this.undoStack.push(item);
        this.onChange();
        return true;
    }
    clear() { this.pending = null; this.undoStack = []; this.redoStack = []; this.onChange(); }
    get canUndo() { return this.undoStack.length > 0; }
    get canRedo() { return this.redoStack.length > 0; }
}
