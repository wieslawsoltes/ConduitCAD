import { splitSections, splitRecords, writeAsciiTags } from './codec.js';
import { graphicalTags } from './interop.js';
const copy = v => JSON.parse(JSON.stringify(v));
const key = h => String(h??'').toUpperCase();
const get=(r,c,d)=>r.find(p=>p[0]===c)?.[1]??d;
const stable = value => {
    if(Array.isArray(value))return value.map(stable);
    if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,stable(value[k])]));
    return value;
};
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const cleanEntity=e=>Object.fromEntries(Object.entries(e).filter(([k])=>!['_dxf','dirty'].includes(k)));
const state=doc=>({units:doc.units,insunits:doc.insunits,parameters:doc.parameters,constraints:doc.constraints,metadata:doc.metadata,layers:doc.layers,blocks:doc.blocks,linetypes:doc.linetypes,linetypeScale:doc.linetypeScale,signedLinetypes:doc.signedLinetypes,textStyles:doc.textStyles,dimstyles:doc.dimstyles,layouts:doc.layouts,layoutSettings:doc.layoutSettings,rawSections:doc.rawSections,source:doc.source});
/** Capture an immutable-by-convention, serializable source database and semantic baseline.
 * The original input remains a separate exact-byte export path. */
export function capturePreservation(doc,pairs) {
    if(!pairs)throw new Error('Source tags required for DXF preservation');
    doc._dxfPreservation={pairs:copy(pairs),state:copy(state(doc)),entities:doc.entities.map(e=>({id:e.id,handle:e._dxf?.handle,raw:copy(e._dxf?.raw||[]),value:copy(cleanEntity(e))}))};
}
export function inspectDXFGraph(doc) {
    const source=doc._dxfPreservation?.pairs;
    if(!source)return {nodes:[],diagnostics:[]};
    const nodes=[],diagnostics=[],handles=new Set();
    for(const [section,pairs]of Object.entries(splitSections(source)))for(const tags of splitRecords(pairs)) {
        const type=get(tags,0);if(!type)continue;
        const identity=get(tags,type==='DIMSTYLE'?105:5);if(!identity)continue;
        const h=key(identity);
        if(!/^[0-9A-F]{1,16}$/.test(h))diagnostics.push({severity:'error',message:`Invalid handle ${h}`});
        if(handles.has(h))diagnostics.push({severity:'error',message:`Duplicate handle ${h}`});handles.add(h);
        const references=[];
        for(let i=0;i<tags.length;i++) {
            const [code,v]=tags[i];
            if((code>=320&&code<=369)||(code>=390&&code<=399)||code===480||code===481||code===1005)if(key(v)!=='0')references.push({code,target:key(v),index:i});
        }
        nodes.push({handle:h,type,section,references,tags:copy(tags)});
    }
    for(const node of nodes)for(const r of node.references)if(!handles.has(r.target))diagnostics.push({severity:'warning',code:r.code,message:`${node.handle} references missing handle ${r.target}`});
    return {nodes,diagnostics};
}
const EDITS = {
    LINE:{a:10,b:11},CIRCLE:{c:10,r:40},ARC:{c:10,r:40,start:50,end:51},
    POINT:{p:10},TEXT:{p:10,alignPoint:11,text:1,height:40,rotation:50,widthFactor:41,oblique:51},
    MTEXT:{p:10,height:40,mtextWidth:41}
};
/** Safe edits are deliberately a whitelist. Unknown dependency semantics never get guessed. */
export function writePreservedDXF(doc,{version=doc.importVersion}={}) {
    const saved=doc._dxfPreservation;
    if(!saved)throw new Error('This document has no preserved DXF source');
    if(version!==doc.importVersion)throw new Error('Record-preserving export requires the original DXF version');
    if(!same(state(doc),saved.state))throw new Error('Record-preserving export cannot merge changed tables, blocks, metadata, layouts or source sections');
    if(doc.entities.length!==saved.entities.length)throw new Error('Record-preserving export rejects added or deleted entities');
    const graph=inspectDXFGraph(doc);
    if(graph.diagnostics.some(d=>d.severity==='error'))throw new Error('Source object graph contains invalid or duplicate handles');
    const incoming=new Set(graph.nodes.flatMap(n=>n.references.map(r=>r.target)));
    const replacements=new Map();
    for(let i=0;i<doc.entities.length;i++) {
        const e=doc.entities[i],before=saved.entities[i],after=cleanEntity(e);
        if(e.id!==before.id||key(e._dxf?.handle)!==key(before.handle)||!same(e._dxf?.raw||[],before.raw))throw new Error('Record-preserving export rejects changed entity order, identity or raw records');
        if(same(after,before.value))continue;
        if(!before.handle || incoming.has(key(before.handle)))throw new Error('Entity has incoming references; dependency-sensitive edits require a native evaluator');
        if(before.raw.some(([c])=>c===102||c>=1000))throw new Error('Extended entity semantics make this edit unsafe to merge');
        const fields=EDITS[e.type];if(!fields)throw new Error(`Record-preserving edits are not implemented for ${e.type}`);
        const changed=[...new Set([...Object.keys(after),...Object.keys(before.value)])].filter(k=>!same(after[k],before.value[k]));
        if(changed.some(k=>!(k in fields)))throw new Error(`Unmapped record-preserving edit: ${changed.filter(k=>!(k in fields)).join(', ')}`);
        const raw=copy(before.raw), scope=graphicalTags(raw);
        const set=(code,v)=>{const positions=[];for(let j=0;j<raw.length;j++)if(raw[j][0]===code)positions.push(j);if(positions.length>1)throw new Error(`Ambiguous source field ${code}`);if(positions.length)raw[positions[0]]=[code,v];else {const last=raw.findIndex(p=>p[0]>=1000);raw.splice(last<0?raw.length:last,0,[code,v]);}};
        for(const name of changed) {
            const c=fields[name],value=after[name];
            if(value===undefined)throw new Error('Removing a native field is not a safe preserving edit');
            if(typeof value==='object') {
                if(!value||!Number.isFinite(value.x)||!Number.isFinite(value.y)||!Number.isFinite(value.z??0))throw new Error('Invalid preserved point');
                set(c,value.x);set(c+10,value.y);if(scope.some(p=>p[0]===c+20)||(value.z??0)!==0)set(c+20,value.z??0);
            } else {if(['r','height','widthFactor'].includes(name)&&!(value>0))throw new Error('Invalid preserved size');set(c,['start','end'].includes(name)?value*180/Math.PI:value);}
        }
        replacements.set(key(before.handle),raw);
    }
    const records=splitRecords(saved.pairs);
    const result=records.flatMap(r=>replacements.get(key(get(r,5)))||r);
    return writeAsciiTags(result,{version});
}
