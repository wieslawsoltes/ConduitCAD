import { splitSections, splitRecords, writeAsciiTags } from './codec.js';
import { DIMSTYLE_FIELDS } from './interop.js';
const get=(r,c,d)=>r.find(p=>p[0]===c)?.[1]??d;
const set=(r,c,v)=>{const i=r.findIndex(p=>p[0]===c);if(i<0)r.push([c,v]);else r[i]=[c,v];};
const handle=r=>String(get(r,get(r,0)==='DIMSTYLE'?105:5,'')).toUpperCase();
/** Normalize table ownership and the layout database, never guessing foreign handles. */
export function completeDXFStructure(pairs,doc,version,{includeMetadata=true}={}) {
    const sections=splitSections(pairs), tables=splitRecords(sections.TABLES||[]), entities=splitRecords(sections.ENTITIES||[]),blocks=splitRecords(sections.BLOCKS||[]);
    let seed=0x100n;
    for(const r of [...tables,...entities,...blocks])if(/^[\dA-F]+$/.test(handle(r)))seed=seed>BigInt('0x'+handle(r))?seed:BigInt('0x'+handle(r))+1n;
    const next=()=>{const h=seed.toString(16).toUpperCase();seed++;return h;};
    const tableMap=new Map();let current=null;
    for(const r of tables) {
        if(get(r,0)==='TABLE') {current={header:r,records:[]};tableMap.set(get(r,2),current);}
        else if(get(r,0)==='ENDTAB')current=null;
        else if(current)current.records.push(r);
    }
    function ensureTable(name) {
        if(!tableMap.has(name))tableMap.set(name,{header:[[0,'TABLE'],[2,name],[5,next()],[330,'0'],[100,'AcDbSymbolTable'],[70,0]],records:[]});
        return tableMap.get(name);
    }
    const styleTable=ensureTable('STYLE'),styles=new Map(styleTable.records.map(r=>[get(r,2),handle(r)]));
    for(const name of ['VPORT','VIEW','UCS','DIMSTYLE','APPID'])ensureTable(name);
    const dim=ensureTable('DIMSTYLE');
    set(dim.header,100,'AcDbSymbolTable');dim.header.push([100,'AcDbDimStyleTable'],[71,0]);
    for(const [name,style]of Object.entries({STANDARD:{},...doc.dimstyles})) {
        const r=[[0,'DIMSTYLE'],[105,next()],[330,handle(dim.header)],[100,'AcDbSymbolTableRecord'],[100,'AcDbDimStyleTableRecord'],[2,name],[70,0]];
        for(const [k,c]of Object.entries(DIMSTYLE_FIELDS))if(style[k]!==undefined)r.push([c,style[k]]);
        if(styles.get('STANDARD'))r.push([340,styles.get('STANDARD')]);
        dim.records.push(r);
    }
    const app=ensureTable('APPID');
    if(!app.records.some(r=>get(r,2)==='ACAD'))app.records.push([[0,'APPID'],[5,next()],[100,'AcDbSymbolTableRecord'],[100,'AcDbRegAppTableRecord'],[2,'ACAD'],[70,0]]);
    const layouts=[...new Set(['Model',...(doc.layouts||[]),...doc.entities.map(e=>e.layout||'Model')])];
    if(layouts.length===1)layouts.push('Layout1');
    const br=ensureTable('BLOCK_RECORD'), brMap=new Map(br.records.map(r=>[get(r,2),r]));
    const definitions=new Map();let block;
    for(const r of blocks) {
        if(get(r,0)==='BLOCK'){block={begin:r,entities:[],end:null};definitions.set(get(r,2),block);}
        else if(get(r,0)==='ENDBLK'){if(block)block.end=r;block=null;}
        else if(block)block.entities.push(r);
    }
    const layoutBlocks=new Map();let paper=0;
    for(const name of layouts) {
        const blockName=name==='Model'?'*Model_Space':paper++===0?'*Paper_Space':`*Paper_Space${paper-1}`;
        let record=brMap.get(blockName);
        if(!record){record=[[0,'BLOCK_RECORD'],[5,next()],[100,'AcDbSymbolTableRecord'],[100,'AcDbBlockTableRecord'],[2,blockName],[70,0],[280,1],[281,0]];br.records.push(record);brMap.set(blockName,record);}
        if(!definitions.has(blockName))definitions.set(blockName,{begin:[[0,'BLOCK'],[5,next()],[330,handle(record)],[100,'AcDbEntity'],[8,'0'],[100,'AcDbBlockBegin'],[2,blockName],[70,0],[10,0],[20,0],[30,0],[3,blockName],[1,'']],entities:[],end:[[0,'ENDBLK'],[5,next()],[330,handle(record)],[100,'AcDbEntity'],[8,'0'],[100,'AcDbBlockEnd']]});
        layoutBlocks.set(name,record);
    }
    // Only top-level records get layout owners; ATTRIB/VERTEX/SEQEND keep entity owners.
    let lastLayout='Model';
    const activePaper=layouts.find(l=>l!=='Model'), modelEntities=[];
    for(const r of entities) {
        const type=get(r,0),child=['VERTEX','ATTRIB','SEQEND'].includes(type);
        const name=child?lastLayout:get(r,410,get(r,67,0)?activePaper:'Model');
        if(!child){lastLayout=name;set(r,330,handle(layoutBlocks.get(name)||layoutBlocks.get('Model')));}
        if(name!=='Model'&&name!==activePaper)definitions.get(get(layoutBlocks.get(name),2)).entities.push(r);
        else modelEntities.push(r);
    }
    const root=next(),layoutDictionary=next(),groupDictionary=next();
    const rootRecord=[[0,'DICTIONARY'],[5,root],[330,'0'],[100,'AcDbDictionary'],[281,1],[3,'ACAD_LAYOUT'],[350,layoutDictionary],[3,'ACAD_GROUP'],[350,groupDictionary]];
    const layoutRecord=[[0,'DICTIONARY'],[5,layoutDictionary],[330,root],[100,'AcDbDictionary'],[281,1]],objects=[rootRecord,layoutRecord,[[0,'DICTIONARY'],[5,groupDictionary],[330,root],[100,'AcDbDictionary'],[281,1]]];
    for(let i=0;i<layouts.length;i++) {
        const name=layouts[i],h=next(),record=layoutBlocks.get(name),s=doc.layoutSettings?.[name]||{},w=s.paperWidth??420,height=s.paperHeight??297;
        layoutRecord.push([3,name],[350,h]);set(record,340,h);
        objects.push([[0,'LAYOUT'],[5,h],[330,layoutDictionary],[100,'AcDbPlotSettings'],[1,''],[2,''],[4,''],[6,''],[40,0],[41,0],[42,0],[43,0],[44,w],[45,height],[46,0],[47,0],[48,0],[49,0],[140,0],[141,0],[142,1],[143,1],[70,0],[72,s.paperUnits??1],[73,s.rotation??0],[74,5],[7,''],[75,16],[76,0],[77,0],[78,300],[147,1],[148,0],[149,0],[100,'AcDbLayout'],[1,name],[70,1],[71,i],[10,0],[20,0],[11,w],[21,height],[12,0],[22,0],[32,0],[14,0],[24,0],[34,0],[15,w],[25,height],[35,0],[146,0],[13,0],[23,0],[33,0],[16,1],[26,0],[36,0],[17,0],[27,1],[37,0],[76,0],[330,handle(record)]]);
    }
    if(includeMetadata) {
        const h=next(),value=JSON.stringify({parameters:doc.parameters,constraints:doc.constraints,metadata:doc.metadata}).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
        rootRecord.push([3,'CONDUITCAD_METADATA'],[350,h]);
        const r=[[0,'XRECORD'],[5,h],[330,root],[100,'AcDbXrecord'],[280,1]];
        for(let i=0;i<value.length;i+=200)r.push([1,value.slice(i,i+200)]);objects.push(r);
    }
    for(const t of tableMap.values()) {
        set(t.header,70,t.records.length);
        const h=handle(t.header);for(const r of t.records)set(r,330,h);
    }
    const header=sections.HEADER||[];
    const headerSet=(name,c,value)=>{const i=header.findIndex(p=>p[0]===9&&p[1]===name);if(i<0)header.push([9,name],[c,value]);else header[i+1]=[c,value];};
    headerSet('$HANDSEED',5,seed.toString(16).toUpperCase());headerSet('$DWGCODEPAGE',3,'ANSI_1252');headerSet('$CLAYER',8,'0');headerSet('$TILEMODE',70,1);
    const out=[];
    const section=(name,content)=>{out.push([0,'SECTION'],[2,name]);for(const p of content)out.push(p);out.push([0,'ENDSEC']);};
    section('HEADER',header);
    section('TABLES',[...tableMap.values()].flatMap(t=>[...t.header,...t.records.flat(),[0,'ENDTAB']]));
    section('BLOCKS',[...definitions.values()].flatMap(b=>[...b.begin,...b.entities.flat(),...(b.end||[])]));
    section('ENTITIES',modelEntities.flat());section('OBJECTS',objects.flat());out.push([0,'EOF']);
    return writeAsciiTags(out,{version});
}
