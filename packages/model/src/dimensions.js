import { arcPoints, distance, matrix, transform, TAU } from '@conduitcad/geometry';

const EPS = 1e-9;
const copy = v => JSON.parse(JSON.stringify(v));
const add = (a,b) => ({x:a.x+b.x,y:a.y+b.y});
const sub = (a,b) => ({x:a.x-b.x,y:a.y-b.y});
const mul = (a,s) => ({x:a.x*s,y:a.y*s});
const normal = a => ({x:-a.y,y:a.x});
const dot = (a,b) => a.x*b.x+a.y*b.y;
const unit = a => { const l=Math.hypot(a.x,a.y); if(l<EPS)throw new Error('Coincident dimension definition points'); return mul(a,1/l); };
const finite = (v,label) => { if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e12)throw new Error(`Invalid dimension ${label}`); return v; };
const point = (p,label) => { if(!p)throw new Error(`Missing dimension ${label}`); finite(p.x,label);finite(p.y,label);if(Math.abs(p.z||0)>EPS)throw new Error('Dimension regeneration currently requires the XY plane at Z=0');return {x:p.x,y:p.y}; };
const angle = (a,b) => Math.atan2(b.y-a.y,b.x-a.x);
const positiveAngle = x => (x%TAU+TAU)%TAU;
const STYLE_KEYS = new Set(['dimtxt','dimasz','dimexe','dimexo','dimgap','dimscale','dimlfac','dimdec','dimrnd','dimpost','dimzin','dimdsep']);
const POINT_KEYS = ['a','b','definitionPoint','defpoint4','defpoint5','textMidpoint'];

/** Declarative dimension picture generator. It never mutates the document. */
export function dimensionPicture(e,doc={}) {
    if(e.type!=='DIMENSION')throw new Error('Expected DIMENSION');
    const n=e.extrusion||{x:0,y:0,z:1};
    if(Math.abs(n.x||0)>EPS||Math.abs(n.y||0)>EPS||Math.abs((n.z??1)-1)>EPS)throw new Error('Non-default dimension OCS cannot be regenerated in the planar editor');
    if(e.dimensionInsert && Math.hypot(e.dimensionInsert.x||0,e.dimensionInsert.y||0,e.dimensionInsert.z||0)>EPS)throw new Error('Translated dimension pictures require conversion before regeneration');
    if(e.obliqueAngle || e.horizontalDirection)throw new Error('Oblique or rotated-UCS dimension regeneration is not supported');
    finite(e.dimtype??33,'subtype');if(!Number.isInteger(e.dimtype??33))throw new Error('Dimension subtype must be an integer');
    finite(e.dimensionAngle??0,'angle');
    const type=(e.dimtype??33)&15;
    if(type>6)throw new Error('Unknown dimension subtype');
    const style={dimtxt:e.height||12,dimasz:5,dimexe:5,dimexo:1,dimgap:3,dimscale:1,dimlfac:1,dimdec:1,dimrnd:0,dimpost:'<>',dimzin:0,...doc.dimstyles?.[e.dimstyle||'STANDARD'],...e.dimstyleOverrides,...e.dimension?.style};
    for(const k of ['dimtxt','dimasz','dimexe','dimexo','dimgap','dimscale','dimlfac','dimrnd']) {
        finite(style[k],k); if(style[k]<0)throw new Error(`Dimension ${k} cannot be negative`);
    }
    if(style.dimtxt<=0||style.dimscale<=0||style.dimlfac<=0)throw new Error('Dimension text, scale and measurement factor must be positive');
    if(!Number.isInteger(style.dimdec)||style.dimdec<0||style.dimdec>8)throw new Error('Dimension precision must be an integer from 0 to 8');
    if(typeof style.dimpost!=='string'||style.dimpost.length>1000||!Number.isInteger(style.dimzin)||style.dimzin<0||style.dimzin>15)throw new Error('Invalid dimension text formatting');
    if(style.dimdsep!==undefined&&(!Number.isInteger(style.dimdsep)||style.dimdsep<1||style.dimdsep>255))throw new Error('Invalid dimension decimal separator');
    if(e.text!==undefined&&(typeof e.text!=='string'||e.text.length>1000))throw new Error('Invalid dimension text');
    const scale=style.dimscale,h=style.dimtxt*scale,arrow=style.dimasz*scale,gap=style.dimgap*scale;
    const entities=[];let measurement,definitionPoint=e.definitionPoint,textMidpoint,textRotation=0;
    const put=(type,props) => entities.push({id:`${e.id||'dimension'}:picture:${entities.length}`,type,layer:'0',color:'BYBLOCK',linetype:'CONTINUOUS',...props});
    const line=(a,b) => {if(distance(a,b)>EPS)put('LINE',{a,b});};
    const head=(tip,inside) => {if(!arrow)return;const u=unit(inside),n=normal(u);put('SOLID',{points:[tip,add(tip,add(mul(u,arrow),mul(n,arrow*.28))),add(tip,add(mul(u,arrow),mul(n,-arrow*.28)))]});};
    const extension=(origin,end,outward) => {if(distance(origin,end)>EPS)line(add(origin,mul(outward,style.dimexo*scale)),add(end,mul(outward,style.dimexe*scale)));};
    if(type===0||type===1) {
        const a=point(e.a,'first endpoint'),b=point(e.b,'second endpoint');
        const u=type===0?{x:Math.cos((e.dimensionAngle||0)*Math.PI/180),y:Math.sin((e.dimensionAngle||0)*Math.PI/180)}:unit(sub(b,a)),n=normal(u);
        const off=e.offset!==undefined?finite(e.offset,'offset'):e.definitionPoint?dot(sub(point(e.definitionPoint,'dimension line'),a),n):30;
        const p=add(a,mul(n,off)),q=add(p,mul(u,dot(sub(b,a),u)));
        measurement=Math.abs(dot(sub(b,a),u));if(measurement<EPS)throw new Error('Zero projected dimension length');
        const side=mul(n,off<0?-1:1);extension(a,p,side);extension(b,q,mul(n,dot(sub(q,b),n)<0?-1:1));
        line(p,q);const inside=unit(sub(q,p));head(p,inside);head(q,mul(inside,-1));
        textMidpoint=add(mul(add(p,q),.5),mul(side,gap+h*.5));textRotation=Math.atan2(u.y,u.x)*180/Math.PI;
        if(textRotation>90||textRotation<=-90)textRotation+=180;
        definitionPoint=q;
    } else if(type===3||type===4) {
        const a=point(e.definitionPoint,'radial origin'),b=point(e.defpoint4,'radial endpoint'),u=unit(sub(b,a));
        measurement=distance(a,b);line(a,b);head(b,mul(u,-1));if(type===3)head(a,u);
        const lead=Math.max(0,finite(e.leaderLength??0,'leader length'));
        if(lead>0)line(b,add(b,mul(u,lead)));
        textMidpoint=add(type===3?mul(add(a,b),.5):add(b,mul(u,lead)),mul(normal(u),gap+h*.5));
    } else if(type===2||type===5) {
        let center,a,b,location;
        if(type===5){center=point(e.defpoint4,'angle center');a=point(e.a,'first ray');b=point(e.b,'second ray');location=point(e.definitionPoint,'angle location');}
        else {
            const p=point(e.a,'line 1 start'),q=point(e.b,'line 1 end'),r=point(e.defpoint4,'line 2 start'),s=point(e.definitionPoint,'line 2 end');
            const u=sub(q,p),v=sub(s,r),det=u.x*v.y-u.y*v.x;
            if(Math.abs(det)<EPS)throw new Error('Parallel angular dimension lines');
            const w=sub(r,p),f=(w.x*v.y-w.y*v.x)/det;center=add(p,mul(u,f));
            a=distance(center,q)>EPS?q:p;b=distance(center,s)>EPS?s:r;location=point(e.defpoint5,'angle location');
        }
        let start=angle(center,a),end=angle(center,b),sweep=positiveAngle(end-start),loc=positiveAngle(angle(center,location)-start);
        if(loc>sweep+EPS){[a,b]=[b,a];[start,end]=[end,start];sweep=positiveAngle(end-start);}
        if(sweep<EPS)throw new Error('Zero angular dimension');
        const radius=distance(center,location);if(radius<EPS)throw new Error('Angular dimension arc must have a positive radius');
        const p=add(center,{x:Math.cos(start)*radius,y:Math.sin(start)*radius}),q=add(center,{x:Math.cos(start+sweep)*radius,y:Math.sin(start+sweep)*radius});
        extension(a,p,unit(sub(p,center)));extension(b,q,unit(sub(q,center)));
        put('ARC',{c:center,r:radius,start,end:start+sweep});head(p,{x:-Math.sin(start),y:Math.cos(start)});head(q,{x:Math.sin(end),y:-Math.cos(end)});
        const mid=start+sweep/2;textMidpoint=add(center,{x:Math.cos(mid)*(radius+gap+h*.5),y:Math.sin(mid)*(radius+gap+h*.5)});measurement=sweep*180/Math.PI;
    } else {
        const origin=point(e.definitionPoint,'ordinate origin'),a=point(e.a,'ordinate feature'),b=point(e.b,'ordinate leader'),x=!!((e.dimtype||0)&64);
        measurement=x?a.x-origin.x:a.y-origin.y;
        const elbow=x?{x:a.x,y:b.y}:{x:b.x,y:a.y};line(a,elbow);line(elbow,b);textMidpoint=add(b,{x:gap+h*.5,y:gap+h*.5});
    }
    let value=measurement*([2,5].includes(type)?1:style.dimlfac);
    if(style.dimrnd>0)value=Math.round(value/style.dimrnd)*style.dimrnd;
    let content=value.toFixed(style.dimdec);if(style.dimzin&8)content=content.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
    if(style.dimzin&4)content=content.replace(/^(-?)0\./,'$1.');
    if(style.dimdsep)content=content.replace('.',String.fromCharCode(style.dimdsep));
    content=(type===3?'⌀':type===4?'R':'')+content+([2,5].includes(type)?'°':'');
    content=String(style.dimpost||'<>').replace(/<>/g,content);
    if(e.text && e.text!=='<>')content=String(e.text).replace(/<>/g,content);
    if(e.dimension?.manualText && e.textMidpoint)textMidpoint=point(e.textMidpoint,'text midpoint');
    textRotation=e.textRotation??textRotation;
    finite(textRotation,'text rotation');
    if(e.text!==' ')put('TEXT',{p:textMidpoint,text:content,height:h,rotation:textRotation,align:'center',halign:1,valign:2,alignPoint:textMidpoint});
    finite(measurement,'measurement');point(textMidpoint,'generated text midpoint');
    for(const entity of entities)for(const p of [entity.a,entity.b,entity.p,entity.c,...entity.points||[]])if(p)point(p,'generated coordinate');
    return {entities,measurement,definitionPoint,textMidpoint,style};
}

/** Atomic opt-in adoption or edit. Imported pictures are left untouched until this succeeds. */
export function editDimension(e,doc,patch={}) {
    if(e.dimension&&e.dimension.version!==1)throw new Error('Unsupported Conduit dimension schema');
    const next=copy(e);next.dimension={version:1,manualText:!!((next.dimtype||0)&128),...next.dimension};
    for(const [key,value] of Object.entries(patch)) {
        if(key==='style') {
            if(!value||typeof value!=='object')throw new Error('Invalid dimension style');
            for(const k of Object.keys(value))if(!STYLE_KEYS.has(k))throw new Error(`Unsupported dimension style field: ${k}`);
            next.dimension.style={...next.dimension.style,...value};
        } else if(POINT_KEYS.includes(key))next[key]=point(value,key);
        else if(['offset','text','textRotation','dimensionAngle','leaderLength','dimstyle','dimtype'].includes(key))next[key]=value;
        else if(key==='manualText')next.dimension.manualText=!!value;
        else throw new Error(`Unsupported dimension edit: ${key}`);
    }
    for(const key of POINT_KEYS)if(key in patch && next.dimension.references)delete next.dimension.references[key];
    // A moved dimension line supersedes its authored signed offset.
    if('definitionPoint' in patch && !('offset' in patch))delete next.offset;
    if('textMidpoint' in patch)next.dimension.manualText=true;
    const picture=dimensionPicture(next,doc);
    next.dimension.resolvedScale=picture.style.dimscale;
    next.definitionPoint=picture.definitionPoint;next.textMidpoint=picture.textMidpoint;next.measurement=picture.measurement;
    next.dimtype=(next.dimtype??33)|32;
    if(next.dimension.manualText)next.dimtype|=128;else next.dimtype&=~128;
    delete next.block;next.dirty=true;for(const key of Object.keys(e))if(!(key in next))delete e[key];Object.assign(e,next);
    return e;
}
export function dimensionGrips(e,doc) {
    if(e.type!=='DIMENSION'||e.dimension?.version!==1)return [];
    const picture=dimensionPicture(e,doc),type=(e.dimtype??33)&15;
    const keys=type===0||type===1?['a','b','definitionPoint']:type===3||type===4?['definitionPoint','defpoint4']:type===2?['a','b','definitionPoint','defpoint4','defpoint5']:['a','b','definitionPoint',...(type===5?['defpoint4']:[])];
    return [...keys.filter(k=>e[k]).map(k=>({...e[k],key:'dim:'+k})),{...picture.textMidpoint,key:'dim:textMidpoint'}];
}
/** Refresh authored point associations without mutating anything on failure. */
export function regenerateDimensions(doc) {
    const map=new Map(doc.entities.map(e=>[e.id,e])),changes=[];
    for(const e of doc.entities) {
        if(e.type!=='DIMENSION'||e.dimension?.version!==1)continue;
        const refs=e.dimension.references;if(!refs)continue;
        const next=copy(e);
        for(const [key,ref]of Object.entries(refs)) {
            if(!POINT_KEYS.includes(key))throw new Error('Invalid dimension reference slot');
            const source=map.get(ref.entityId);
            if(!source||source.type==='DIMENSION')throw new Error('Missing or cyclic dimension reference');
            const p=ref.point==='circle'&&['CIRCLE','ARC'].includes(source.type)?{x:source.c.x+source.r*Math.cos(ref.angle||0),y:source.c.y+source.r*Math.sin(ref.angle||0),z:source.c.z||0}:ref.point==='vertex'?source.points?.[ref.index]:['a','b','c','p'].includes(ref.point)?source[ref.point]:null;
            next[key]=point(p,'associated point');
        }
        editDimension(next,doc);if(JSON.stringify(next)!==JSON.stringify(e))changes.push([e,next]);
    }
    for(const [e,next]of changes){Object.assign(e,next);delete e.block;}
    return changes.map(([e])=>e.id);
}
