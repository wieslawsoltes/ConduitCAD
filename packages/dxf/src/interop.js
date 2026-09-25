import { splitRecords, decodeTextEscapes } from './codec.js';
const get = (r,c,d=undefined) => decodeTextEscapes(r.find(p=>p[0]===c)?.[1] ?? d);
const all = (r,c) => r.filter(p=>p[0]===c).map(p=>p[1]);
const point = (r,c=10) => ({x:+get(r,c,0),y:+get(r,c+10,0),z:+get(r,c+20,0)});
const has = (r,c) => r.some(p=>p[0]===c);
const key = v => String(v ?? '').toUpperCase();
export function subclassTags(raw,name) {
    const i=raw.findIndex(p=>p[0]===100 && p[1]===name);
    if(i<0) return [];
    let end=i+1;
    while(end<raw.length && raw[end][0]!==100 && raw[end][0]<1000) end++;
    return raw.slice(i+1,end);
}
/** Reactor/extension and XDATA fields do not share the entity field namespace. */
export function graphicalTags(raw) {
    const result=[]; let depth=0;
    for(const [c,v] of raw) {
        if(c>=1000) break;
        if(c===102) {
            if(String(v).startsWith('{')) depth++;
            else if(v==='}') { if(!depth) throw new Error('Unmatched extension-data closing brace'); depth--; }
            else if(!depth) result.push([c,v]);
        } else if(!depth) result.push([c,v]);
    }
    if(depth) throw new Error('Unclosed extension-data group');
    return result;
}
export const DIMSTYLE_FIELDS = {dimscale:40,dimasz:41,dimexo:42,dimdli:43,dimexe:44,dimrnd:45,dimdle:46,dimtp:47,dimtm:48,dimtxt:140,dimcen:141,dimtsz:142,dimaltf:143,dimlfac:144,dimtvp:145,dimtfac:146,dimgap:147,dimpost:3,dimapost:4,dimtad:77,dimzin:78,dimdec:271,dimtdec:272,dimaltu:273,dimlunit:277,dimdsep:278,dimclrd:176,dimclre:177,dimclrt:178};
const DIM_POINTS = {definitionPoint:10,textMidpoint:11,dimensionInsert:12,a:13,b:14,defpoint4:15,defpoint5:16};
const DIM_SCALARS = {dimensionAngle:50,obliqueAngle:52,textRotation:53,horizontalDirection:51,leaderLength:40,measurement:42,attachment:71,dimensionVersion:280};
const points = (r,c=10) => {
    const result=[]; let p;
    for(const [code,v] of r) {
        if(code===c) { p={x:+v,y:0,z:0}; result.push(p); }
        else if(p && code===c+10) p.y=+v;
        else if(p && code===c+20) p.z=+v;
    }
    return result;
};
const count = n => {
    if(!Number.isSafeInteger(n) || n<0 || n>1000000) throw new Error('Invalid DXF collection count');
    return n;
};
function readSpline(r) {
    return {degree:+get(r,71,3),splineFlags:+get(r,70,0),knots:all(r,40).map(Number),weights:all(r,41).map(Number),controlPoints:points(r),fitPoints:points(r,11)};
}
export function readInteropEntity(e,r) {
    if(e.type==='DIMENSION') {
        e.dimtype=+get(r,70,0); e.dimstyle=get(r,3,'STANDARD');
        for(const [k,c] of Object.entries(DIM_POINTS)) if(has(r,c)) e[k]=point(r,c);
        for(const [k,c] of Object.entries(DIM_SCALARS)) if(has(r,c)) e[k]=+get(r,c);
    } else if(e.type==='VIEWPORT') {
        const sub=subclassTags(r,'AcDbViewport'), v=sub.length?sub:r;
        Object.assign(e,{c:point(v),viewportWidth:+get(v,40,1),viewportHeight:+get(v,41,1),viewHeight:+get(v,45,1),viewportId:+get(v,69,2),viewportStatus:+get(v,68,1),viewCenter:point(v,12),viewTarget:point(v,17),viewDirection:has(v,16)?point(v,16):{x:0,y:0,z:1},viewTwist:+get(v,51,0),viewportFlags:+get(v,90,0),frozenLayerHandles:all(v,331).map(String),clipHandle:get(v,340)});
        if(e.viewportWidth<0 || e.viewportHeight<0 || e.viewHeight<=0) throw new Error('Invalid VIEWPORT dimensions');
    } else if(e.type==='MESH') {
        const v=subclassTags(r,'AcDbSubDMesh'); let i=0;
        const read=c=>{if(v[i]?.[0]!==c) throw new Error(`Malformed MESH: expected group ${c}`);return v[i++][1];};
        e.meshVersion=+read(71); e.blendCrease=+read(72); e.subdivision=+read(91);
        const n=count(+read(92)); e.points=[];
        for(let k=0;k<n;k++) e.points.push({x:+read(10),y:+read(20),z:+read(30)});
        const size=count(+read(93)); let used=0; e.faces=[];
        const index=()=>{const x=+read(90);if(!Number.isSafeInteger(x)||x<0||x>=n) throw new Error('Invalid MESH vertex index');return x;};
        while(used<size) {
            const length=count(+read(90)); used++;
            if(length<3 || used+length>size) throw new Error('Invalid MESH face size');
            const face=[];for(let k=0;k<length;k++) face.push(index());
            used+=length; e.faces.push(face);
        }
        const ne=count(+read(94)); e.edges=[];
        for(let k=0;k<ne;k++) e.edges.push([index(),index()]);
        const nc=count(+read(95)); e.creases=[];
        for(let k=0;k<nc;k++) e.creases.push(+read(140));
        if(nc!==ne) throw new Error('MESH crease/edge count mismatch');
        e.meshOverrides=v.slice(i);
    } else if(e.type==='HELIX') {
        e.helixSpline=readSpline(subclassTags(r,'AcDbSpline'));
        const v=subclassTags(r,'AcDbHelix');
        Object.assign(e,{helixMajor:+get(v,90,29),helixMinor:+get(v,91,63),axisBase:point(v),startPoint:point(v,11),axis:point(v,12),radius:+get(v,40,1),turns:+get(v,41,1),turnHeight:+get(v,42,1),handedness:!!get(v,290,1),helixConstraint:+get(v,280,1)});
    } else if(e.type==='WIPEOUT') {
        const v=subclassTags(r,'AcDbWipeout');
        Object.assign(e,{p:point(v),uPixel:point(v,11),vPixel:point(v,12),imageSize:point(v,13),boundary:points(v,14),boundaryType:+get(v,71,2),imageFlags:+get(v,70,7),clipping:!!get(v,280,1)});
        if(e.boundary.length!==count(+get(v,91,e.boundary.length))) throw new Error('WIPEOUT boundary count mismatch');
        if(e.boundaryType===1 && e.boundary.length!==2) throw new Error('WIPEOUT rectangle requires two corners');
        if(e.boundaryType===2 && e.boundary.length<3) throw new Error('WIPEOUT polygon requires at least three points');
    }
}
export function writeInteropEntity(e,pair,pp) {
    if(e.type==='DIMENSION') {
        const type=(e.dimtype??33)&15;
        if(type>6) throw new Error(`Unsupported DIMENSION subtype ${type}`);
        pair(100,'AcDbDimension');pair(2,e.block);pp(10,e.definitionPoint || e.a);pp(11,e.textMidpoint || e.definitionPoint || e.a);
        pair(70,(e.dimtype??33)|32);pair(1,e.text??'<>');pair(3,e.dimstyle||'STANDARD');
        for(const [k,c] of Object.entries(DIM_SCALARS)) if(e[k]!==undefined && ![50,52,40].includes(c)) pair(c,e[k]);
        if(e.dimensionInsert)pp(12,e.dimensionInsert);
        const names=['AcDbAlignedDimension','AcDbAlignedDimension','AcDb2LineAngularDimension','AcDbDiametricDimension','AcDbRadialDimension','AcDb3PointAngularDimension','AcDbOrdinateDimension'];
        pair(100,names[type]);
        if([0,1,2,5,6].includes(type)) {if(e.a)pp(13,e.a);if(e.b)pp(14,e.b);}
        if([2,3,4,5].includes(type)&&e.defpoint4)pp(15,e.defpoint4);
        if(type===2&&e.defpoint5)pp(16,e.defpoint5);
        if([0,1].includes(type)&&e.obliqueAngle!==undefined)pair(52,e.obliqueAngle);
        if(type===0){pair(50,e.dimensionAngle||0);pair(100,'AcDbRotatedDimension');}
        if([3,4].includes(type))pair(40,e.leaderLength||0);
    } else if(e.type==='VIEWPORT') {
        pair(100,'AcDbViewport');pp(10,e.c);pair(40,e.viewportWidth);pair(41,e.viewportHeight);pair(68,e.viewportStatus??1);pair(69,e.viewportId??2);
        pair(12,e.viewCenter?.x||0);pair(22,e.viewCenter?.y||0);pp(16,e.viewDirection||{x:0,y:0,z:1});pp(17,e.viewTarget);
        pair(45,e.viewHeight);pair(51,e.viewTwist||0);pair(90,e.viewportFlags||0);
        for(const h of e.frozenLayerHandles||[])pair(331,h);
        if(e.clipHandle)pair(340,e.clipHandle);
        pair(281,0);
    } else if(e.type==='MESH') {
        pair(100,'AcDbSubDMesh');pair(71,e.meshVersion??2);pair(72,e.blendCrease??0);pair(91,e.subdivision??0);pair(92,count(e.points.length));
        for(const p of e.points)pp(10,p);
        pair(93,(e.faces||[]).reduce((n,f)=>n+1+f.length,0));
        const index=x=>{if(!Number.isSafeInteger(x)||x<0||x>=e.points.length)throw new Error('Invalid MESH vertex index');pair(90,x);};
        for(const f of e.faces||[]){if(f.length<3)throw new Error('Invalid MESH face');pair(90,count(f.length));for(const x of f)index(x);}
        pair(94,count(e.edges?.length||0));for(const edge of e.edges||[]){if(edge.length!==2)throw new Error('Invalid MESH edge');for(const x of edge)index(x);}
        const creases=e.creases||new Array(e.edges?.length||0).fill(0);
        if(creases.length!==(e.edges?.length||0))throw new Error('MESH crease/edge count mismatch');
        pair(95,count(creases.length));for(const c of creases)pair(140,c);
        for(const [c,v] of e.meshOverrides||[[90,0]])pair(c,v);
    } else if(e.type==='HELIX') {
        const s=e.helixSpline||{};pair(100,'AcDbSpline');pair(70,s.splineFlags||0);pair(71,s.degree||3);
        pair(72,s.knots?.length||0);pair(73,s.controlPoints?.length||0);pair(74,s.fitPoints?.length||0);
        for(const v of s.knots||[])pair(40,v);for(const v of s.weights||[])pair(41,v);
        for(const p of s.controlPoints||[])pp(10,p);for(const p of s.fitPoints||[])pp(11,p);
        pair(100,'AcDbHelix');pair(90,e.helixMajor??29);pair(91,e.helixMinor??63);pp(10,e.axisBase);pp(11,e.startPoint);pp(12,e.axis||{x:0,y:0,z:1});
        pair(40,e.radius);pair(41,e.turns);pair(42,e.turnHeight);pair(290,e.handedness===false?0:1);pair(280,e.helixConstraint??1);
    } else if(e.type==='WIPEOUT') {
        pair(100,'AcDbWipeout');pair(90,0);pp(10,e.p);pp(11,e.uPixel);pp(12,e.vPixel);pair(13,e.imageSize?.x||1);pair(23,e.imageSize?.y||1);
        pair(70,e.imageFlags??7);pair(280,e.clipping===false?0:1);pair(281,50);pair(282,50);pair(283,0);pair(71,e.boundaryType??2);pair(91,e.boundary.length);
        for(const p of e.boundary){pair(14,p.x);pair(24,p.y);}
    } else return false;
    return true;
}
export function readDocumentInterop(doc,sections) {
    const tableRecords=splitRecords(sections.TABLES||[]), objects=splitRecords(sections.OBJECTS||[]);
    doc.dimstyles=Object.create(null);doc.layoutSettings=Object.create(null);
    const blockNames=new Map(), layerNames=new Map(), layoutByOwner=new Map();
    for(const r of tableRecords) {
        const type=get(r,0), handle=key(get(r,type==='DIMSTYLE'?105:5));
        if(type==='BLOCK_RECORD')blockNames.set(handle,get(r,2));
        if(type==='LAYER')layerNames.set(handle,get(r,2));
        if(type==='DIMSTYLE') {
            const s={};for(const [k,c] of Object.entries(DIMSTYLE_FIELDS))if(has(r,c))s[k]=get(r,c);
            doc.dimstyles[get(r,2,'STANDARD')]=s;
        }
    }
    for(const raw of objects) {
        if(get(raw,0)!=='LAYOUT')continue;
        const l=subclassTags(raw,'AcDbLayout'),p=subclassTags(raw,'AcDbPlotSettings'),name=get(l,1,'Layout1');
        doc.layoutSettings[name]={tabOrder:+get(l,71,0),paperWidth:+get(p,44,420),paperHeight:+get(p,45,297),paperUnits:+get(p,72,1),rotation:+get(p,73,0)};
        layoutByOwner.set(key(get(l,330)),name);
    }
    // Inactive paper layouts are stored inside special BLOCKs, not ENTITIES.
    for(const [owner,name] of layoutByOwner) {
        const blockName=blockNames.get(owner), b=doc.blocks[blockName];
        if(b && /^\*(Model|Paper)_Space/i.test(blockName)) {
            for(const e of b.entities||[]){e.layout=name;doc.entities.push(e);}
            delete doc.blocks[blockName];
        }
    }
    for(const [name,b] of Object.entries(doc.blocks))if(/^\*(Model|Paper)_Space(?:\d+)?$/i.test(name)) {
        const layout=/Model/i.test(name)?'Model':'Layout1';
        for(const e of b.entities||[]){e.layout=layout;doc.entities.push(e);}delete doc.blocks[name];
    }
    for(const e of doc.entities) {
        const owner=get(graphicalTags(e._dxf?.raw||[]),330);
        if(layoutByOwner.has(key(owner)))e.layout=layoutByOwner.get(key(owner));
        if(e.type==='VIEWPORT') {
            e.frozenLayers=(e.frozenLayerHandles||[]).map(h=>layerNames.get(key(h))).filter(Boolean);
            const d=e.viewDirection;
            if((e.viewportFlags&7)||Math.abs(d?.x||0)>1e-9||Math.abs(d?.y||0)>1e-9||(d?.z??1)<=0)doc.importDiagnostics.push({severity:'warning',type:'VIEWPORT',message:'Perspective, tilted and depth-clipped viewport contents are not rendered; native fields remain available.'});
        }
    }
    doc.layouts=[...new Set(['Model',...Object.keys(doc.layoutSettings),...doc.entities.map(e=>e.layout||'Model')])].sort((a,b)=>a==='Model'?-1:b==='Model'?1:(doc.layoutSettings[a]?.tabOrder||0)-(doc.layoutSettings[b]?.tabOrder||0));
    let variable='';for(const [c,v]of sections.HEADER||[]){if(c===9)variable=v;else if(variable==='$INSUNITS'&&c===70)doc.insunits=v;}
    // Application metadata is an XRECORD, so binary DXF need not depend on 999 comments.
    const root=objects.find(r=>get(r,0)==='DICTIONARY' && key(get(graphicalTags(r),330,'0'))==='0');
    const entry=root?.findIndex(p=>p[0]===3&&p[1]==='CONDUITCAD_METADATA');
    if(entry>=0) {
        const h=root[entry+1]?.[1],rec=objects.find(r=>key(get(r,5))===key(h)&&get(r,0)==='XRECORD');
        if(rec)try{const value=JSON.parse(all(subclassTags(rec,'AcDbXrecord'),1).join(''));for(const k of ['parameters','constraints','metadata'])if(value[k]!==undefined)doc[k]=value[k];}catch{doc.importDiagnostics.push({severity:'warning',message:'Invalid Conduit XRECORD metadata.'});}
    }
}

/** ACAD/DSTYLE data uses dimvar IDs followed by correctly typed XDATA values. */
export function readDimensionOverrides(raw) {
    const names=new Map(Object.entries(DIMSTYLE_FIELDS).map(([k,c])=>[c,k]));
    const result={};let app='',active=false;
    for(let i=0;i<raw.length;i++) {
        const [c,v]=raw[i];
        if(c===1001){app=v;active=false;}
        if(app!=='ACAD')continue;
        if(c===1000&&v==='DSTYLE'&&raw[i+1]?.[0]===1002&&raw[i+1][1]==='{'){active=true;i++;continue;}
        if(active&&c===1002&&v==='}'){active=false;continue;}
        if(active&&c===1070&&raw[i+1]) {
            const [type,value]=raw[++i],name=names.get(v);
            if(name&&type===(v===3||v===4?1000:v>=40&&v<=48||v>=140&&v<=148?1040:1070))result[name]=value;
        }
    }
    return result;
}
export function writeDimensionOverrides(style,pair) {
    const entries=Object.entries(style||{}).filter(([k])=>DIMSTYLE_FIELDS[k]!==undefined);
    if(!entries.length)return;
    pair(1001,'ACAD');pair(1000,'DSTYLE');pair(1002,'{');
    for(const [name,value]of entries) {
        const code=DIMSTYLE_FIELDS[name],type=code===3||code===4?1000:code>=40&&code<=48||code>=140&&code<=148?1040:1070;
        if(type!==1000&&(!Number.isFinite(value)||type===1070&&!Number.isInteger(value)))throw new Error('Invalid dimension override '+name);
        pair(1070,code);pair(type,value);
    }
    pair(1002,'}');
}
