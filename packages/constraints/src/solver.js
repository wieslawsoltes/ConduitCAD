import { parseExpression, expressionNames } from './expressions.js';

const idsOf = c => c.entities || (c.entityId ? [c.entityId] : []);
const types = new Set(['horizontal','vertical','length','radius','diameter','coincident','concentric','parallel','perpendicular','collinear','equal','angle','angle-between','fixed','fixed-point','distance','distance-x','distance-y','point-on-line','point-on-circle','midpoint','tangent','symmetric']);
const numeric = new Set(['length','radius','diameter','angle','angle-between','distance','distance-x','distance-y']);
const refMode = c => c.reference === true || c.mode === 'reference';
const drivingParameters = (constraints, parameters) => ({...parameters,...Object.fromEntries(constraints.filter(c=>c.name&&!c.suppressed&&!refMode(c)&&numeric.has(c.type)).map(c=>[c.name,c.value]))});
const pointKeys = e => ['a','b','c','p'].filter(k => e[k]).concat((e.points || []).map((_, i) => `points.${i}`));
function point(e, key) {
    if (!e) throw new Error('Constraint references a missing entity');
    if (key === 'start') key = 'a'; if (key === 'end') key = 'b'; if (key === 'center') key = 'c';
    const p = /^points\.\d+$/.test(key) ? e.points?.[Number(key.slice(7))] : ['a','b','c','p'].includes(key) ? e[key] : null;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error(`Constraint needs a valid point: ${e.id}.${key}`);
    return p;
}
const defaultPoint = e => e?.b ? 'b' : e?.c ? 'c' : e?.p ? 'p' : 'points.0';
const secondPoint = e => e?.a ? 'a' : e?.c ? 'c' : e?.p ? 'p' : 'points.0';
const norm = a => Math.hypot(...a);
const wrap = x => Math.atan2(Math.sin(x), Math.cos(x));

/** Rank-revealing column-pivoted Householder QR; never forms JᵀJ. */
function qr(matrix, rhs = null, tolerance = 1e-10) {
    const m = matrix.length, n = matrix[0]?.length || 0;
    const a = matrix.map(r => Float64Array.from(r)), b = rhs ? Float64Array.from(rhs) : new Float64Array(m), permutation = Array.from({length:n}, (_,i)=>i);
    let rank = 0, largest = 0;
    for (let k=0;k<Math.min(m,n);k++) {
        let pivot=k, best=-1;
        for(let j=k;j<n;j++){let s=0;for(let i=k;i<m;i++)s+=a[i][j]*a[i][j];if(s>best){best=s;pivot=j;}}
        const size=Math.sqrt(best);if(k===0)largest=size;
        if(size<=Math.max(largest*tolerance,1e-15))break;
        if(pivot!==k){for(let i=0;i<m;i++)[a[i][k],a[i][pivot]]=[a[i][pivot],a[i][k]];[permutation[k],permutation[pivot]]=[permutation[pivot],permutation[k]];}
        const alpha=a[k][k]>=0?-size:size, v=new Float64Array(m-k);v[0]=a[k][k]-alpha;
        for(let i=k+1;i<m;i++)v[i-k]=a[i][k];let vv=0;for(const x of v)vv+=x*x;
        const beta=2/vv;
        for(let j=k+1;j<n;j++){let d=0;for(let i=k;i<m;i++)d+=v[i-k]*a[i][j];d*=beta;for(let i=k;i<m;i++)a[i][j]-=d*v[i-k];}
        let d=0;for(let i=k;i<m;i++)d+=v[i-k]*b[i];d*=beta;for(let i=k;i<m;i++)b[i]-=d*v[i-k];
        a[k][k]=alpha;for(let i=k+1;i<m;i++)a[i][k]=0;rank++;
    }
    const z=new Float64Array(n),x=new Float64Array(n);
    for(let i=rank-1;i>=0;i--){let v=b[i];for(let j=i+1;j<rank;j++)v-=a[i][j]*z[j];z[i]=v/a[i][i];}
    for(let i=0;i<n;i++)x[permutation[i]]=z[i];
    return {x,rank,permutation};
}
/** Dense forward-mode derivatives inside one bounded connected component. */
function algebra(n) {
    let singular=false;
    const c = v => ({v,d:new Float64Array(n)});
    const add = (a,b) => {const r=c(a.v+b.v);for(let i=0;i<n;i++)r.d[i]=a.d[i]+b.d[i];return r;};
    const sub = (a,b) => {const r=c(a.v-b.v);for(let i=0;i<n;i++)r.d[i]=a.d[i]-b.d[i];return r;};
    const mul = (a,b) => {const r=c(a.v*b.v);for(let i=0;i<n;i++)r.d[i]=a.d[i]*b.v+b.d[i]*a.v;return r;};
    const div = (a,b) => {if(Math.abs(b.v)<1e-20)throw new Error('Degenerate constraint geometry');const r=c(a.v/b.v);for(let i=0;i<n;i++)r.d[i]=(a.d[i]-r.v*b.d[i])/b.v;return r;};
    const hypot = (a,b) => {const h=Math.hypot(a.v,b.v),r=c(h);if(h<=1e-20)singular=true;if(h>1e-20)for(let i=0;i<n;i++)r.d[i]=(a.v*a.d[i]+b.v*b.d[i])/h;return r;};
    const atan2 = (y,x) => {const r=c(Math.atan2(y.v,x.v)),den=x.v*x.v+y.v*y.v;if(den<1e-24)throw new Error('Degenerate line direction');for(let i=0;i<n;i++)r.d[i]=(x.v*y.d[i]-y.v*x.d[i])/den;return r;};
    const delta = (a,b) => ({x:sub(a.x,b.x),y:sub(a.y,b.y)});
    return {c,add,sub,mul,div,hypot,atan2,delta,clearSingular:()=>{singular=false;},isSingular:()=>singular};
}
function compile(entities, constraints, parameters, maxVariables) {
    const map=new Map(entities.map(e=>[e.id,e]));
    const xs=[],ys=[],sizes=[];
    for(const e of entities){for(const k of pointKeys(e)){const p=point(e,k);xs.push(p.x);ys.push(p.y);}if(e.r!==undefined)sizes.push(e.r);}
    const ox=xs.length?Math.min(...xs):0,oy=ys.length?Math.min(...ys):0;
    const targets=constraints.map(c=>numeric.has(c.type)&&!refMode(c)?parseExpression(c.value,parameters):0);
    const scale=Math.max(1e-6,Math.max(...xs,ox)-ox,Math.max(...ys,oy)-oy,...sizes,...targets.filter((_,i)=>!['angle','angle-between'].includes(constraints[i].type)).map(Math.abs));
    const descriptors=[],index=new Map();
    for(const e of entities){
        if(!['LINE','CIRCLE','ARC','POINT','LWPOLYLINE','POLYLINE'].includes(e.type))throw new Error(`Unsupported constrained geometry: ${e.type}`);
        if(e.extrusion&&(e.extrusion.x||e.extrusion.y||e.extrusion.z!==1))throw new Error('Constraints require default planar OCS');
        if(e.elevation)throw new Error('Constraints require XY geometry at Z=0');
        if(e.type==='POLYLINE'&&(e.flags&(8|16|64))||e.points?.some(p=>p.bulge))throw new Error('Constraints require a straight planar polyline');
        for(const k of pointKeys(e)){const p=point(e,k);if(p.z)throw new Error('Constraints require XY geometry at Z=0');for(const axis of ['x','y']){index.set(`${e.id}/${k}/${axis}`,descriptors.length);descriptors.push({value:(p[axis]-(axis==='x'?ox:oy))/scale,object:p,key:axis,origin:axis==='x'?ox:oy});}}
        if(e.r!==undefined){if(!(e.r>0))throw new Error('Radius must be positive');index.set(`${e.id}/r`,descriptors.length);descriptors.push({value:e.r/scale,object:e,key:'r',origin:0});}
        if(e.type==='LINE'&&Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y)<scale*1e-12)throw new Error('Constraint requires a nondegenerate line');
    }
    if(descriptors.length>maxVariables)throw new Error(`Connected sketch exceeds ${maxVariables} scalar variables`);
    const n=descriptors.length,{c,add,sub,mul,div,hypot,atan2,delta,clearSingular,isSingular}=algebra(n);
    const radius=(e,v)=>{if(!e?.c||e.r===undefined)throw new Error('Constraint requires a circle or arc');return variable(`${e.id}/r`,v);};
    function variable(key,v){const i=index.get(key);if(i===undefined)throw new Error(`Missing constrained coordinate: ${key}`);const r=c(v[i]);r.d[i]=1;return r;}
    function pos(e,key,v){point(e,key);key=key==='start'?'a':key==='end'?'b':key==='center'?'c':key;return {x:variable(`${e.id}/${key}/x`,v),y:variable(`${e.id}/${key}/y`,v)};}
    function start(e,segment=0){return e?.type==='LINE'?'a':`points.${segment}`;}
    function direction(e,v,segment=0){
        if(e?.type==='LINE')return delta(pos(e,'b',v),pos(e,'a',v));
        if(!['LWPOLYLINE','POLYLINE'].includes(e?.type)||!Number.isInteger(segment)||segment<0||segment>=e.points.length-(e.closed?0:1))throw new Error('Constraint requires a line or valid straight polyline segment');
        return delta(pos(e,`points.${(segment+1)%e.points.length}`,v),pos(e,`points.${segment}`,v));
    }
    const length = u=>hypot(u.x,u.y),dot=(u,v)=>add(mul(u.x,v.x),mul(u.y,v.y)),cross=(u,v)=>sub(mul(u.x,v.y),mul(u.y,v.x));
    function residual(v, includeReferences=false){
        clearSingular();const rows=[],owners=[];
        constraints.forEach((con,k)=>{
            if(con.suppressed||refMode(con)&&!includeReferences)return;
            const es=idsOf(con).map(id=>map.get(id)),[a,b,z]=es,value=targets[k],out=[];
            const pp=()=>pos(a,con.pointA||defaultPoint(a),v),qq=()=>pos(b,con.pointB||secondPoint(b),v);
            const dir=e=>direction(e,v,e===a?(con.segmentA??0):(con.segmentB??0)),first=e=>pos(e,start(e,e===a?(con.segmentA??0):(con.segmentB??0)),v);
            const pushPoint=(p,q)=>out.push(sub(p.x,q.x),sub(p.y,q.y));
            switch(con.type){
                case 'horizontal':out.push(dir(a).y);break;
                case 'vertical':out.push(dir(a).x);break;
                case 'length':out.push(sub(length(dir(a)),c(value/scale)));break;
                case 'radius':out.push(sub(radius(a,v),c(value/scale)));break;
                case 'diameter':out.push(sub(mul(c(2),radius(a,v)),c(value/scale)));break;
                case 'coincident':pushPoint(pp(),qq());break;
                case 'concentric':radius(a,v);radius(b,v);pushPoint(pos(a,'c',v),pos(b,'c',v));break;
                case 'parallel':case 'perpendicular':case 'collinear':{
                    const u=dir(a),w=dir(b),den=mul(length(u),length(w));
                    out.push(div(con.type==='perpendicular'?dot(u,w):cross(u,w),den));
                    if(con.type==='collinear')out.push(div(cross(delta(first(b),first(a)),u),length(u)));break;
                }
                case 'equal':if((a.r!==undefined)!==(b?.r!==undefined))throw new Error('Equal requires matching geometry');out.push(sub(a.r!==undefined?radius(a,v):length(dir(a)),b?.r!==undefined?radius(b,v):length(dir(b))));break;
                case 'angle':case 'angle-between':{
                    const u=dir(a);let angle=atan2(u.y,u.x);
                    if(con.type==='angle-between'){const w=dir(b);angle=sub(atan2(w.y,w.x),angle);}
                    const r=sub(angle,c(value*Math.PI/180));r.v=wrap(r.v);out.push(r);break;
                }
                case 'distance':case 'distance-x':case 'distance-y':{
                    const u=delta(qq(),pp());out.push(sub(con.type==='distance'?length(u):u[con.type==='distance-x'?'x':'y'],c(value/scale)));break;
                }
                case 'point-on-line':case 'midpoint':{
                    const u=dir(b),start=first(b);
                    if(con.type==='midpoint')pushPoint(pp(),{x:add(start.x,mul(u.x,c(.5))),y:add(start.y,mul(u.y,c(.5)))});
                    else out.push(div(cross(delta(pp(),start),u),length(u)));break;
                }
                case 'point-on-circle':out.push(sub(length(delta(pp(),pos(b,'c',v))),radius(b,v)));break;
                case 'tangent':{
                    if(a.type==='LINE'||b?.type==='LINE'){
                        const l=a.type==='LINE'?a:b,ring=a.type==='LINE'?b:a,u=direction(l,v);
                        const r=div(cross(u,delta(pos(ring,'c',v),pos(l,'a',v))),length(u));
                        const side=con.side??(Math.sign((l.b.x-l.a.x)*(ring.c.y-l.a.y)-(l.b.y-l.a.y)*(ring.c.x-l.a.x))||1);
                        out.push(sub(r,mul(c(side),radius(ring,v))));
                    }else{const r1=radius(a,v),r2=radius(b,v);out.push(sub(length(delta(pos(a,'c',v),pos(b,'c',v))),con.internal?mul(c(con.side??(a.r>=b.r?1:-1)),sub(r1,r2)):add(r1,r2)));}break;
                }
                case 'symmetric':{
                    const u=direction(z,v,con.segmentC??0),p=pp(),q=qq(),mid={x:mul(add(p.x,q.x),c(.5)),y:mul(add(p.y,q.y),c(.5))};
                    out.push(div(cross(delta(mid,pos(z,start(z,con.segmentC??0),v)),u),length(u)),div(dot(delta(q,p),u),length(u)));break;
                }
                case 'fixed-point':{
                    const t=con.target;if(!t||!Number.isFinite(t.x)||!Number.isFinite(t.y))throw new Error('Fixed point requires an explicit target');pushPoint(pp(),{x:c((t.x-ox)/scale),y:c((t.y-oy)/scale)});break;
                }
                case 'fixed':{
                    const t=con.target;if(!t)throw new Error('Fixed geometry requires an explicit target');
                    for(const key of pointKeys(a)){const p=point(t,key);pushPoint(pos(a,key,v),{x:c((p.x-ox)/scale),y:c((p.y-oy)/scale)});}
                    if(a.r!==undefined){if(!Number.isFinite(t.r))throw new Error('Missing fixed radius target');out.push(sub(radius(a,v),c(t.r/scale)));}break;
                }
                default:throw new Error(`Unknown constraint: ${con.type}`);
            }
            for(const row of out){if(!Number.isFinite(row.v)||row.d.some(v=>!Number.isFinite(v)))throw new Error('Non-finite constraint residual');rows.push(row);owners.push(k);}
        });return {r:rows.map(v=>v.v),j:rows.map(v=>v.d),owners,singular:isSingular()};
    }
    const initial=descriptors.map(v=>v.value);residual(initial);
    return {initial,descriptors,scale,residual,constraints,valid:v=>v.every(Number.isFinite)&&descriptors.every((d,i)=>d.key!=='r'||v[i]>1e-12),apply:v=>descriptors.forEach((d,i)=>{d.object[d.key]=v[i]*scale+d.origin;})};
}
function solveComponent(problem, options, analyzeOnly=false){
    let x=problem.initial.slice(),current=problem.residual(x),cost=norm(current.r),lambda=1e-3,iterations=0,rejected=0;
    const threshold=options.tolerance/problem.scale+options.relativeTolerance;
    let singularStartPerturbed=false;
    if(!analyzeOnly&&current.singular&&cost>threshold){
        // Break only a nondifferentiable zero-distance initial state. The deterministic
        // trial stays private and is accepted only if it lowers the original residual.
        const seed=x.map((v,i)=>problem.descriptors[i].key==='r'?v:v+1e-4*(i%7+1)*(i%2?1:-1));
        if(problem.valid(seed))try{const trial=problem.residual(seed),value=norm(trial.r);if(value<cost){x=seed;current=trial;cost=value;singularStartPerturbed=true;}}catch{}
    }
    if(!analyzeOnly)for(;iterations<options.maxIterations&&Math.max(0,...current.r.map(Math.abs))>threshold;iterations++){
        const n=x.length,col=Array.from({length:n},(_,k)=>Math.max(1e-6,Math.hypot(...current.j.map(r=>r[k]))));
        const augmented=current.j.map(r=>Array.from(r)),rhs=current.r.map(v=>-v);
        for(let k=0;k<n;k++){const row=new Float64Array(n);row[k]=Math.sqrt(lambda)*col[k];augmented.push(row);rhs.push(0);}
        const step=qr(augmented,rhs).x;let max=Math.max(0,...step.map(Math.abs));if(max>10)for(let k=0;k<n;k++)step[k]*=10/max;
        const candidate=x.map((v,k)=>v+step[k]);let trial=null,nextCost=Infinity;
        if(problem.valid(candidate))try{trial=problem.residual(candidate);nextCost=norm(trial.r);}catch{/* Reject a degenerate trial without touching source. */}
        if(nextCost<cost){x=candidate;current=trial;cost=nextCost;lambda=Math.max(1e-12,lambda*.25);}else{lambda=Math.min(1e16,lambda*8);rejected++;if(lambda===1e16)break;}
    }
    const rank=qr(current.j,null,options.rankTolerance).rank,n=x.length,m=current.r.length;
    const equationQR=qr(Array.from({length:n},(_,k)=>current.j.map(row=>row[k])),null,options.rankTolerance);
    const dependent=new Set(equationQR.permutation.slice(rank).map(i=>current.owners[i]));
    const converged=Math.max(0,...current.r.map(Math.abs))<=threshold;
    const perConstraint=problem.constraints.map((c,k)=>{const rs=current.r.filter((_,i)=>current.owners[i]===k),error=Math.max(0,...rs.map(Math.abs));return {id:c.id??`constraint-${k}`,type:c.type,mode:refMode(c)?'reference':'driving',suppressed:!!c.suppressed,residual:error*problem.scale,satisfied:error<=threshold,redundant:converged&&dependent.has(k)};});
    return {x,converged,iterations,singularStartPerturbed,rejectedSteps:rejected,residual:cost*problem.scale,normalizedResidual:cost,variables:n,equations:m,rank,degreesOfFreedom:n-rank,redundantEquations:m-rank,constraints:perConstraint,status:converged?(rank===n?'fully-constrained':'under-constrained'):'conflicting-or-unconverged'};
}
export class SketchSolver {
    constructor({tolerance=1e-7,relativeTolerance=1e-10,maxIterations=100,maxVariables=256,rankTolerance=1e-9}={}){
        if(!Number.isFinite(tolerance)||tolerance<=0||!Number.isFinite(relativeTolerance)||relativeTolerance<0||!Number.isInteger(maxIterations)||maxIterations<1||maxIterations>1000||!Number.isInteger(maxVariables)||maxVariables<1||maxVariables>512||!Number.isFinite(rankTolerance)||rankTolerance<=0)throw new Error('Invalid solver options');
        Object.assign(this,{tolerance,relativeTolerance,maxIterations,maxVariables,rankTolerance});
    }
    analyze(entities,constraints,parameters={}){return this.solve(entities,constraints,parameters,{analyzeOnly:true});}
    solve(entities,constraints,parameters={}, {analyzeOnly=false}={}){
        if(!Array.isArray(entities)||!Array.isArray(constraints)||constraints.length>4096)throw new Error('Invalid sketch or constraint budget');
        const attached=new Set(constraints.filter(c=>!c.suppressed&&!refMode(c)).flatMap(idsOf));
        constraints=[...constraints,...entities.filter(e=>e.locked&&attached.has(e.id)).map(e=>({id:'locked-'+e.id,type:'fixed',entityId:e.id,target:structuredClone(e),visible:false}))];
        const map=new Map(entities.map(e=>[e.id,e]));if(map.size!==entities.length)throw new Error('Duplicate sketch entity IDs');
        const parent=new Map(),find=id=>{if(!parent.has(id))parent.set(id,id);const p=parent.get(id);if(p!==id)parent.set(id,find(p));return parent.get(id);};
        const constraintNames=new Set();
        for(const c of constraints){
            if(c.name){if(!/^[A-Za-z_]\w*$/.test(c.name)||expressionNames().includes(c.name)||constraintNames.has(c.name)||Object.hasOwn(parameters,c.name))throw new Error('Invalid or duplicate constraint name: '+c.name);constraintNames.add(c.name);}
        }
        parameters=drivingParameters(constraints,parameters);
        for(const c of constraints){
            if(c.type==='tangent'&&c.side!==undefined&&![1,-1].includes(c.side))throw new Error('Tangent side must be +1 or -1');
            if(c.suppressed)continue;if(!types.has(c.type))throw new Error(`Unknown constraint: ${c.type}`);
            const ids=idsOf(c);if(!ids.length||ids.some(id=>!map.has(id)))throw new Error('Constraint references a missing entity');
            if(numeric.has(c.type)&&!refMode(c)){const v=parseExpression(c.value,parameters);if(['length','radius','diameter','distance'].includes(c.type)&&v<=0)throw new Error('Constraint size must be positive');}
            if(refMode(c)){measureConstraint(entities,c);continue;}
            ids.forEach(id=>{const root=find(ids[0]);parent.set(find(id),root);});
        }
        const groups=new Map();for(const id of parent.keys()){const root=find(id);if(!groups.has(root))groups.set(root,{ids:[],constraints:[]});groups.get(root).ids.push(id);}
        for(const c of constraints)if(!c.suppressed&&!refMode(c))groups.get(find(idsOf(c)[0])).constraints.push(c);
        const problems=[...groups.values()].map(g=>compile(g.ids.map(id=>map.get(id)),g.constraints,parameters,this.maxVariables));
        if(problems.reduce((n,p)=>n+p.initial.length,0)>4096)throw new Error('Sketch exceeds 4096 scalar variables');
        sketchAnnotations(entities,constraints,parameters);
        const results=problems.map(p=>solveComponent(p,this,analyzeOnly)),converged=results.every(r=>r.converged);
        if(converged&&!analyzeOnly)problems.forEach((p,i)=>p.apply(results[i].x));
        const sum=k=>results.reduce((n,r)=>n+r[k],0);
        const unconstrainedVariables=entities.filter(e=>!e.locked&&!parent.has(e.id)&&['LINE','CIRCLE','ARC','POINT','LWPOLYLINE'].includes(e.type)).reduce((n,e)=>n+pointKeys(e).length*2+(e.r!==undefined?1:0),0);
        const dof=sum('degreesOfFreedom')+unconstrainedVariables;
        const annotated=sketchAnnotations(entities,constraints,parameters);
        const diagnostics=results.flatMap(r=>r.constraints);
        return {converged,iterations:Math.max(0,...results.map(r=>r.iterations)),residual:Math.hypot(...results.map(r=>r.residual)),variables:sum('variables')+unconstrainedVariables,unconstrainedVariables,affectedVariables:sum('variables'),equations:sum('equations'),rank:sum('rank'),degreesOfFreedom:dof,redundantEquations:sum('redundantEquations'),components:results.map(({x,...r})=>r),constraints:diagnostics,annotations:annotated,conflicts:diagnostics.filter(c=>!c.satisfied).map(c=>c.id),status:!results.length?'unconstrained':converged?(dof?'under-constrained':'fully-constrained'):'conflicting-or-unconverged',rolledBack:!converged&&!analyzeOnly,analysisOnly:analyzeOnly,jacobian:'analytic-forward-mode',linearSolver:'column-pivoted-householder-qr'};
    }
}
/** Read-only driving/reference values; measurements never solve or mutate. */
export function measureConstraint(entities,c){
    const [a,b]=idsOf(c).map(id=>entities.find(e=>e.id===id));if(!a)throw new Error('Constraint references a missing entity');
    const ends=e=>{if(e?.a&&e?.b)return [e.a,e.b];const i=e===a?(c.segmentA??0):(c.segmentB??0);if(!e?.points||!Number.isInteger(i)||i<0||i>=e.points.length-(e.closed?0:1))throw new Error('Constraint requires a line or valid polyline segment');return [e.points[i],e.points[(i+1)%e.points.length]];};
    const len=e=>{const [p,q]=ends(e);return Math.hypot(q.x-p.x,q.y-p.y);};
    if(c.type==='length')return len(a);
    if(c.type==='radius'||c.type==='diameter'){if(a.r===undefined)throw new Error('Constraint requires a circle');return a.r*(c.type==='diameter'?2:1);}
    if(c.type==='angle'||c.type==='angle-between'){const [p,q]=ends(a);let angle=Math.atan2(q.y-p.y,q.x-p.x);if(c.type==='angle-between'){const [r,s]=ends(b);angle=wrap(Math.atan2(s.y-r.y,s.x-r.x)-angle);}return angle*180/Math.PI;}
    if(c.type.startsWith('distance')){const p=point(a,c.pointA||defaultPoint(a)),q=point(b,c.pointB||secondPoint(b));return c.type==='distance-x'?q.x-p.x:c.type==='distance-y'?q.y-p.y:Math.hypot(q.x-p.x,q.y-p.y);}
    return null;
}
export function sketchAnnotations(entities,constraints,parameters={}){
    parameters=drivingParameters(constraints,parameters);
    return constraints.filter(c=>!c.suppressed).map((c,i)=>{
        const a=entities.find(e=>e.id===idsOf(c)[0]),b=entities.find(e=>e.id===idsOf(c)[1]);
        let value=measureConstraint(entities,c),target=numeric.has(c.type)&&!refMode(c)?parseExpression(c.value,parameters):null;
        const p=a?.c||a?.p||(a?.a&&a?.b?{x:(a.a.x+a.b.x)/2,y:(a.a.y+a.b.y)/2}:a?.points?.[0])||{x:0,y:0};
        const name=c.name||c.type,text=value===null?name:`${name}${refMode(c)?' (ref)':''} = ${Number(value.toPrecision(8))}${['angle','angle-between'].includes(c.type)?'°':''}`;
        return {id:c.id??`constraint-${i}`,entityIds:idsOf(c),position:{...p},text,value,target,expression:c.value??null,reference:refMode(c),visible:c.visible!==false};
    });
}
