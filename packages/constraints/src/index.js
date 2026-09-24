import { distance, dot, cross, sub, length } from '@conduitcad/geometry';
/** Safe expression parser. No eval, property access, functions or executable code. */
export function evaluateExpression(source, parameters = {}, stack = []) {
    if (typeof source === 'number') {
        if (!Number.isFinite(source))
            throw new Error('Parameter must be finite');
        return source;
    }
    const s = String(source), tokens = [];
    let pos = 0;
    while (pos < s.length) {
        if (/\s/.test(s[pos])) {
            pos++;
            continue;
        }
        const m = s.slice(pos).match(/^(?:(\d*\.?\d+(?:e[+-]?\d+)?)|([A-Za-z_]\w*)|([()+\-*/^]))/i);
        if (!m)
            throw new Error(`Invalid expression near “${s.slice(pos, pos + 12)}”`);
        tokens.push(m[0]);
        pos += m[0].length;
    }
    let i = 0;
    function primary() {
        const t = tokens[i++];
        if (t === undefined)
            throw new Error('Incomplete expression');
        if (t === '(') {
            const v = sum();
            if (tokens[i++] !== ')')
                throw new Error('Unclosed parenthesis');
            return v;
        }
        if (/^\d|^\./.test(t))
            return Number(t);
        if (/^[A-Za-z_]/.test(t)) {
            if (t === 'pi')
                return Math.PI;
            if (!Object.hasOwn(parameters, t))
                throw new Error(`Unknown parameter: ${t}`);
            if (stack.includes(t))
                throw new Error(`Parameter cycle: ${[...stack, t].join(' → ')}`);
            return evaluateExpression(parameters[t], parameters, [...stack, t]);
        }
        throw new Error(`Unexpected token: ${t}`);
    }
    function power() {
        let v = primary();
        if (tokens[i] === '^') {
            i++;
            v = v ** unary();
        }
        return v;
    }
    function unary() {
        if (tokens[i] === '+' || tokens[i] === '-') {
            const sign = tokens[i++];
            return (sign === '-' ? -1 : 1) * unary();
        }
        return power();
    }
    function product() {
        let v = unary();
        while (tokens[i] === '*' || tokens[i] === '/') {
            const o = tokens[i++], b = unary();
            v = o === '*' ? v * b : v / b;
        }
        return v;
    }
    function sum() {
        let v = product();
        while (tokens[i] === '+' || tokens[i] === '-') {
            const o = tokens[i++], b = product();
            v = o === '+' ? v + b : v - b;
        }
        return v;
    }
    const value = sum();
    if (i !== tokens.length || !Number.isFinite(value))
        throw new Error('Expression did not produce a finite number');
    return value;
}
export function resolveParameters(parameters) {
    const result = {};
    for (const k of Object.keys(parameters))
        result[k] = evaluateExpression(parameters[k], parameters, [k]);
    return result;
}
/** Dense damped least-squares planar sketch solver for small selected sketches. */
export class ConstraintSolver {
    constructor({ tolerance = 1e-6, maxIterations = 60 } = {}) { this.tolerance = tolerance; this.maxIterations = maxIterations; }
    solve(entities, constraints, parameters = {}) {
        const relevant = new Set(constraints.flatMap(c => c.entities || [c.entityId]).filter(Boolean)), map = new Map(entities.map(e => [e.id, e]));
        for (const c of constraints) {
            const ids = c.entities || [c.entityId];
            if (!ids.length || ids.some(id => !map.has(id)))
                throw new Error('Constraint references a missing entity');
            const [a, b] = ids.map(id => map.get(id));
            const line = e => !!(e?.a && e?.b);
            if (['horizontal', 'vertical', 'length', 'angle', 'parallel', 'perpendicular'].includes(c.type) && !line(a))
                throw new Error('Constraint requires a line');
            if (['parallel', 'perpendicular'].includes(c.type) && !line(b))
                throw new Error('Constraint requires two lines');
            if (c.type === 'radius' && a.r === undefined)
                throw new Error('Radius constraint requires a circle or arc');
            if (c.type === 'equal' && !((line(a) && line(b)) || (a.r !== undefined && b?.r !== undefined)))
                throw new Error('Equal constraint requires matching geometry');
            if (c.type === 'coincident' && (!a[c.pointA || 'b'] || !b?.[c.pointB || 'a']))
                throw new Error('Coincidence requires valid point references');
            if (['radius', 'length'].includes(c.type) && evaluateExpression(c.value, parameters) <= 0)
                throw new Error('Constraint size must be positive');
        }
        const variables = [];
        for (const id of relevant) {
            const e = map.get(id);
            if (!e)
                continue;
            for (const key of ['a', 'b', 'c', 'p'])
                if (e[key])
                    for (const axis of ['x', 'y'])
                        variables.push({ get: () => e[key][axis], set: v => e[key][axis] = v });
            if (e.type === 'CIRCLE' || e.type === 'ARC')
                variables.push({ get: () => e.r, set: v => e.r = Math.max(1e-8, v) });
        }
        if (variables.length > 180)
            throw new Error('Select a smaller sketch (180 scalar variables per solve)');
        const initial = variables.map(v => v.get());
        const residual = () => {
            const r = [];
            for (const c of constraints) {
                const es = (c.entities || [c.entityId]).map(id => map.get(id)), a = es[0], b = es[1];
                if (!a)
                    continue;
                const value = c.value === undefined ? 0 : evaluateExpression(c.value, parameters), v = a.a && a.b ? sub(a.b, a.a) : null, w = b?.a && b?.b ? sub(b.b, b.a) : null;
                switch (c.type) {
                    case 'horizontal':
                        if (v)
                            r.push(v.y);
                        break;
                    case 'vertical':
                        if (v)
                            r.push(v.x);
                        break;
                    case 'length':
                        if (v)
                            r.push(length(v) - value);
                        break;
                    case 'radius':
                        if (a.r !== undefined)
                            r.push(a.r - value);
                        break;
                    case 'coincident': {
                        const p = a[c.pointA || 'b'], q = b?.[c.pointB || 'a'];
                        if (p && q)
                            r.push(p.x - q.x, p.y - q.y);
                        break;
                    }
                    case 'parallel':
                        if (v && w)
                            r.push(cross(v, w) / Math.max(1, length(v), length(w)));
                        break;
                    case 'perpendicular':
                        if (v && w)
                            r.push(dot(v, w) / Math.max(1, length(v), length(w)));
                        break;
                    case 'equal':
                        if (v && w)
                            r.push(length(v) - length(w));
                        else if (a.r !== undefined && b?.r !== undefined)
                            r.push(a.r - b.r);
                        break;
                    case 'angle':
                        if (v) {
                            const current = Math.atan2(v.y, v.x), desired = value * Math.PI / 180;
                            let delta = current - desired;
                            delta = Math.atan2(Math.sin(delta), Math.cos(delta));
                            r.push(delta * Math.max(1, length(v)));
                        }
                        break;
                    case 'fixed': {
                        const target = c.target || {};
                        for (const k of ['a', 'b', 'c', 'p'])
                            if (a[k] && target[k])
                                r.push(a[k].x - target[k].x, a[k].y - target[k].y);
                        if (a.r !== undefined && target.r !== undefined)
                            r.push(a.r - target.r);
                        break;
                    }
                    default: throw new Error(`Unknown constraint: ${c.type}`);
                }
            }
            return r;
        };
        let lambda = 1e-4, iterations = 0, error = Infinity, r = residual();
        const norm = v => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
        for (; iterations < this.maxIterations; iterations++) {
            error = norm(r);
            if (error < this.tolerance)
                break;
            const n = variables.length, m = r.length;
            if (!n || !m)
                break;
            const jac = Array.from({ length: m }, () => new Float64Array(n));
            for (let j = 0; j < n; j++) {
                const v = variables[j].get(), step = 1e-6 * Math.max(1, Math.abs(v));
                variables[j].set(v + step);
                const rr = residual();
                variables[j].set(v);
                for (let i = 0; i < m; i++)
                    jac[i][j] = (rr[i] - r[i]) / step;
            }
            const a = Array.from({ length: n }, () => new Float64Array(n + 1));
            for (let j = 0; j < n; j++) {
                for (let k = 0; k < n; k++) {
                    let sum = 0;
                    for (let i = 0; i < m; i++)
                        sum += jac[i][j] * jac[i][k];
                    a[j][k] = sum + (j === k ? lambda : 0);
                }
                for (let i = 0; i < m; i++)
                    a[j][n] -= jac[i][j] * r[i];
            }
            for (let j = 0; j < n; j++) {
                let pivot = j;
                for (let i = j + 1; i < n; i++)
                    if (Math.abs(a[i][j]) > Math.abs(a[pivot][j]))
                        pivot = i;
                [a[j], a[pivot]] = [a[pivot], a[j]];
                if (Math.abs(a[j][j]) < 1e-15)
                    continue;
                for (let i = j + 1; i < n; i++) {
                    const f = a[i][j] / a[j][j];
                    for (let k = j; k <= n; k++)
                        a[i][k] -= f * a[j][k];
                }
            }
            const delta = new Float64Array(n);
            for (let j = n - 1; j >= 0; j--) {
                let sum = a[j][n];
                for (let k = j + 1; k < n; k++)
                    sum -= a[j][k] * delta[k];
                delta[j] = Math.abs(a[j][j]) > 1e-15 ? sum / a[j][j] : 0;
            }
            const before = variables.map(v => v.get());
            for (let j = 0; j < n; j++)
                variables[j].set(before[j] + delta[j]);
            const next = residual();
            if (norm(next) < error) {
                r = next;
                lambda = Math.max(1e-10, lambda * .3);
            }
            else {
                for (let j = 0; j < n; j++)
                    variables[j].set(before[j]);
                lambda = Math.min(1e10, lambda * 10);
            }
        }
        error = norm(residual());
        const converged = error < this.tolerance * 10;
        if (!converged)
            variables.forEach((v, i) => v.set(initial[i]));
        return { converged, iterations, residual: error, variables: variables.length, equations: r.length, status: converged ? 'solved' : 'conflicting-or-unconverged', rolledBack: !converged };
    }
}
