/** Pointer capture + multi-pointer gesture arbitration, shared by touch, pen, and mouse. */
export class PointerController {
    constructor(element, handlers = {}) {
        this.element = element;
        this.handlers = handlers;
        this.pointers = new Map();
        this.abort = new AbortController();
        this.gesture = null;
        this.longTimer = null;
        const opt = { signal: this.abort.signal };
        element.style.touchAction = 'none';
        element.addEventListener('pointerdown', e => this.down(e), opt);
        element.addEventListener('pointermove', e => this.move(e), opt);
        element.addEventListener('pointerup', e => this.up(e), opt);
        element.addEventListener('pointercancel', e => this.up(e, true), opt);
        element.addEventListener('lostpointercapture', e => {
            if (this.pointers.has(e.pointerId))
                this.up(e, true);
        }, opt);
        element.addEventListener('wheel', e => { e.preventDefault(); this.handlers.wheel?.({ ...this.info(e), deltaX: e.deltaX, deltaY: e.deltaY, ctrl: e.ctrlKey }); }, { passive: false, ...opt });
        element.addEventListener('contextmenu', e => { e.preventDefault(); this.handlers.context?.(this.info(e)); }, opt);
    }
    info(e) { const r = this.element.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId, pointerType: e.pointerType || 'mouse', pressure: e.pressure || 0, shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey, button: e.button, buttons: e.buttons, original: e }; }
    pinchState() { const [a, b] = [...this.pointers.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) }; }
    down(e) {
        if (e.target.closest?.('button,input,select,textarea,[data-no-canvas]'))
            return;
        e.preventDefault();
        const p = this.info(e);
        try {
            this.element.setPointerCapture(e.pointerId);
        }
        catch { }
        this.pointers.set(e.pointerId, p);
        this.clearLong();
        if (this.pointers.size === 2) {
            this.handlers.cancel?.('pinch');
            this.gesture = this.pinchState();
            this.handlers.gestureStart?.(this.gesture);
            return;
        }
        if (this.pointers.size > 2)
            return;
        this.start = { ...p, time: performance.now() };
        this.handlers.down?.(p);
        if (p.pointerType === 'touch')
            this.longTimer = setTimeout(() => { this.handlers.longPress?.(p); this.longTimer = null; }, 550);
    }
    move(e) {
        const p = this.info(e);
        if (!this.pointers.has(e.pointerId)) {
            this.handlers.hover?.(p);
            return;
        }
        this.pointers.set(e.pointerId, p);
        if (this.gesture && this.pointers.size >= 2) {
            const next = this.pinchState();
            this.handlers.gesture?.({ previous: this.gesture, current: next, scale: next.distance / this.gesture.distance, dx: next.x - this.gesture.x, dy: next.y - this.gesture.y });
            this.gesture = next;
            return;
        }
        if (this.gesture)
            return;
        if (this.start && Math.hypot(p.x - this.start.x, p.y - this.start.y) > 7)
            this.clearLong();
        this.handlers.move?.(p);
    }
    up(e, cancelled = false) {
        if (!this.pointers.has(e.pointerId))
            return;
        const p = this.info(e);
        this.pointers.delete(e.pointerId);
        this.clearLong();
        if (this.gesture) {
            if (this.pointers.size === 0) {
                this.gesture = null;
                this.handlers.gestureEnd?.();
            }
            return;
        }
        if (cancelled)
            this.handlers.cancel?.('pointercancel');
        else
            this.handlers.up?.(p);
        try {
            if (this.element.hasPointerCapture(e.pointerId))
                this.element.releasePointerCapture(e.pointerId);
        }
        catch { }
    }
    clearLong() { clearTimeout(this.longTimer); this.longTimer = null; }
    reset() {
        this.clearLong();
        for (const id of this.pointers.keys()) {
            try { if (this.element.hasPointerCapture(id)) this.element.releasePointerCapture(id); } catch {}
        }
        this.pointers.clear(); this.gesture = null;
        this.handlers.cancel?.('document-switch');
    }
    dispose() { this.clearLong(); this.abort.abort(); this.pointers.clear(); }
}
