import { clone, entity, uid, isLocked, moveEntity, transformEntity, entityBounds, syncInsertAttributes } from '@conduitcad/model';
import { bounds, union, emptyBounds, center, validBounds, distance, matrix, compose, offsetPolyline, filletLines } from '@conduitcad/geometry';
import { validateBoundary } from '@conduitcad/drawing';
import { fields2, sourceField2, planarEditable, number2, editFields2 } from './fields.js';
export const PLANAR_OPERATIONS = Object.freeze(['geometry','move','rotate','scale','offset','fillet']);
export function expressionDelta2(source, delta, originalValue) {
    if(!Number.isFinite(delta)||!Number.isFinite(originalValue))throw new Error('Nonfinite drag');
    const value=Number((originalValue+delta).toPrecision(12));
    if(Math.abs(delta)<1e-12)return source;
    if(Number.isFinite(Number(source)))return String(value);
    return `(${source}) ${delta<0?'-':'+'} ${Number(Math.abs(delta).toPrecision(12))}`;
}
function driver(doc,e,f){return doc.constraints?.find(c=>!c.reference&&!c.suppressed&&(c.entities||[c.entityId]).includes(e.id)&&c.type===f.name&&['length','radius'].includes(f.name));}
export class PlanarEditSession {
    constructor(document, ids, {operation='geometry', create=null, process=null}={}) {
        if(!PLANAR_OPERATIONS.includes(operation))throw new Error('Unknown planar operation');
        this.source=document;this.version=document.version;this.signature=JSON.stringify(document);this.base=clone(document);this.ids=[...new Set(ids)];this.operation=operation;this.process=process;this.creation=!!create;
        if(create){const e=clone(create);e.id ||= uid('entity');if(this.base.entities.some(x=>x.id===e.id))throw new Error('Creation ID is already used');this.base.entities.push(e);this.ids=[e.id];}
        if(!this.ids.length||this.ids.length>2048)throw new Error('Select 1–2048 entities');
        const selected=this.ids.map(id=>this.base.entities.find(e=>e.id===id));
        for(const e of selected){const reason=planarEditable(e,this.base);if(reason)throw new Error(reason);}
        if(operation==='geometry'&&selected.length!==1)throw new Error('Choose one entity for geometry editing');
        if(operation==='offset'&&selected.some(e=>!['LINE','CIRCLE','ARC','LWPOLYLINE','POLYLINE'].includes(e.type)||e.points?.some(p=>p.bulge)))throw new Error('Offset supports lines, circles/arcs and straight polylines');
        if(operation==='fillet'&&(selected.length!==2||selected.some(e=>e.type!=='LINE')))throw new Error('Fillet needs exactly two planar lines');
        if(['move','rotate','scale','offset','fillet'].includes(operation)&&selected.some(e=>e.connector))throw new Error('Move connected equipment or edit connector waypoints instead');
        let box=emptyBounds();for(const e of selected)box=union(box,entityBounds(e,this.base));
        this.pivot=validBounds(box)?center(box):{x:0,y:0};this.extent=validBounds(box)?Math.max(box.maxX-box.minX,box.maxY-box.minY,1):50;
        this.parameters={};this.definitions=operation==='geometry'?fields2(selected[0],this.base):[
            ...(operation==='move'?[{name:'dx',label:'Move X',value:0},{name:'dy',label:'Move Y',value:0}]:[]),
            ...(operation==='rotate'?[{name:'angle',label:'Rotation',value:0,unit:'angle'}]:[]),
            ...(operation==='scale'?[{name:'factor',label:'Scale factor',value:1,positive:true}]:[]),
            ...(operation==='offset'?[{name:'amount',label:'Offset distance',value:10}]:[]),
            ...(operation==='fillet'?[{name:'radius',label:'Fillet radius',value:10,positive:true}]:[]),
            ...(['rotate','scale'].includes(operation)?[{name:'px',label:'Pivot X',value:this.pivot.x},{name:'py',label:'Pivot Y',value:this.pivot.y}]:[]),
            ...(['move','rotate','scale','offset'].includes(operation)?[{name:'copy',label:'Result',value:operation==='offset',type:'choice',options:[false,true]}]:[])
        ];
        if(operation==='geometry'){
            const e=selected[0];
            for(const c of this.base.constraints||[])if(!c.reference&&!c.suppressed&&c.value!==undefined&&(c.dimensionId===e.id||(c.entities||[c.entityId]).includes(e.id)))this.definitions.push({name:'constraint:'+c.id,label:'Drive '+(c.name||c.type),value:c.value,driving:true});
            for(const f of this.definitions){const c=driver(this.base,e,f);this.parameters[f.name]=c?String(c.value):f.name.startsWith('constraint:')?String(f.value):sourceField2(e,f);}
        }else for(const f of this.definitions)this.parameters[f.name]=f.type==='choice'?f.value:String(f.value);
        this.initial=clone(this.parameters);this.revision=0;this.validatedRevision=-1;this.preview=null;this.error=null;this.undoStack=[];this.redoStack=[];this.closed=false;this.copyIds=new Map(this.ids.map(id=>[id,uid('entity')]));this.extraId=uid('entity');this.resultIds=this.ids.slice();this.evaluations=0;
    }
    assertOpen(){if(this.closed)throw new Error('This visual edit has ended');}
    field(name){const f=this.definitions.find(f=>f.name===name);if(!f)throw new Error('Unknown field '+name);return f;}
    value(name){const f=this.field(name);return f.type==='text'||f.type==='choice'?this.parameters[name]:number2(this.parameters[name],this.base,f);}
    set(name,value){this.assertOpen();const f=this.field(name);if(f.readOnly)throw new Error('Calculated values are read-only');if(f.type==='choice'&&!f.options.includes(value))throw new Error('Unknown choice');if(f.type!=='choice'&&!(typeof value==='string'||typeof value==='number'))throw new Error('Expected a value or expression');if(String(value).length>16000)throw new Error('Input is too long');if(this.parameters[name]===value)return;this.parameters[name]=f.type==='choice'?value:String(value);this.invalidate();}
    invalidate(){this.preview=null;this.validatedRevision=-1;this.error=null;this.revision++;}
    snapshot(){return clone(this.parameters);}
    checkpoint(before=this.snapshot()){if(JSON.stringify(before)===JSON.stringify(this.parameters))return;this.undoStack.push(before);if(this.undoStack.length>60)this.undoStack.shift();this.redoStack=[];}
    restore(state){this.assertOpen();if(!state||typeof state!=='object'||Array.isArray(state)||Object.keys(state).length!==this.definitions.length||this.definitions.some(f=>!Object.hasOwn(state,f.name)||!['string','number','boolean'].includes(typeof state[f.name])||String(state[f.name]).length>16000||(f.type==='choice'&&!f.options.includes(state[f.name]))))throw new Error('Invalid visual edit snapshot');this.parameters=clone(state);this.invalidate();}
    undo(){if(!this.undoStack.length)return false;this.redoStack.push(this.snapshot());this.restore(this.undoStack.pop());return true;}
    redo(){if(!this.redoStack.length)return false;this.undoStack.push(this.snapshot());this.restore(this.redoStack.pop());return true;}
    dragValue(name,value,before){const f=this.field(name);this.set(name,expressionDelta2(before[name],value-number2(before[name],this.base,f),number2(before[name],this.base,f)));}
    get changed(){return this.creation||this.operation==='offset'||this.operation==='fillet'||JSON.stringify(this.initial)!==JSON.stringify(this.parameters);}
    evaluate(){
        this.assertOpen();if(this.preview&&this.validatedRevision===this.revision)return this.preview;
        this.preview=null;this.error=null;
        try{
            const draft=clone(this.base),map=new Map(draft.entities.map(e=>[e.id,e])),selected=this.ids.map(id=>map.get(id));this.resultIds=this.ids.slice();
            if(this.operation==='geometry'){
                const e=selected[0],changes={};
                for(const f of this.definitions)if(this.parameters[f.name]!==this.initial[f.name]){
                    this.value(f.name);
                    if(f.name.startsWith('constraint:'))draft.constraints.find(c=>c.id===f.name.slice(11)).value=this.parameters[f.name];
                    else {const c=driver(draft,e,f);if(c)c.value=this.parameters[f.name];else changes[f.name]=this.parameters[f.name];}
                }
                if(Object.keys(changes).length)editFields2(e,draft,changes);
            }else{
                const v=Object.fromEntries(this.definitions.map(f=>[f.name,this.value(f.name)]));
                if(v.copy){for(const e of selected){const old=e.id;e.id=this.copyIds.get(old);if(e.attributes)for(let i=0;i<e.attributes.length;i++)e.attributes[i].id=e.id+':attribute:'+i;if(e.dimension?.references)for(const r of Object.values(e.dimension.references))if(this.copyIds.has(r.entityId))r.entityId=this.copyIds.get(r.entityId);draft.entities.push(e);map.set(e.id,e);}draft.entities=draft.entities.map((e,i)=>i<this.base.entities.length&&this.ids.includes(this.base.entities[i].id)?clone(this.base.entities[i]):e);this.resultIds=selected.map(e=>e.id);}
                if(this.operation==='fillet'){
                    const [a,b]=selected,fillet=filletLines(a.a,a.b,b.a,b.b,v.radius),far=(e,p)=>distance(e.a,p)>distance(e.b,p)?e.a:e.b;
                    const maxA=distance(a.a,a.b),maxB=distance(b.a,b.b);if(distance(fillet.p,far(a,fillet.p))>maxA+1e-8||distance(fillet.q,far(b,fillet.q))>maxB+1e-8)throw new Error('Fillet radius exceeds the selected line segments');
                    const aEnd=clone(far(a,fillet.p)),bEnd=clone(far(b,fillet.q));a.a=aEnd;a.b=fillet.p;b.a=fillet.q;b.b=bEnd;delete a.parametric;delete b.parametric;
                    const arc=entity('ARC',{...fillet,id:this.extraId,layer:a.layer,layout:a.layout});delete arc.p;delete arc.q;draft.entities.push(arc);this.resultIds.push(arc.id);
                }else for(const e of selected){
                    if(this.operation==='move')moveEntity(e,v.dx,v.dy);
                    if(this.operation==='rotate'||this.operation==='scale'){
                        const m=compose(matrix({x:v.px,y:v.py,rotation:v.angle||0,sx:v.factor??1}),matrix({x:-v.px,y:-v.py}));transformEntity(e,m);
                        if(this.operation==='scale'&&e.parametric)for(const key of ['radius','length','width','height'])if(e.parametric[key]!==undefined)e.parametric[key]=`(${e.parametric[key]}) * ${v.factor}`;
                    }
                    if(this.operation==='offset'){
                        if(Math.abs(v.amount)<1e-8)throw new Error('Choose a nonzero offset');
                        if(e.r!==undefined){if(e.r+v.amount<=1e-8)throw new Error('Offset would collapse the circle');e.r+=v.amount;if(e.parametric?.radius!==undefined)e.parametric.radius=`(${e.parametric.radius}) + (${v.amount})`;}
                        else if(e.type==='LINE'){const n={x:-(e.b.y-e.a.y),y:e.b.x-e.a.x},l=Math.hypot(n.x,n.y);if(l<1e-8)throw new Error('Zero-length line');moveEntity(e,n.x*v.amount/l,n.y*v.amount/l);}
                        else {if(e.points.some((p,i)=>i>0&&distance(e.points[i-1],p)<1e-8))throw new Error('Duplicate offset vertices');e.points=offsetPolyline(e.points,v.amount,e.closed);if(e.closed)validateBoundary(e.points);delete e.parametric;}
                    }
                    e.dirty=true;
                }
            }
            for(const e of draft.entities)if(this.resultIds.includes(e.id)&&e.type==='INSERT'&&draft.blocks[e.block]?.entities.some(a=>a.type==='ATTDEF'))syncInsertAttributes(e,draft);
            this.process?.(draft,new Set(this.resultIds));
            for(const id of this.resultIds){const e=draft.entities.find(e=>e.id===id);if(e.type==='LINE'&&distance(e.a,e.b)<1e-8)throw new Error('The edited line would have zero length');}
            this.preview=draft;this.validatedRevision=this.revision;this.evaluations++;return draft;
        }catch(error){this.error=error.message;throw error;}
    }
    commit(document){this.assertOpen();if(document!==this.source||JSON.stringify(document)!==this.signature)throw new Error('The drawing changed during visual editing; restart this operation');const draft=this.evaluate();document.entities=clone(draft.entities);document.constraints=clone(draft.constraints);return this.resultIds.slice();}
    cancel(){this.closed=true;this.preview=null;this.base=null;this.source=null;this.process=null;this.undoStack=[];this.redoStack=[];}
}
