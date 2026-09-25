import { parseExpression, parameterReport, expressionDependencies, expressionNames } from './expressions.js';
import { SketchSolver, measureConstraint, sketchAnnotations } from './solver.js';
export function evaluateExpression(source, parameters = {}, stack = []) { return parseExpression(source, parameters, stack); }
export function resolveParameters(parameters) { return Object.fromEntries(parameterReport(parameters).map(p => [p.name, p.value])); }
export function describeParameters(parameters) { return parameterReport(parameters); }
export function parameterDependencies(source) { return expressionDependencies(source); }
export function reservedParameterNames() { return expressionNames(); }
export function constraintMeasurement(entities, constraint) { return measureConstraint(entities, constraint); }
export function constraintAnnotations(entities, constraints, parameters = {}) { return sketchAnnotations(entities, constraints, parameters); }
/** Analytic-Jacobian, component-partitioned, damped QR planar constraint solver. */
export class ConstraintSolver extends SketchSolver {}
/** Suggest horizontal/vertical and endpoint coincidences. Application is an explicit transaction. */
export function inferSketchConstraints(entities, existing = [], {linearTolerance = 1e-5, angularTolerance = 1e-5} = {}) {
    if(!Number.isFinite(linearTolerance)||linearTolerance<=0||!Number.isFinite(angularTolerance)||angularTolerance<=0||entities.length>1000)throw new Error('Invalid automatic constraint budget or tolerance');
    const result=[],known=new Set(existing.map(c=>JSON.stringify([c.type,c.entities||[c.entityId],c.pointA,c.pointB,c.segmentA]))),points=[],buckets=new Map(),connected=new Map(),ids=new Set(existing.map(c=>c.id));
    let sequence=0;
    const root=id=>{if(!connected.has(id))connected.set(id,id);const r=connected.get(id);if(r!==id)connected.set(id,root(r));return connected.get(id);};
    const append=c=>{const key=JSON.stringify([c.type,c.entities,c.pointA,c.pointB,c.segmentA]);if(!known.has(key)){known.add(key);let id;do{id=`auto-${sequence++}-${c.entities[0]}-${c.type}`;}while(ids.has(id));ids.add(id);if(result.length>=4096)throw new Error('Automatic constraint count exceeds 4096');result.push({id,...c});}};
    for(const e of entities){
        if(e.locked||e.a?.z||e.b?.z||e.elevation||e.points?.some(p=>p.z)||e.extrusion&&(e.extrusion.x||e.extrusion.y||e.extrusion.z!==1))continue;
        const segments=e.type==='LINE'?[[e.a,e.b,undefined]]:e.type==='LWPOLYLINE'&&!e.points.some(p=>p.bulge)?e.points.slice(0,e.closed?undefined:-1).map((p,i)=>[p,e.points[(i+1)%e.points.length],i]):[];
        for(const [a,b,segment]of segments){const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);if(l<linearTolerance)continue;
            if(Math.abs(dy)/l<angularTolerance)append({type:'horizontal',entities:[e.id],...(segment!==undefined?{segmentA:segment}:{})});
            else if(Math.abs(dx)/l<angularTolerance)append({type:'vertical',entities:[e.id],...(segment!==undefined?{segmentA:segment}:{})});
        }
        if(e.type==='LINE')points.push({id:e.id,key:'a',p:e.a},{id:e.id,key:'b',p:e.b});
        if(e.type==='LWPOLYLINE'&&!e.points.some(p=>p.bulge))e.points.forEach((p,i)=>points.push({id:e.id,key:`points.${i}`,p}));
    }
    if(points.length>8192)throw new Error('Automatic endpoint budget exceeds 8192');
    for(const c of existing)if(c.type==='coincident'&&!c.suppressed&&!c.reference&&c.entities?.length===2){const [a,b]=c.entities;connected.set(root(a+'/'+(c.pointA||'b')),root(b+'/'+(c.pointB||'a')));}
    for(const p of points){const ix=Math.floor(p.p.x/linearTolerance),iy=Math.floor(p.p.y/linearTolerance),identity=p.id+'/'+p.key;
        for(let x=ix-1;x<=ix+1;x++)for(let y=iy-1;y<=iy+1;y++)for(const q of buckets.get(`${x},${y}`)||[]){
            if(q.id===p.id||Math.hypot(q.p.x-p.p.x,q.p.y-p.p.y)>linearTolerance)continue;const previous=q.id+'/'+q.key;
            if(root(identity)!==root(previous)){append({type:'coincident',entities:[q.id,p.id],pointA:q.key,pointB:p.key});connected.set(root(identity),root(previous));}
        }
        const key=`${ix},${iy}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p);
    }
    return result;
}
/** Resolve and atomically apply computed TEXT values from parameters and named measurements. */
export function evaluateCalculations(entities, constraints, parameters) {
    const values={...resolveParameters(parameters)},updates=[];
    for(const c of constraints)if(c.name&&!c.suppressed){const value=measureConstraint(entities,c);if(value!==null)values[c.name]=value;}
    for(const e of entities)if(e.calculation){if(!['TEXT','MTEXT','ATTRIB','ATTDEF'].includes(e.type))throw new Error('Calculated annotations require a text entity');const spec=e.calculation,value=parseExpression(spec.expression,values),precision=spec.precision??3;if(!Number.isInteger(precision)||precision<0||precision>12)throw new Error('Annotation precision must be 0–12');updates.push({entity:e,value,text:`${spec.prefix||''}${Number(value.toFixed(precision))}${spec.suffix||''}`});}
    for(const {entity,text,value}of updates){entity.text=text;entity.calculation.value=value;}
    return updates.map(({entity,value,text})=>({entityId:entity.id,value,text}));
}
