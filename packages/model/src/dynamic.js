import { regenerateDimensions } from './dimensions.js';
import { ConstraintSolver, evaluateExpression, parameterDependencies, resolveParameters, evaluateCalculations } from '@conduitcad/constraints';
import { matrix, compose, transform } from '@conduitcad/geometry';

const clone=v=>JSON.parse(JSON.stringify(v));
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const forbidden=new Set(['__proto__','prototype','constructor']);
const finite=(x,name)=>{if(typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>1e12)throw new Error(`Invalid dynamic ${name}`);return x;};
const inside=(p,b)=>p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY;
const pivot=(m,p={x:0,y:0})=>compose(matrix({x:p.x,y:p.y}),compose(m,matrix({x:-p.x,y:-p.y})));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

export function validateDynamicDefinition(block) {
    const d=block.dynamic;
    if(!d||![1,2].includes(d.version)||!Array.isArray(d.parameters)||!Array.isArray(d.actions))throw new Error('Expected Conduit dynamic-block schema version 1 or 2');
    if(d.parameters.length>64||d.actions.length>256||!Array.isArray(block.entities)||block.entities.length>10000)throw new Error('Dynamic block complexity limit exceeded');
    const names=new Set(),ids=new Set();
    for(const p of d.parameters){if(!/^[A-Za-z][\w-]{0,63}$/.test(p.name)||forbidden.has(p.name)||names.has(p.name))throw new Error('Invalid or duplicate parameter name');names.add(p.name);valueOf(p,p.default);
        if(p.grip){for(const key of ['base','direction'])if(p.grip[key]){finite(p.grip[key].x,'grip '+key);finite(p.grip[key].y,'grip '+key);}
            if(p.grip.direction&&Math.hypot(p.grip.direction.x,p.grip.direction.y)<1e-9)throw new Error('Grip direction must be nonzero');
            if(p.grip.radius!==undefined&&finite(p.grip.radius,'grip radius')<=0)throw new Error('Grip radius must be positive');}
    }
    for(const e of block.entities){if(!e.id||ids.has(e.id))throw new Error('Dynamic geometry needs unique entity IDs');ids.add(e.id);}
    const portNames=new Set();for(const port of block.ports||[]){if(!port.name||portNames.has(port.name))throw new Error('Dynamic ports need unique names');portNames.add(port.name);for(const k of ['x','y','dx','dy'])finite(port[k],'port '+k);}
    const types=new Set(['move','stretch','rotate','scale','flip','visibility','array','lookup','polar','polar-array']);
    for(const a of d.actions){
        if(!types.has(a.type)||!names.has(a.parameter))throw new Error('Unknown dynamic action or parameter');
        if(a.entities && (!Array.isArray(a.entities)||a.entities.some(id=>!ids.has(id))))throw new Error('Dynamic action references missing geometry');
        if(a.ports && (!Array.isArray(a.ports)||a.ports.some(n=>!(block.ports||[]).some(p=>p.name===n))))throw new Error('Dynamic action references missing port');
        for(const k of ['base','direction','step'])if(a[k]){finite(a[k].x,k);finite(a[k].y,k);}
        const parameter= d.parameters.find(p=>p.name===a.parameter);
        if(['move','stretch','rotate','scale','array','polar','polar-array'].includes(a.type)&&!['number','distance','angle','integer'].includes(parameter.type))throw new Error('Geometric action requires a numeric parameter');
        if(a.angleParameter&&!names.has(a.angleParameter))throw new Error('Missing polar angle parameter');
        if(a.type==='flip'&&parameter.type!=='boolean')throw new Error('Flip requires a boolean parameter');
        if(a.type==='stretch') {
            if(!a.box)throw new Error('Stretch requires a crossing box');
            for(const k of ['minX','minY','maxX','maxY'])finite(a.box[k],k);
            if(a.box.minX>a.box.maxX||a.box.minY>a.box.maxY)throw new Error('Invalid stretch box');
        }
        if(a.type==='visibility'&&(!a.states||typeof a.states!=='object'||Object.values(a.states).some(v=>!Array.isArray(v)||v.some(id=>!ids.has(id)))))throw new Error('Invalid visibility state');
    }
    return block;
}
function valueOf(p,v) {
    if(p.type==='boolean'){if(typeof v!=='boolean')throw new Error(`Parameter ${p.name} requires a boolean`);}
    else if(p.type==='enum'){if(!Array.isArray(p.values)||!p.values.some(x=>equal(x,v)))throw new Error(`Unknown ${p.name} option`);if(typeof v!=='string'&&typeof v!=='number')throw new Error('Enum values must be scalar');if(typeof v==='number')finite(v,p.name);}
    else {
        if(!['number','distance','angle','integer'].includes(p.type))throw new Error(`Unknown parameter type: ${p.type}`);
        finite(v,p.name);if(p.type==='integer'&&!Number.isInteger(v))throw new Error(`${p.name} must be an integer`);
        if(p.min!==undefined&&(finite(p.min,'minimum'),v<p.min)||p.max!==undefined&&(finite(p.max,'maximum'),v>p.max))throw new Error(`${p.name} is outside its allowed range`);
        if(p.values && !p.values.includes(v))throw new Error(`${p.name} must be a listed value`);
    }
    return v;
}
export function resolveDynamicValues(block,input={}) {
    validateDynamicDefinition(block);
    if(!input||Array.isArray(input)||typeof input!=='object')throw new Error('Invalid dynamic parameter values');
    const definitions=new Map(block.dynamic.parameters.map(p=>[p.name,p])), values=Object.create(null), writers=new Map();
    const constants=resolveParameters(block.parameters||{});
    for(const key of Object.keys(input))if(!definitions.has(key))throw new Error(`Unknown dynamic parameter: ${key}`);
    for(const p of definitions.values())values[p.name]=valueOf(p,own(input,p.name)?input[p.name]:p.default);
    const lookups=block.dynamic.actions.filter(a=>a.type==='lookup');
    for(const a of lookups){
        if(!a.rows||typeof a.rows!=='object')throw new Error('Lookup action requires rows');
        for(const row of Object.values(a.rows))for(const key of Object.keys(row)){
            if(!definitions.has(key)||key===a.parameter||writers.has(key)&&writers.get(key)!==a||definitions.get(key).expression!==undefined)throw new Error('Invalid or ambiguous lookup dependency');
            writers.set(key,a);valueOf(definitions.get(key),row[key]);
        }
    }
    const visited=new Set(),active=new Set();
    function resolve(name){
        if(!definitions.has(name)){if(own(constants,name))return constants[name];throw new Error('Unknown dynamic expression parameter: '+name);}
        if(visited.has(name))return values[name];if(active.has(name))throw new Error('Dynamic parameter / lookup cycle: '+[...active,name].join(' → '));active.add(name);
        const p=definitions.get(name),writer=writers.get(name);
        if(p.expression!==undefined){
            if(!['number','distance','angle','integer'].includes(p.type))throw new Error('Expressions require numeric parameters');
            const dependencies=Object.fromEntries(parameterDependencies(p.expression).map(key=>[key,resolve(key)]));
            values[name]=valueOf(p,evaluateExpression(p.expression,dependencies));
        }else if(writer){
            const key=String(resolve(writer.parameter));if(!own(writer.rows,key)||!own(writer.rows[key],name))throw new Error('No lookup row for selected value');
            values[name]=valueOf(p,writer.rows[key][name]);
        }
        active.delete(name);visited.add(name);return values[name];
    }
    for(const p of definitions.values())resolve(p.name);
    return values;
}
/** Pure bounded evaluation. Geometric transforms are supplied by the host model. */
export function evaluateDynamicDefinition(block,input,transformEntity,{maxEntities=10000}={}) {
    if(!Number.isSafeInteger(maxEntities)||maxEntities<1||maxEntities>100000||block.entities.length>maxEntities)throw new Error('Invalid dynamic entity budget');
    const values=resolveDynamicValues(block,input),definitions=new Map(block.dynamic.parameters.map(p=>[p.name,p]));
    const result={...block,entities:clone(block.entities),ports:clone(block.ports||[])};
    delete result.dynamic;
    for(const a of block.dynamic.actions) {
        if(a.type==='lookup')continue;
        const p=definitions.get(a.parameter),value=values[a.parameter],delta=typeof value==='number'?value-p.default:0;
        const selected=e=>!a.entities||a.entities.includes(e.id),portSelected=p=>!a.ports||a.ports.includes(p.name);
        if(a.type==='visibility'){
            const key=String(value);if(!own(a.states,key))throw new Error('No visibility state for selected value');
            const scope=new Set(a.entities||Object.values(a.states).flat());
            for(const e of result.entities)if(scope.has(e.id))e.hidden=!!e.hidden||!a.states[key].includes(e.id);
            continue;
        }
        if(a.type==='stretch') {
            const direction=a.direction||{x:1,y:0},m=matrix({x:direction.x*delta,y:direction.y*delta});
            for(const e of result.entities.filter(selected)){
                if(e.extrusion && (e.extrusion.x||e.extrusion.y||e.extrusion.z!==1))throw new Error('Stretch requires default OCS');
                const points=e.type==='LINE'?[e.a,e.b]:['LWPOLYLINE','POLYLINE'].includes(e.type)?e.points:e.type==='SPLINE'?e.controlPoints:null;
                if(points){
                    const chosen=points.filter(p=>inside(p,a.box));
                    if(chosen.length===0)continue;
                    if(chosen.length===points.length)transformEntity(e,m);
                    else {
                        if(points.some(p=>p.bulge)||e.type==='POLYLINE'&&(e.flags&(16|64)))throw new Error('Partial stretch would invalidate curved or mesh topology');
                        for(const p of chosen)Object.assign(p,transform(p,m));
                    }
                } else if(['CIRCLE','ARC','TEXT','MTEXT','POINT'].includes(e.type)){
                    if(inside(e.c||e.p,a.box))transformEntity(e,m);
                } else throw new Error(`Stretch is not supported for ${e.type}`);
            }
            for(const p of result.ports)if(portSelected(p)&&inside(p,a.box))Object.assign(p,transform(p,m));
            continue;
        }
        if(a.type==='polar-array'){
            if(!Number.isInteger(value)||value<1||value>256)throw new Error('Polar array count must be 1–256');
            const originals=result.entities.filter(selected),sweep=a.angleParameter?values[a.angleParameter]:(a.angle??360);
            finite(sweep,'array sweep');if(result.entities.length+originals.length*(value-1)>maxEntities)throw new Error('Dynamic array entity budget exceeded');
            for(let i=1;i<value;i++)for(const e of originals){const copy=clone(e);copy.id=`${e.id}:polar:${i}`;transformEntity(copy,pivot(matrix({rotation:sweep*i/value}),a.base));result.entities.push(copy);}
            continue;
        }
        if(a.type==='array'){
            if(!Number.isInteger(value)||value<1||value>256)throw new Error('Array count must be 1–256');
            const originals=result.entities.filter(selected);if(result.entities.length+originals.length*(value-1)>maxEntities)throw new Error('Dynamic array entity budget exceeded');
            const step=a.step||{x:10,y:0};
            for(let i=1;i<value;i++)for(const e of originals){const c=clone(e);c.id=`${e.id}:array:${i}`;transformEntity(c,matrix({x:step.x*i,y:step.y*i}));result.entities.push(c);}
            continue; // Named terminals describe the original cell; no implicit port duplication.
        }
        let m;
        if(a.type==='polar'){
            const angle=a.angleParameter?values[a.angleParameter]:(a.angle??0);finite(angle,'polar angle');
            const initialAngle=a.angleParameter?definitions.get(a.angleParameter).default:(a.angle??0),r=angle*Math.PI/180,q=initialAngle*Math.PI/180;
            m=matrix({x:value*Math.cos(r)-p.default*Math.cos(q),y:value*Math.sin(r)-p.default*Math.sin(q)});
        }
        if(a.type==='move'){const d=a.direction||{x:1,y:0};m=matrix({x:d.x*delta,y:d.y*delta});}
        if(a.type==='rotate')m=pivot(matrix({rotation:delta}),a.base);
        if(a.type==='scale'){const ratio=value/p.default;if(!(ratio>0)||!Number.isFinite(ratio))throw new Error('Dynamic scale requires positive nonzero reference and value');m=pivot(matrix({sx:ratio,sy:ratio}),a.base);}
        if(a.type==='flip'){
            if(typeof value!=='boolean')throw new Error('Flip needs a boolean parameter');if(value===p.default)continue;
            const d=a.direction||{x:0,y:1},len=Math.hypot(d.x,d.y);if(len<1e-9)throw new Error('Flip axis must be nonzero');
            const x=d.x/len,y=d.y/len;m=pivot([2*x*x-1,2*x*y,2*x*y,2*y*y-1,0,0],a.base);
        }
        if(!m||!m.every(Number.isFinite))throw new Error('Invalid dynamic transform');
        for(const e of result.entities.filter(selected)){
            if(a.type==='flip'&&['INSERT','TEXT','MTEXT','ELLIPSE','HATCH'].includes(e.type))throw new Error(`Mirrored ${e.type} needs a specialized transform`);
            transformEntity(e,m);
        }
        for(const p of result.ports.filter(portSelected)){
            const q=transform(p,m),v=transform({x:p.x+(p.dx||0),y:p.y+(p.dy||0)},m);Object.assign(p,q,{dx:v.x-q.x,dy:v.y-q.y});
        }
    }
    // Constraint-based blocks solve a pristine post-action sketch for each parameter set.
    const constraints=block.dynamic.constraints||block.constraints||[];
    if(constraints.length){
        const parameters={...block.parameters,...Object.fromEntries(Object.entries(values).filter(([,v])=>typeof v==='number'))};
        const report=new ConstraintSolver().solve(result.entities,constraints,parameters);
        if(!report.converged)throw new Error('Dynamic block constraints conflict: '+report.conflicts.join(', '));
        result.solveReport=report;
    }
    regenerateDimensions({entities:result.entities,dimstyles:block.dimstyles||{}});
    evaluateCalculations(result.entities,constraints,{...block.parameters,...Object.fromEntries(Object.entries(values).filter(([,v])=>typeof v==='number'))});
    for(const port of result.ports)if(port.anchor){
        const e=result.entities.find(e=>e.id===port.anchor.entityId),key=port.anchor.point;
        const p=/^points\.\d+$/.test(key)?e?.points?.[Number(key.slice(7))]:['a','b','c','p'].includes(key)?e?.[key]:null;
        if(!p)throw new Error('Invalid solved port anchor');port.x=p.x;port.y=p.y;
        if(port.anchor.followDirection&&e.type==='LINE'){const n=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),sign=port.anchor.reverse?-1:1;port.dx=sign*(e.b.x-e.a.x)/n;port.dy=sign*(e.b.y-e.a.y)/n;}
    }
    // Guard every coordinate, not only parameters. Prevent invalid buffers downstream.
    const check=v=>{if(typeof v==='number')finite(v,'geometry');else if(v&&typeof v==='object')for(const x of Object.values(v))check(x);};
    for(const e of result.entities)check(e);for(const p of result.ports)check(p);result.dynamicValues=values;return result;
}
