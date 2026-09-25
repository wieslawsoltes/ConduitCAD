import { createDocument, entityGeometry } from '@conduitcad/model';
import { bounds, validBounds, distanceToSegment, distance } from '@conduitcad/geometry';

/** Structural/geometry audit, deliberately separate from normative dimensional approval. */
export function inspectSymbol(master, tolerance = .15) {
    const errors = [], warnings = [], doc = createDocument(), paths = [], primitives = {};
    if (!(tolerance > 0) || !Number.isFinite(tolerance)) throw new RangeError('Invalid audit tolerance');
    if (!master.id || !master.block) errors.push('Missing symbol identity');
    const seen = new Set();
    for (const e of master.entities || []) {
        primitives[e.type] = (primitives[e.type] || 0) + 1;
        if (seen.has(e.id)) errors.push(`Duplicate child identity ${e.id}`);
        seen.add(e.id);
        if (e.type === 'LINE' && distance(e.a, e.b) < 1e-8) errors.push(`Zero-length line ${e.id}`);
        try {
            const g = entityGeometry(e, doc, { tolerance: .02 });
            paths.push(...g.paths);
            if (!g.paths.length && !g.texts.length) errors.push(`Empty primitive ${e.id}`);
        } catch (error) { errors.push(`${e.id}: ${error.message}`); }
    }
    const points = paths.flatMap(p => p.points), box = bounds(points);
    if (!validBounds(box) || !points.length) errors.push('No finite drawable extent');
    if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) errors.push('Non-finite geometry');
    const names = new Set(), terminalDistances = {};
    for (const port of master.ports || []) {
        if (!port.name || names.has(port.name)) errors.push('Missing or duplicate terminal name');
        names.add(port.name);
        if (![port.x, port.y, port.dx, port.dy].every(Number.isFinite)) errors.push(`Invalid terminal ${port.name}`);
        if (Math.abs(Math.hypot(port.dx, port.dy) - 1) > 1e-6) errors.push(`Terminal ${port.name} direction is not unit length`);
        let nearest = Infinity;
        for (const p of paths) {
            for (let i = 1; i < p.points.length; i++) nearest = Math.min(nearest, distanceToSegment(port, p.points[i - 1], p.points[i]));
            if (p.closed) nearest = Math.min(nearest, distanceToSegment(port, p.points.at(-1), p.points[0]));
        }
        terminalDistances[port.name] = nearest;
        if (nearest > tolerance) errors.push(`Detached terminal ${port.name}: ${nearest.toFixed(6)} units`);
        if (!port.medium) errors.push(`Unspecified terminal medium ${port.name}`);
    }
    if (!master.symbol?.standardRefs?.length) errors.push('Missing convention provenance');
    if (master.symbol?.normativeEntry == null) warnings.push('Normative dimensions / entry not independently verified');
    return { id: master.id, category: master.category, geometryRevision: master.symbol?.geometryRevision, primitives, bounds: box, terminals: terminalDistances, errors, warnings };
}
export function inspectCatalog(symbols) {
    const ids = new Set(), names = new Set();
    return symbols.map(s => {
        const result = inspectSymbol(s), key = s.block.toUpperCase();
        if (ids.has(s.id)) result.errors.push('Duplicate catalogue identity');
        if (names.has(key)) result.errors.push('Duplicate DXF block name');
        ids.add(s.id); names.add(key);
        return result;
    });
}
