/** Bounded arithmetic parser. No eval, property access, or executable user code. */
const functions = Object.freeze({
    abs: [1, Math.abs], sqrt: [1, Math.sqrt], sin: [1, Math.sin], cos: [1, Math.cos],
    tan: [1, Math.tan], asin: [1, Math.asin], acos: [1, Math.acos], atan: [1, Math.atan],
    atan2: [2, Math.atan2], hypot: [2, Math.hypot], min: [2, Math.min], max: [2, Math.max],
    floor: [1, Math.floor], ceil: [1, Math.ceil], round: [1, Math.round], exp: [1, Math.exp],
    ln: [1, Math.log], log10: [1, Math.log10], pow: [2, Math.pow],
    rad: [1, x => x * Math.PI / 180], deg: [1, x => x * 180 / Math.PI],
    clamp: [3, (x, lo, hi) => { if (lo > hi) throw new Error('Invalid clamp range'); return Math.min(hi, Math.max(lo, x)); }]
});
const constants = Object.freeze({ pi: Math.PI, tau: Math.PI * 2, e: Math.E });
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const finite = n => { if (!Number.isFinite(n)) throw new Error('Expression did not produce a finite number'); return n; };
export function expressionNames() { return [...Object.keys(constants), ...Object.keys(functions), ...forbidden]; }
export function expressionDependencies(source) {
    const tokens = String(source).match(/[A-Za-z_]\w*|(?:\d*\.?\d+(?:e[+-]?\d+)?)/gi) || [];
    return [...new Set(tokens.filter(t => /^[A-Za-z_]/.test(t) && !Object.hasOwn(constants, t) && !Object.hasOwn(functions, t)))];
}
export function parseExpression(source, parameters = {}, stack = [], budget = {remaining: 20000, cache: new Map()}) {
    if (--budget.remaining < 0) throw new Error('Expression evaluation budget exceeded');
    if (typeof source === 'number') return finite(source);
    if (stack.length > 64) throw new Error('Parameter dependency depth exceeds 64');
    if (source && typeof source === 'object') source = source.expression ?? source.value;
    const s = String(source), tokens = []; let offset = 0;
    if (s.length > 4096) throw new Error('Expression exceeds 4096 characters');
    while (offset < s.length) {
        if (/\s/.test(s[offset])) { offset++; continue; }
        const m = s.slice(offset).match(/^(?:\d*\.?\d+(?:e[+-]?\d+)?|[A-Za-z_]\w*|[(),+\-*/^])/i);
        if (!m) throw new Error(`Invalid expression near “${s.slice(offset, offset + 12)}”`);
        tokens.push(m[0]); offset += m[0].length;
        if (tokens.length > 1024) throw new Error('Expression token budget exceeded');
    }
    let i = 0, depth = 0;
    function primary() {
        if (++depth > 64) throw new Error('Expression nesting exceeds 64');
        try {
            const t = tokens[i++];
            if (t === undefined) throw new Error('Incomplete expression');
            if (t === '(') { const v = sum(); if (tokens[i++] !== ')') throw new Error('Unclosed parenthesis'); return v; }
            if (/^\d|^\./.test(t)) return finite(Number(t));
            if (/^[A-Za-z_]/.test(t)) {
                if (forbidden.has(t)) throw new Error('Reserved parameter name');
                if (tokens[i] === '(') {
                    if (!Object.hasOwn(functions, t)) throw new Error(`Unknown function: ${t}`);
                    i++; const args = [];
                    if (tokens[i] !== ')') { args.push(sum()); while (tokens[i] === ',') { i++; args.push(sum()); if (args.length > 3) throw new Error('Too many function arguments'); } }
                    if (tokens[i++] !== ')') throw new Error('Unclosed function');
                    const [arity, fn] = functions[t]; if (args.length !== arity) throw new Error(`${t} requires ${arity} arguments`);
                    return finite(fn(...args));
                }
                if (Object.hasOwn(constants, t)) return constants[t];
                if (!Object.hasOwn(parameters, t)) throw new Error(`Unknown parameter: ${t}`);
                if (stack.includes(t)) throw new Error(`Parameter cycle: ${[...stack, t].join(' → ')}`);
                if(budget.cache.has(t))return budget.cache.get(t);
                const value=parseExpression(parameters[t], parameters, [...stack, t], budget);budget.cache.set(t,value);return value;
            }
            throw new Error(`Unexpected token: ${t}`);
        } finally { depth--; }
    }
    function power() { const a = primary(); if (tokens[i] !== '^') return a; i++; return finite(a ** unary()); }
    function unary() {
        let sign = 1, count = 0;
        while (tokens[i] === '+' || tokens[i] === '-') { if (tokens[i++] === '-') sign = -sign; if (++count > 64) throw new Error('Unary nesting exceeds 64'); }
        return sign * power();
    }
    function product() { let v = unary(); while (tokens[i] === '*' || tokens[i] === '/') { const op = tokens[i++], b = unary(); v = finite(op === '*' ? v * b : v / b); } return v; }
    function sum() { let v = product(); while (tokens[i] === '+' || tokens[i] === '-') { const op = tokens[i++], b = product(); v = finite(op === '+' ? v + b : v - b); } return v; }
    const result = sum(); if (i !== tokens.length) throw new Error('Unexpected expression token: ' + tokens[i]); return finite(result);
}
/** Values and dependency lists suitable for a parameter/calculation inspector. */
export function parameterReport(parameters) {
    if (Object.keys(parameters).length > 1024) throw new Error('Parameter count exceeds 1024');
    return Object.entries(parameters).map(([name, expression]) => ({ name, expression, value: parseExpression(expression, parameters, [name]), dependencies: expressionDependencies(expression?.expression ?? expression) }));
}
