import { dimensionGrips, dynamicParameterGrips, dynamicGripValue } from '@conduitcad/model';
import { distance } from '@conduitcad/geometry';
import { fields2, anchor2, number2 } from './fields.js';
const DEG=Math.PI/180;
export function handles2(session,pixelsPerUnit=1){
    if(!Number.isFinite(pixelsPerUnit)||pixelsPerUnit<=0)throw new Error('Invalid view scale');
    const doc=session.preview||session.base,e=doc.entities.find(e=>e.id===session.resultIds[0])||doc.entities.find(e=>e.id===session.ids[0]),out=[];
    const p=(id,label,point,fields,kind='point',extra={})=>out.push({id,label,point:{x:point.x,y:point.y},fields,kind,...extra});
    const axis=(id,label,origin,direction,value,field)=>p(id,label,{x:origin.x+direction.x*value,y:origin.y+direction.y*value},[field],'axis',{origin,direction,value});
    if(session.operation!=='geometry'){
        const pivot={x:session.parameters.px!==undefined?session.value('px'):session.pivot.x,y:session.parameters.py!==undefined?session.value('py'):session.pivot.y},radius=Math.max(session.extent*.65,64/pixelsPerUnit);
        if(session.operation==='move'){const c={x:pivot.x+session.value('dx'),y:pivot.y+session.value('dy')};p('move','Move selection',c,['dx','dy']);axis('move-x','Move X',c,{x:1,y:0},56/pixelsPerUnit,'dx');axis('move-y','Move Y',c,{x:0,y:1},56/pixelsPerUnit,'dy');}
        if(session.operation==='rotate'){const a=session.value('angle')*DEG;p('rotate','Rotate selection',{x:pivot.x+radius*Math.cos(a),y:pivot.y+radius*Math.sin(a)},['angle'],'angle',{origin:pivot,radius});p('pivot','Transform pivot',pivot,['px','py']);}
        if(session.operation==='scale'){axis('scale','Scale selection',pivot,{x:1,y:0},radius*session.value('factor'),'factor');out.at(-1).factor=1/radius;p('pivot','Transform pivot',pivot,['px','py']);}
        if(session.operation==='offset'){const a=e.c||e.a||e.points[0],b=e.b||e.points?.[1];let n={x:1,y:0};if(b){const l=distance(a,b);n={x:-(b.y-a.y)/l,y:(b.x-a.x)/l};}axis('offset','Offset distance',a,n,e.r||40/pixelsPerUnit,'amount');}
        if(session.operation==='fillet')axis('fillet','Fillet radius',pivot,{x:1,y:0},session.value('radius'),'radius');
        return out;
    }
    const fs=new Set(session.definitions.map(f=>f.name)),a=anchor2(e),center=()=>{if(fs.has('x'))p('position','Position',a,['x','y']);};
    center();
    if(e.type==='LINE'){
        out.length=0;p('start','Start point',e.a,['x','y','length','angle'],'line-start');p('end','End point',e.b,['length','angle'],'line-end');
        const l=distance(e.a,e.b),n={x:(e.b.x-e.a.x)/l,y:(e.b.y-e.a.y)/l};axis('length','Length',e.a,n,l,'length');
    }
    if(e.type==='CIRCLE'||e.type==='ARC')axis('radius','Radius',e.c,{x:1,y:0},e.r,'radius');
    if(e.type==='ARC')for(const k of ['start','end'])p(k,k+' angle',{x:e.c.x+e.r*Math.cos(e[k]),y:e.c.y+e.r*Math.sin(e[k])},[k],'angle',{origin:e.c,radius:e.r});
    if(e.type==='ELLIPSE'){const major=Math.hypot(e.major.x,e.major.y),u={x:e.major.x/major,y:e.major.y/major};axis('major','Major radius',e.c,u,major,'majorRadius');axis('minor','Minor radius',e.c,{x:-u.y,y:u.x},major*e.ratio,'minorRadius');}
    if(e.parametric?.kind==='rectangle'){
        const a=e.points[0],b=e.points[1],d=e.points[3],w=distance(a,b),h=distance(a,d);
        if(!out.some(x=>x.id==='position'))p('position','Position',a,['x','y']);axis('width','Width',a,{x:(b.x-a.x)/w,y:(b.y-a.y)/w},w,'rectWidth');axis('height','Height',a,{x:(d.x-a.x)/h,y:(d.y-a.y)/h},h,'rectHeight');
    }else if(e.type==='SPLINE'||e.points){const points=e.type==='SPLINE'?e.controlPoints:e.points;(points||[]).forEach((point,i)=>{if(fs.has(`v${i}x`))p('vertex-'+i,'Vertex '+(i+1),point,[`v${i}x`,`v${i}y`]);});}
    if(['TEXT','MTEXT','ATTDEF','ATTRIB'].includes(e.type)){axis('height','Text height',e.p,{x:-Math.sin((e.rotation||0)*DEG),y:Math.cos((e.rotation||0)*DEG)},e.height,'height');if(e.type==='MTEXT')axis('text-width','Text width',e.p,{x:Math.cos((e.rotation||0)*DEG),y:Math.sin((e.rotation||0)*DEG)},e.mtextWidth||30,'mtextWidth');}
    if(['RAY','XLINE'].includes(e.type))p('direction','Direction',{x:e.p.x+e.direction.x*70/pixelsPerUnit,y:e.p.y+e.direction.y*70/pixelsPerUnit},['angle'],'angle',{origin:e.p});
    if(e.type==='DIMENSION')for(const g of dimensionGrips(e,doc)){const key=g.key.slice(4);p(key,key==='textMidpoint'?'Dimension text':key==='definitionPoint'?'Dimension line':'Witness point',g,[key+'X',key+'Y']);}
    if(e.type==='HATCH')for(let j=0;j<e.loops.length;j++)for(let i=0;i<e.loops[j].points.length;i++)p(`h${j}v${i}`,`Boundary ${j+1} / ${i+1}`,e.loops[j].points[i],[`h${j}v${i}x`,`h${j}v${i}y`]);
    if(e.type==='INSERT'){
        for(const g of dynamicParameterGrips(e,doc))p(g.key,'Parameter '+g.key.slice(4),g,['dynamic:'+g.key.slice(4)],'dynamic');
        const angle=(e.rotation||0)*DEG,r=75/pixelsPerUnit;p('rotation','Rotation',{x:e.x+r*Math.cos(angle),y:e.y+r*Math.sin(angle)},['rotation'],'angle',{origin:{x:e.x,y:e.y},radius:r});
    }
    return out;
}
/** Convert a world-space gesture relative to its immutable start snapshot. */
export function dragHandle2(session,handle,delta,before,{step=0,angleStep=0}={}) {
    if(!Number.isFinite(delta.x)||!Number.isFinite(delta.y))throw new Error('Invalid pointer coordinates');
    const point={x:handle.point.x+delta.x,y:handle.point.y+delta.y},snap=(v,s)=>s?Math.round(v/s)*s:v;
    const assign=(key,value,s=step)=>session.dragValue(key,snap(value,s),before);
    const val=key=>number2(before[key],session.base,session.field(key));
    if(handle.kind==='axis'){const k=handle.fields[0],n=handle.direction;assign(k,val(k)+(delta.x*n.x+delta.y*n.y)*(handle.factor||1),k==='factor'?(step?.01:0):step);}
    else if(handle.kind==='angle'){
        if(distance(point,handle.origin)<1e-8)throw new Error('Angle point cannot coincide with its center');
        const from=Math.atan2(handle.point.y-handle.origin.y,handle.point.x-handle.origin.x),to=Math.atan2(point.y-handle.origin.y,point.x-handle.origin.x),d=Math.atan2(Math.sin(to-from),Math.cos(to-from))/DEG;
        assign(handle.fields[0],val(handle.fields[0])+d,angleStep);
    }else if(handle.kind==='dynamic'){
        const e=session.base.entities.find(e=>e.id===session.ids[0]);assign(handle.fields[0],dynamicGripValue({...e,x:val('x'),y:val('y'),rotation:val('rotation'),sx:val('sx'),sy:val('sy')},session.base,handle.fields[0].slice(8),point));
    }else if(handle.kind==='line-start'||handle.kind==='line-end'){
        const e=session.base.entities.find(e=>e.id===session.ids[0]);
        const originalA={x:val('x'),y:val('y')},l=val('length'),a=val('angle')*DEG,originalB={x:originalA.x+l*Math.cos(a),y:originalA.y+l*Math.sin(a)},p={x:snap(point.x,step),y:snap(point.y,step)},aa=handle.kind==='line-start'?p:originalA,bb=handle.kind==='line-end'?p:originalB;
        if(handle.kind==='line-start'){assign('x',aa.x,0);assign('y',aa.y,0);}assign('length',distance(aa,bb),0);assign('angle',Math.atan2(bb.y-aa.y,bb.x-aa.x)/DEG,0);
    }else {assign(handle.fields[0],val(handle.fields[0])+delta.x);assign(handle.fields[1],val(handle.fields[1])+delta.y);}
}
