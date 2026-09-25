import { matrix, compose, transform } from '@conduitcad/geometry';
import { regenerateDimensions } from './dimensions.js';
import { ConstraintSolver, resolveParameters, evaluateCalculations } from '@conduitcad/constraints';

const clone = x => structuredClone(x);
const own = (o,k) => Object.hasOwn(o,k);
const attributeTag = e => String(e.attributeTag ?? e.tag ?? '');
const constantAttribute = e => !!(e.constant || ((e.attributeFlags ?? e.flags ?? 0) & 2));
const validName = name => typeof name==='string' && name.trim()===name && name.length>0 && name.length<=255 && !/[<>/\\":;?*|,=`\x00-\x1f]/.test(name) && !['__proto__','constructor','prototype'].includes(name);
const point = (p,label) => {if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e12||Math.abs(p.y)>1e12||p.z)throw new Error(`Invalid planar ${label}`);};
export function blockSignature(block) { return JSON.stringify(block); }
/** Returns direct/nested references without flattening the database or invoking evaluators. */
export function blockReferences(document, name) {
    if(!own(document.blocks,name))throw new Error('Missing block definition: '+name);
    const affected=new Set([name]);let changed=true;
    while(changed){changed=false;for(const [key,b]of Object.entries(document.blocks))if(!affected.has(key)&&(b.entities||[]).some(e=>e.type==='INSERT'&&affected.has(e.block))){affected.add(key);changed=true;}}
    const direct=document.entities.filter(e=>e.type==='INSERT'&&e.block===name).map(e=>e.id);
    const inserts=document.entities.filter(e=>e.type==='INSERT'&&affected.has(e.block)).map(e=>e.id);
    const nested=Object.entries(document.blocks).flatMap(([owner,b])=>(b.entities||[]).filter(e=>e.type==='INSERT'&&e.block===name).map(e=>({owner,entityId:e.id})));
    return {name,direct,inserts,nested,definitions:[...affected]};
}
function checkTree(blocks,root) {
    const done=new Set(),active=new Set();
    const visit=(name,depth)=>{
        if(depth>32)throw new Error('Block nesting exceeds 32 levels');if(active.has(name))throw new Error('Cyclic block nesting: '+[...active,name].join(' → '));if(done.has(name))return;
        const b=blocks[name];if(!b)throw new Error('Missing nested block: '+name);active.add(name);
        for(const e of b.entities||[])if(e.type==='INSERT')visit(e.block,depth+1);
        active.delete(name);done.add(name);
    };visit(root,0);
}
export function validateBlockDraft(block, blocks, evaluate) {
    if(!block||!Array.isArray(block.entities)||block.entities.length>10000)throw new Error('Block must contain at most 10,000 entities');
    point(block.base||{x:0,y:0},'block base');const ids=new Set(),ports=new Set(),tags=new Set();
    const walk=(value,depth=0)=>{if(depth>32)throw new Error('Block data nesting exceeds 32');if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Non-finite block data');if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))throw new Error('Reserved block property');walk(v,depth+1);}};
    walk(block);
    for(const e of block.entities){if(!e.id||ids.has(e.id))throw new Error('Missing or duplicate block entity ID');ids.add(e.id);for(const key of ['a','b','c','p'])if(key in e)point(e[key],'entity '+key);for(const p of e.points||[])point(p,'vertex');if(['CIRCLE','ARC'].includes(e.type)&&!(e.r>0))throw new Error('Radius must be positive');if(e.type==='LINE'&&(!e.a||!e.b))throw new Error('Line needs endpoints');if(e.type==='ATTDEF'){const tag=attributeTag(e);if(!tag||tag.length>255||/\s/.test(tag)||tags.has(tag.toUpperCase()))throw new Error('Attribute tags must be unique and contain no whitespace');tags.add(tag.toUpperCase());e.attributeTag=tag;}}
    for(const p of block.ports||[]){point(p,'port');if(!p.name||ports.has(p.name)||!Number.isFinite(p.dx)||!Number.isFinite(p.dy)||Math.hypot(p.dx,p.dy)<1e-12)throw new Error('Invalid or duplicate block port');ports.add(p.name);if(p.anchor&&!ids.has(p.anchor.entityId))throw new Error('Port anchor references missing geometry');}
    checkTree({...blocks,[block.name]:block},block.name);
    resolveParameters(block.parameters||{});
    if(block.dynamic)evaluate(block,{});
    else if(block.constraints?.length){const report=new ConstraintSolver().solve(block.entities,block.constraints,block.parameters||{});if(!report.converged)throw new Error('Block constraints conflict: '+report.conflicts.join(', '));}
    if(!block.dynamic){
        for(const p of block.ports||[])if(p.anchor){const e=block.entities.find(e=>e.id===p.anchor.entityId),k=p.anchor.point,point=/^points\.\d+$/.test(k)?e?.points?.[Number(k.slice(7))]:['a','b','c','p'].includes(k)?e?.[k]:null;if(!point)throw new Error('Invalid port anchor');p.x=point.x;p.y=point.y;if(p.anchor.followDirection&&e.type==='LINE'){const n=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),sign=p.anchor.reverse?-1:1;if(n<1e-12)throw new Error('Degenerate port direction');p.dx=sign*(e.b.x-e.a.x)/n;p.dy=sign*(e.b.y-e.a.y)/n;}}
        regenerateDimensions({entities:block.entities,dimstyles:block.dimstyles||{}});
        evaluateCalculations(block.entities,block.constraints||[],block.parameters||{});
    }
    return block;
}
/** Isolated copy for a graphical editing session. Does not mutate the source. */
export function beginBlockDraft(document,name) {
    const block=document.blocks[name];if(!block)throw new Error('Missing block: '+name);
    if(block.flags&4)throw new Error('External reference definitions must be resolved before editing');
    const draft={...clone(document),name:`Block: ${name}`,entities:clone(block.entities||[]),constraints:clone(block.constraints||block.dynamic?.constraints||[]),parameters:clone(block.parameters||{}),activeLayout:'Model',layouts:['Model'],metadata:{}};
    delete draft.original;delete draft.originalSource;delete draft.dxfSource;
    for(const e of draft.entities)e.layout='Model';
    draft.blockEditing={name,base:clone(block.base||{x:0,y:0}),ports:clone(block.ports||[]),dynamic:clone(block.dynamic||null)};
    for(const p of block.dynamic?.parameters||[])if(['number','distance','angle','integer'].includes(p.type))draft.parameters[p.name]=p.expression??p.default;
    return {name,signature:blockSignature(block),draft,referenceInfo:blockReferences(document,name)};
}
export function blockFromDraft(session) {
    const old=session.draft.blocks[session.name]||{},info=session.draft.blockEditing;
    const result={...clone(old),name:session.name,base:clone(info.base),ports:clone(info.ports),entities:clone(session.draft.entities),constraints:clone(session.draft.constraints),parameters:clone(session.draft.parameters)};
    if(info.dynamic){result.dynamic=clone(info.dynamic);result.dynamic.constraints=clone(result.constraints);for(const p of result.dynamic.parameters)delete result.parameters[p.name];}
    else delete result.dynamic;
    for(const e of result.entities){delete e.layout;delete e.handle;delete e.owner;delete e.raw;}
    delete result.raw;return result;
}
/** Synchronize native attribute values while retaining existing user text and identity.
 * Decompose the complete affine text frame, including mirrored and rotated nonuniform inserts.
 */
export function syncAttributes(insert,block,nextId) {
    const old=new Map((insert.attributes||[]).map(a=>[attributeTag(a).toUpperCase(),a]));
    const m=compose(matrix(insert),matrix({x:-(block.base?.x||0),y:-(block.base?.y||0)}));
    const definitions=(block.entities||[]).filter(e=>e.type==='ATTDEF'&&!constantAttribute(e));
    const transformed=definitions.map(def=>{
        const tag=attributeTag(def);if(!tag)throw new Error('Missing native attribute tag');
        if(def.extrusion&&(def.extrusion.x||def.extrusion.y||def.extrusion.z!==1))throw new Error('Attribute synchronization requires default OCS');
        const previous=old.get(tag.toUpperCase()),a={...clone(def),id:previous?.id||nextId(),type:'ATTRIB',attributeTag:tag,tag,layer:def.layer==='0'?insert.layer||'0':def.layer||insert.layer||'0',text:def.calculation?def.text??'':previous?.text??def.text??'',p:transform(def.p,m)};
        if(def.alignPoint)a.alignPoint=transform(def.alignPoint,m);
        const angle=(def.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),width=(def.widthFactor||1)*((def.textFlags&2)?-1:1),vertical=(def.textFlags&4)?-1:1,slant=Math.tan((def.oblique||0)*Math.PI/180);
        const ux=m[0]*c*width+m[2]*s*width,uy=m[1]*c*width+m[3]*s*width;
        const vx=(m[0]*(c*slant-s)+m[2]*(s*slant+c))*vertical,vy=(m[1]*(c*slant-s)+m[3]*(s*slant+c))*vertical;
        const baseline=Math.hypot(ux,uy),rise=(ux*vy-uy*vx)/baseline,h=Math.abs(rise);
        if(!Number.isFinite(h)||h<1e-12||baseline<1e-12)throw new Error('Singular attribute frame');
        a.height=(def.height||12)*h;a.widthFactor=baseline/h;a.rotation=Math.atan2(uy,ux)*180/Math.PI;
        a.oblique=Math.atan((ux*vx+uy*vy)/baseline/rise)*180/Math.PI;a.textFlags=((def.textFlags||0)&~6)|(rise<0?4:0);
        a.invisible=!!(def.invisible||def.hidden);delete a.handle;delete a.owner;delete a.raw;return a;
    });
    insert.attributes=transformed;
}
/** Prepare an entire database update, validate all variants and references, then commit once. */
export function prepareBlockDraft(document,name,replacement,{expectedSignature,attributes=true}={},evaluate,nextId) {
    const original=document.blocks[name];if(original?.flags&4)throw new Error('External reference definitions are read-only');if(!original)throw new Error('Missing block definition');
    if(expectedSignature!==undefined&&blockSignature(original)!==expectedSignature)throw new Error('Block changed since editing began. Reopen it before saving.');
    const next=clone(document),block=clone(replacement);block.name=name;block.revision=(original.revision||0)+1;
    validateBlockDraft(block,next.blocks,evaluate);next.blocks[name]=block;
    const info=blockReferences(next,name),names=new Set(info.definitions),affectedIds=new Set(info.inserts);
    for(const root of names)checkTree(next.blocks,root);
    const validateInsert=e=>{
        const b=next.blocks[e.block];if(!b)throw new Error('Missing insert definition');
        const evaluated=b.dynamic?evaluate(b,e.dynamicParameters||{}):b;
        if(e.block===name&&attributes)syncAttributes(e,evaluated,nextId);
        e.dirty=true;return evaluated;
    };
    for(const e of next.entities)if(e.type==='INSERT'&&names.has(e.block))validateInsert(e);
    for(const b of Object.values(next.blocks))for(const e of b.entities||[])if(e.type==='INSERT'&&names.has(e.block))validateInsert(e);
    for(const e of next.entities)if(e.connector)for(const end of ['from','to']){
        const reference=e.connector[end];if(!reference||!affectedIds.has(reference.entityId))continue;
        const insert=next.entities.find(e=>e.id===reference.entityId),b=next.blocks[insert.block],evaluated=b.dynamic?evaluate(b,insert.dynamicParameters||{}):b;
        const portName=reference.port??reference.portName??reference.name;
        if(!(evaluated.ports||[]).some(p=>p.name===portName))throw new Error(`Block update would remove connected port: ${portName}`);
    }
    next.version=(next.version||0)+1;return {document:next,report:{...info,revision:block.revision,updatedInserts:info.inserts.length,attributesSynchronized:attributes}};
}
export function renameBlockInDocument(document,oldName,newName) {
    if(!validName(newName)||own(document.blocks,newName))throw new Error('Invalid or existing block name');
    if(!own(document.blocks,oldName))throw new Error('Missing block definition');
    const next=clone(document);next.blocks[newName]={...next.blocks[oldName],name:newName};delete next.blocks[oldName];
    for(const e of [...next.entities,...Object.values(next.blocks).flatMap(b=>b.entities||[])]){if(e.block===oldName)e.block=newName;if(e.dynamicSource===oldName)e.dynamicSource=newName;}
    return next;
}
export function copyBlockInDocument(document,name,newName) {
    if(!validName(newName)||own(document.blocks,newName))throw new Error('Invalid or existing block name');
    if(!own(document.blocks,name))throw new Error('Missing block definition');
    const next=clone(document);next.blocks[newName]={...clone(next.blocks[name]),name:newName,revision:0};delete next.blocks[newName].symbol;delete next.blocks[newName].handle;return next;
}
/** Create a validated definition without modifying an existing database object. */
export function createBlockInDocument(document,name,definition,evaluate) {
    if(!validName(name)||own(document.blocks,name))throw new Error('Invalid or existing block name');
    const next=clone(document),block={base:{x:0,y:0},ports:[],entities:[],...clone(definition||{}),name,revision:0};
    validateBlockDraft(block,next.blocks,evaluate);next.blocks[name]=block;return next;
}
export function removeBlockInDocument(document,name) {
    const info=blockReferences(document,name);if(info.direct.length||info.nested.length)throw new Error('Referenced blocks cannot be deleted');
    const next=clone(document);delete next.blocks[name];return next;
}
