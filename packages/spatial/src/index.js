import { intersects, union, emptyBounds, validBounds } from '@conduitcad/geometry';
/** Packed bounding-volume hierarchy with a bounded incremental-update overlay. */
export class SpatialIndex {
    constructor(items = [], leafSize = 12) { this.leafSize = leafSize; this.load(items); }
    load(items) { const clean = items.filter(i => validBounds(i)); this.size = clean.length; this.root = this.build(clean, 0); this.items = clean; this.positions = new Map(clean.map((item, i) => [item.id, i]).filter(([id]) => id !== undefined)); this.overrides = new Map(); return this; }
    build(items, depth) {
        if (!items.length)
            return null;
        let b = emptyBounds();
        for (const i of items)
            b = union(b, i);
        if (items.length <= this.leafSize)
            return { ...b, items };
        const x = (b.maxX - b.minX) >= (b.maxY - b.minY);
        items.sort((a, b) => x ? (a.minX + a.maxX - b.minX - b.maxX) : (a.minY + a.maxY - b.minY - b.maxY));
        const m = items.length >> 1;
        return { ...b, left: this.build(items.slice(0, m), depth + 1), right: this.build(items.slice(m), depth + 1) };
    }
    update(items) {
        for (const item of items) {
            const position = this.positions.get(item.id);
            if (position === undefined)
                throw new Error('Spatial update requires an existing ID');
            if (!validBounds(item))
                throw new Error('Invalid spatial update bounds');
            this.items[position] = item;
            this.overrides.set(item.id, item);
        }
        if (this.overrides.size > Math.min(2048, Math.max(128, this.size / 4)))
            this.load(this.items);
        return this;
    }
    search(box) {
        const found = [], stack = this.root ? [this.root] : [];
        while (stack.length) {
            const n = stack.pop();
            if (!intersects(n, box))
                continue;
            if (n.items) {
                for (const i of n.items)
                    if (!this.overrides.has(i.id) && intersects(i, box))
                        found.push(i);
            }
            else {
                stack.push(n.left, n.right);
            }
        }
        for (const item of this.overrides.values())
            if (intersects(item, box))
                found.push(item);
        return found;
    }
}
