import { clone, isLocked, moveEntity, editDimension, dimensionPicture, dynamicValues, setDynamicParameters } from '@conduitcad/model';
import { distance, TAU } from '@conduitcad/geometry';
import { evaluateExpression } from '@conduitcad/constraints';
import { validateBoundary } from '@conduitcad/drawing';
const DEG = Math.PI / 180;
export const PLANAR_TYPES = Object.freeze(['LINE','CIRCLE','ARC','ELLIPSE','LWPOLYLINE','POLYLINE','SPLINE','POINT','RAY','XLINE','TEXT','MTEXT','ATTDEF','ATTRIB','LEADER','SOLID','TRACE','3DFACE','HATCH','DIMENSION','INSERT']);
export function planarEditable(e, doc) {
    if (!e || !PLANAR_TYPES.includes(e.type)) return 'This entity needs a specialized editor';
    if (isLocked(e, doc)) return 'The entity or layer is locked';
    if (e.feature3d || e.model3dConsumed) return 'Edit this feature in 3D, or explicitly detach its history first';
    const n=e.extrusion;
    if(n && (Math.abs(n.x||0)>1e-10||Math.abs(n.y||0)>1e-10||Math.abs((n.z??1)-1)>1e-10)) return 'Use 3D editing for non-default OCS geometry';
    if (Math.abs(e.elevation||0)>1e-10 || ['a','b','c','p','major','definitionPoint','defpoint4','defpoint5','textMidpoint'].some(k=>Math.abs(e[k]?.z||0)>1e-10) || ['points','controlPoints','fitPoints'].some(k=>e[k]?.some(p=>Math.abs(p.z||0)>1e-10))) return 'Use 3D editing for geometry outside XY at Z=0';
    if (e.type==='POLYLINE' && (e.flags & (16|64))) return 'Use the 3D mesh editor';
    if (e.type==='DIMENSION' && e.dimension?.version!==1) return 'Enable managed dimension editing explicitly before visual regeneration';
    if(e.type==='INSERT'&&Math.abs(e.z||0)>1e-10)return 'Use 3D editing for elevated blocks';
    if(e.type==='HATCH'&&e.loops?.some(l=>l.points?.some(p=>Math.abs(p.z||0)>1e-10)))return 'Use 3D editing for non-planar boundaries';
    if (e.type==='HATCH' && (e.associative || e.loops?.some(l=>l.edges?.length))) return 'Only non-associative polygon hatch boundaries have planar handles';
    if (e.type==='INSERT' && !doc.blocks[e.block]) return 'The block definition is missing';
    return null;
}
export function anchor2(e) { return e.type==='INSERT'?{x:e.x,y:e.y}:e.a||e.c||e.p||e.points?.[0]||e.controlPoints?.[0]||e.definitionPoint||e.loops?.[0]?.points?.[0]||{x:0,y:0}; }
const f=(name,label,value,extra={})=>({name,label,value,...extra});
export function fields2(e,doc) {
    const fields=[],a=anchor2(e),numeric=(key,label,value,extra)=>fields.push(f(key,label,value,extra));
    if(!['DIMENSION','HATCH','SPLINE','LWPOLYLINE','POLYLINE','LEADER','SOLID','TRACE','3DFACE'].includes(e.type))fields.push(f('x','X',a.x),f('y','Y',a.y));
    if(e.type==='LINE')fields.push(f('length','Length',distance(e.a,e.b),{positive:true}),f('angle','Angle',Math.atan2(e.b.y-e.a.y,e.b.x-e.a.x)/DEG,{unit:'angle'}));
    if(e.type==='CIRCLE'||e.type==='ARC')numeric('radius','Radius',e.r,{positive:true});
    if(e.type==='ARC')fields.push(f('start','Start angle',e.start/DEG,{unit:'angle'}),f('end','End angle',e.end/DEG,{unit:'angle'}));
    if(e.type==='ELLIPSE')fields.push(f('majorRadius','Major radius',Math.hypot(e.major.x,e.major.y),{positive:true}),f('minorRadius','Minor radius',Math.hypot(e.major.x,e.major.y)*e.ratio,{positive:true}),f('angle','Axis angle',Math.atan2(e.major.y,e.major.x)/DEG,{unit:'angle'}),f('start','Start parameter',(e.start||0)/DEG,{unit:'angle'}),f('end','End parameter',(e.end??TAU)/DEG,{unit:'angle'}));
    if(['RAY','XLINE'].includes(e.type))numeric('angle','Direction',Math.atan2(e.direction.y,e.direction.x)/DEG,{unit:'angle'});
    if(e.parametric?.kind==='rectangle') {
        fields.push(f('x','X',a.x),f('y','Y',a.y),f('rectWidth','Width',distance(e.points[0],e.points[1]),{positive:true}),f('rectHeight','Height',distance(e.points[1],e.points[2]),{positive:true}),f('angle','Angle',Math.atan2(e.points[1].y-a.y,e.points[1].x-a.x)/DEG,{unit:'angle'}));
    } else {
        const points=e.type==='SPLINE'?e.controlPoints:e.points;
        if(points?.length>2048)throw new Error('Visual editing supports up to 2048 control vertices');
        (points||[]).forEach((p,i)=>{ if(i===3 && ['SOLID','TRACE','3DFACE'].includes(e.type) && distance(points[2],p)<1e-10)return; fields.push(f(`v${i}x`,`Vertex ${i+1} X`,p.x,{vertex:i}),f(`v${i}y`,`Vertex ${i+1} Y`,p.y,{vertex:i})); if(e.type==='LWPOLYLINE')numeric(`v${i}b`,`Vertex ${i+1} bulge`,p.bulge||0,{vertex:i}); });
    }
    if(e.type==='LWPOLYLINE')numeric('constantWidth','Line width',e.constantWidth||0,{min:0});
    if(e.type==='HATCH'&&(e.loops||[]).reduce((n,l)=>n+(l.points?.length||0),0)>2048)throw new Error('Visual editing supports up to 2048 hatch vertices');
    if(e.type==='HATCH')(e.loops||[]).forEach((l,j)=>(l.points||[]).forEach((p,i)=>fields.push(f(`h${j}v${i}x`,`Loop ${j+1} vertex ${i+1} X`,p.x,{vertex:i}),f(`h${j}v${i}y`,`Loop ${j+1} vertex ${i+1} Y`,p.y,{vertex:i}))));
    if(['TEXT','MTEXT','ATTDEF','ATTRIB'].includes(e.type)) {
        fields.push(f('text','Text',e.type==='MTEXT'?(e.text||'').replace(/\\P/g,'\n'):e.text||'',{type:'text',readOnly:!!e.calculation}),f('height','Text height',e.height||12,{positive:true}),f('rotation','Text angle',e.rotation||0,{unit:'angle'}));
        if(e.type==='MTEXT')fields.push(f('mtextWidth','Text width',e.mtextWidth||0,{min:0}),f('attachment','Attachment',e.attachment||1,{integer:true,min:1,max:9}));
    }
    if(e.type==='DIMENSION') {
        const p=dimensionPicture(e,doc);if([0,1].includes((e.dimtype??33)&15)){const angle=((e.dimtype??33)&15)===0?(e.dimensionAngle||0)*DEG:Math.atan2(e.b.y-e.a.y,e.b.x-e.a.x);numeric('offset','Dimension offset',e.offset??(-(e.definitionPoint.x-e.a.x)*Math.sin(angle)+(e.definitionPoint.y-e.a.y)*Math.cos(angle)));}
        fields.push(f('text','Dimension text',e.text??'<>',{type:'text'}),...['dimtxt','dimasz','dimgap','dimlfac'].map(k=>f(k,{dimtxt:'Text height',dimasz:'Arrow size',dimgap:'Text gap',dimlfac:'Measurement factor'}[k],p.style[k],{min:0})),f('dimdec','Decimals',p.style.dimdec,{integer:true,min:0,max:8}));
        for(const key of ['a','b','definitionPoint','defpoint4','defpoint5','textMidpoint'])if(e[key])fields.push(f(key+'X',key+' X',e[key].x,{definition:key}),f(key+'Y',key+' Y',e[key].y,{definition:key}));
    }
    if(e.type==='INSERT') {
        fields.push(f('rotation','Rotation',e.rotation||0,{unit:'angle'}),f('sx','Scale X',e.sx??1,{nonzero:true}),f('sy','Scale Y',e.sy??1,{nonzero:true}));
        const b=doc.blocks[e.block];if(b?.dynamic){const values=dynamicValues(b,e.dynamicParameters||{});for(const p of b.dynamic.parameters)fields.push(f('dynamic:'+p.name,p.label||p.name,values[p.name],{type:p.type==='boolean'||p.type==='enum'?'choice':'number',options:p.type==='boolean'?[false,true]:p.type==='enum'?p.values:undefined,readOnly:p.expression!==undefined}));}
        for(const attr of e.attributes||[])fields.push(f('attribute:'+attr.id,attr.attributeTag||attr.tag||'Attribute',attr.text||'',{type:'text',readOnly:!!attr.calculation}));
    }
    return fields;
}
export function sourceField2(e,field) {
    const p=e.parametric;
    if(field.name==='radius'&&p?.radius!==undefined)return String(p.radius);
    if(field.name==='length'&&p?.length!==undefined)return String(p.length);
    if(field.name==='rectWidth'&&p?.width!==undefined)return String(p.width);
    if(field.name==='rectHeight'&&p?.height!==undefined)return String(p.height);
    return field.type==='choice'?field.value:String(field.value);
}
export function number2(raw,doc,field={}) {
    const value=evaluateExpression(raw,doc.parameters||{});
    if(!Number.isFinite(value)||Math.abs(value)>1e12)throw new Error('Value is outside the supported drawing range');
    if(field.positive&&value<=1e-8||field.nonzero&&Math.abs(value)<1e-8||field.min!==undefined&&value<field.min||field.max!==undefined&&value>field.max||field.integer&&!Number.isInteger(value))throw new Error('Invalid '+(field.label||'value'));
    return value;
}
/** Apply only declared fields. Geometry identities, spline weights and Z metadata are retained. */
export function editFields2(e,doc,changes) {
    const next=clone(e);mutateFields2(next,doc,changes);
    for(const key of Object.keys(e))if(!Object.hasOwn(next,key))delete e[key];
    Object.assign(e,next);return e;
}
function mutateFields2(e,doc,changes) {
    const reason=planarEditable(e,doc);if(reason)throw new Error(reason);
    const definitions=new Map(fields2(e,doc).map(f=>[f.name,f])),v={};
    for(const [key,raw] of Object.entries(changes)) {
        const field=definitions.get(key);if(!field||field.readOnly)throw new Error('Field is missing or read-only: '+key);
        if(field.type==='text'){if(typeof raw!=='string'||raw.length>16000)throw new Error('Text must be at most 16000 characters');v[key]=raw;}
        else if(field.type==='choice'){if(!field.options.includes(raw))throw new Error('Unknown parameter choice');v[key]=raw;}
        else v[key]=number2(raw,doc,field);
    }
    const has=k=>Object.hasOwn(v,k),a=anchor2(e);
    if(has('x')||has('y'))moveEntity(e,has('x')?v.x-a.x:0,has('y')?v.y-a.y:0);
    if(e.type==='LINE'&&(has('length')||has('angle'))){const length=v.length??distance(e.a,e.b),angle=(v.angle??Math.atan2(e.b.y-e.a.y,e.b.x-e.a.x)/DEG)*DEG;e.b={...e.b,x:e.a.x+length*Math.cos(angle),y:e.a.y+length*Math.sin(angle)};}
    if(has('length'))e.parametric={...e.parametric,length:changes.length};
    if(has('radius')){e.r=v.radius;e.parametric={...e.parametric,radius:changes.radius};}
    if(e.type==='ELLIPSE'&&['majorRadius','minorRadius','angle'].some(has)){const major=v.majorRadius??Math.hypot(e.major.x,e.major.y),minor=v.minorRadius??Math.hypot(e.major.x,e.major.y)*e.ratio,angle=(v.angle??Math.atan2(e.major.y,e.major.x)/DEG)*DEG;if(minor>major)throw new Error('Minor radius cannot exceed the major radius');e.major={...e.major,x:major*Math.cos(angle),y:major*Math.sin(angle)};e.ratio=minor/major;}
    if(has('start'))e.start=v.start*DEG;if(has('end'))e.end=v.end*DEG;
    if(['RAY','XLINE'].includes(e.type)&&has('angle'))e.direction={...e.direction,x:Math.cos(v.angle*DEG),y:Math.sin(v.angle*DEG)};
    if(e.parametric?.kind==='rectangle'&&['rectWidth','rectHeight','angle'].some(has)){
        const width=v.rectWidth??distance(e.points[0],e.points[1]),height=v.rectHeight??distance(e.points[1],e.points[2]),a=e.points[0],angle=(v.angle??Math.atan2(e.points[1].y-a.y,e.points[1].x-a.x)/DEG)*DEG,c=Math.cos(angle),s=Math.sin(angle);
        e.points=[{...a},{...e.points[1],x:a.x+c*width,y:a.y+s*width},{...e.points[2],x:a.x+c*width-s*height,y:a.y+s*width+c*height},{...e.points[3],x:a.x-s*height,y:a.y+c*height}];
        if(has('rectWidth'))e.parametric.width=changes.rectWidth;if(has('rectHeight'))e.parametric.height=changes.rectHeight;
    }
    const points=e.type==='SPLINE'?e.controlPoints:e.points,triangle=points?.length===4&&['SOLID','TRACE','3DFACE'].includes(e.type)&&distance(points[2],points[3])<1e-10,closedSpline=e.type==='SPLINE'&&e.closed&&distance(points[0],points.at(-1))<1e-10;
    let vertexChanged=false;
    for(const [key,value]of Object.entries(v)){
        const vertex=/^v(\d+)([xyb])$/.exec(key),hatch=/^h(\d+)v(\d+)([xy])$/.exec(key);
        if(vertex){const index=+vertex[1];points[index][vertex[2]==='b'?'bulge':vertex[2]]=value;vertexChanged=true;if(closedSpline&&(index===0||index===points.length-1)){points[0][vertex[2]]=value;points.at(-1)[vertex[2]]=value;}}
        if(hatch)e.loops[+hatch[1]].points[+hatch[2]][hatch[3]]=value;
    }
    if(triangle)e.points[3]=clone(e.points[2]);
    if(vertexChanged&&e.type==='SPLINE')e.fitPoints=[];
    if(vertexChanged&&['LWPOLYLINE','POLYLINE','LEADER'].includes(e.type)&&points.some((p,i)=>i>0&&distance(points[i-1],p)<1e-10))throw new Error('Adjacent vertices must be distinct');
    if(vertexChanged&&['SOLID','TRACE','3DFACE'].includes(e.type))validateBoundary(triangle?points.slice(0,3):points);
    if(e.type==='HATCH')for(const l of e.loops||[])if(!l.points?.some(p=>p.bulge))validateBoundary(l.points);
    if(has('text')){if(e.type==='DIMENSION')editDimension(e,doc,{text:v.text});else e.text=e.type==='MTEXT'?v.text.replace(/\r\n?/g,'\n').replace(/\n/g,'\\P'):v.text;}
    for(const key of ['height','mtextWidth','attachment','rotation','constantWidth','sx','sy'])if(has(key))e[key]=v[key];
    if(e.type==='DIMENSION') {
        const patch={},style={};for(const key of ['offset'])if(has(key))patch[key]=v[key];for(const key of ['dimtxt','dimasz','dimgap','dimlfac','dimdec'])if(has(key))style[key]=v[key];
        for(const key of ['a','b','definitionPoint','defpoint4','defpoint5','textMidpoint'])if(has(key+'X')||has(key+'Y'))patch[key]={...e[key],x:v[key+'X']??e[key].x,y:v[key+'Y']??e[key].y};
        if(Object.keys(style).length)patch.style=style;if(Object.keys(patch).length)editDimension(e,doc,patch);
    }
    if(e.type==='INSERT'){
        const parameters={};for(const key of Object.keys(v))if(key.startsWith('dynamic:'))parameters[key.slice(8)]=v[key];
        if(Object.keys(parameters).length)setDynamicParameters(e,doc,parameters);
        for(const attr of e.attributes||[])if(has('attribute:'+attr.id))attr.text=v['attribute:'+attr.id];
    }
    if(vertexChanged&&e.connector){e.connector.waypoints=e.points.slice(1,-1).map(clone);e.connector.status='manual';if(has('v0x')||has('v0y'))e.connector.from=null;const last=e.points.length-1;if(has(`v${last}x`)||has(`v${last}y`))e.connector.to=null;}
    if(e.type==='ARC' && Math.abs(Math.sin((e.end-e.start)/2))<1e-10)throw new Error('Arc endpoints must define a nonzero sweep');
    e.dirty=true;return e;
}
