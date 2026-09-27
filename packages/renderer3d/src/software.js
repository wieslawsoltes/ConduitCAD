import { V3, dot3, sub3, mul3, add3, lerp3, unit3 } from '@conduitcad/geometry3d';
import { normalizeDisplaySettings, visualStyle, color3, ENVIRONMENTS } from './visual-styles.js';
import { background3D, shadeSurface3D } from './lighting.js';
import { edgeVisible, surfaceAlpha } from './render-data.js';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
/** Clip attributes before perspective division: no near-plane streaks or barycentric drift. */
export function clipSurface(vertices, planes) {
    let out=vertices;
    for(const {n,w}of planes){const next=[];for(let i=0;i<out.length;i++){const a=out[i],b=out[(i+1)%out.length],da=dot3(a.p,n)-w,db=dot3(b.p,n)-w;if(da<=0)next.push(a);if(da*db<0){const t=da/(da-db);next.push({p:lerp3(a.p,b.p,t),n:lerp3(a.n,b.n,t)});}}out=next;}
    return out;
}
function cameraProjector(camera,width,height){
    const basis=camera.basis(),sx=width/camera.width,sy=height/camera.pixelHeight;
    const project=p=>{const v=sub3(p,basis.eye),z=dot3(v,basis.forward),scale=camera.perspective?camera.pixelHeight/(.8284271247461901*z):camera.pixelHeight/camera.height;return {x:(camera.width*.5+dot3(v,basis.right)*scale)*sx,y:(camera.pixelHeight*.5-dot3(v,basis.up)*scale)*sy,z};};
    const world=(x,y,z)=>{const half=camera.perspective?z*.4142135623730951:camera.height*.5;return add3(basis.eye,add3(mul3(basis.right,((x+.5)/width*2-1)*half*camera.width/camera.pixelHeight),add3(mul3(basis.up,(1-(y+.5)/height*2)*half),mul3(basis.back,-z))));};
    const plane=dot3(basis.eye,basis.forward),planes=[{n:mul3(basis.forward,-1),w:-plane-camera.near()},{n:basis.forward,w:plane+camera.far()}];
    return {basis,project,world,planes};
}
function rasterTriangle(a,b,c,width,height,perspective,emit){
    const cross=(a,b,x,y)=>(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x);
    let area=cross(a,b,c.x,c.y);if(!Number.isFinite(area)||Math.abs(area)<1e-12)return;if(area<0){[b,c]=[c,b];area=-area;}
    const top=(p,q)=>q.y<p.y||(q.y===p.y&&q.x>p.x),tops=[top(b,c),top(c,a),top(a,b)];
    const x0=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),x1=Math.min(width-1,Math.ceil(Math.max(a.x,b.x,c.x))),y0=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),y1=Math.min(height-1,Math.ceil(Math.max(a.y,b.y,c.y)));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
        let u=cross(b,c,x+.5,y+.5),v=cross(c,a,x+.5,y+.5),w=cross(a,b,x+.5,y+.5);
        if(u<0||v<0||w<0||(u===0&&!tops[0])||(v===0&&!tops[1])||(w===0&&!tops[2]))continue;
        u/=area;v/=area;w/=area;
        const z=perspective?1/(u/a.z+v/b.z+w/c.z):u*a.z+v*b.z+w*c.z;
        if(perspective){u*=z/a.z;v*=z/b.z;w*=z/c.z;}
        emit(x,y,z,u*a.n.x+v*b.n.x+w*c.n.x,u*a.n.y+v*b.n.y+w*c.n.y,u*a.n.z+v*b.n.z+w*c.n.z);
    }
}
function triangles(scene,camera,width,height,settings,section,emit,filter=()=>true){
    const projector=cameraProjector(camera,width,height);
    scene.triangles.forEach((t,id)=>{
        if((t.ground&&!settings.ground)||(t.material?.opacity??1)<.001||!filter(t))return;
        const planes=[...projector.planes];if(section&&!t.ground)planes.push({n:section.normal,w:section.offset+camera.height*1e-6});
        const vertices=clipSurface(t.vertices.map((p,i)=>({p,n:visualStyle(settings.style).smooth?(t.normals?.[i]||t.normal):t.normal})),planes).map(v=>({...projector.project(v.p),n:v.n}));
        for(let j=1;j+1<vertices.length;j++)rasterTriangle(vertices[0],vertices[j],vertices[j+1],width,height,camera.perspective,(x,y,z,nx,ny,nz)=>emit(t,id,x,y,z,nx,ny,nz));
    });return projector;
}
export function softwareShadowMap(scene,camera,settings,section,size=512){
    const depth=new Float64Array(size*size);depth.fill(Infinity);
    const projector=triangles(scene,camera,size,size,settings,section,(_t,_id,x,y,z)=>{const i=y*size+x;if(z<depth[i])depth[i]=z;},t=>!t.ground&&(t.material?.opacity??1)>=.98);
    return {depth,size,project:projector.project,camera};
}
/** Bounded reference renderer: Z prepass, smooth/PBR shading, weighted OIT, visible/hidden edges. */
export function rasterizeScene(scene,camera,{width,height,style='shaded-edges',section=null,selection=new Set(),selectedFace=null,settings:input={},shadowMap=null,shade:legacyShade,rgb:legacyRGB}={}) {
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>6000000)throw new RangeError('Software rendering requires 1–6,000,000 pixels');
    const settings=normalizeDisplaySettings({...input,style}),mode=visualStyle(style),count=width*height,pixels=new Uint8ClampedArray(count*4),depth=new Float64Array(count),ids=new Int32Array(count),normals=new Float32Array(count*3);
    depth.fill(Infinity);ids.fill(-1);
    const transparent=mode.faces!=='none'&&scene.triangles.some(t=>surfaceAlpha(t,settings)<.999),surfaceDepth=transparent?new Float64Array(count):depth;
    if(transparent)surfaceDepth.fill(Infinity);
    const projector=triangles(scene,camera,width,height,settings,section,(t,id,x,y,z,nx,ny,nz)=>{
        const i=y*width+x;
        if(transparent&&z<surfaceDepth[i])surfaceDepth[i]=z;
        const a=mode.faces==='none'?1:surfaceAlpha(t,settings);
        if(a>=.999&&z<=depth[i]){depth[i]=z;ids[i]=id;normals[i*3]=nx;normals[i*3+1]=ny;normals[i*3+2]=nz;}
    });
    const {world,basis}=projector,light=unit3(V3(...ENVIRONMENTS.find(e=>e.id===settings.environment).light)),bg=color3(settings.backgroundColor),top=color3(settings.backgroundTop),exposure=2**settings.exposure;
    const selected=t=>selection.has(t.id)&&(!selectedFace||(selectedFace.id===t.id&&selectedFace.face===t.face));
    const cached=scene.triangles.map(t=>color3(selected(t)?'#f0b359':t.ground?settings.groundColor:t.cap?settings.capColor:t.material?.color||t.color));
    const shadow=(p,n)=>{
        if(!settings.shadows||!shadowMap)return 1;const q=shadowMap.project(p),size=shadowMap.size;
        if(q.x<0||q.y<0||q.x>=size||q.y>=size||q.z<=shadowMap.camera.near()||q.z>=shadowMap.camera.far())return 1;
        const bias=(.0004+.0008*(1-Math.abs(dot3(n,light))))*(shadowMap.camera.far()-shadowMap.camera.near());let sum=0;
        for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const i=clamp(Math.floor(q.y)+y,0,size-1)*size+clamp(Math.floor(q.x)+x,0,size-1);sum+=q.z-bias>shadowMap.depth[i]?0:1;}return .25+.75*sum/9;
    };
    const offsets=Array.from({length:12},(_,i)=>[Math.cos(i*2.39996323)*Math.sqrt((i+.5)/12),Math.sin(i*2.39996323)*Math.sqrt((i+.5)/12)]);
    const radius=settings.aoRadius*Math.max(1,...['x','y','z'].map(k=>scene.bounds?.empty?1:(scene.bounds?.max[k]??1)-(scene.bounds?.min[k]??0)));
    const ambient=(p,n,x,y,z)=>{if(!settings.ambientOcclusion||mode.faces==='none')return 1;const r=clamp(radius*height/(camera.perspective?z*.82842712:camera.height),2,80);let sum=0;for(const [dx,dy]of offsets){const xx=clamp(Math.floor(x+.5+dx*r),0,width-1),yy=clamp(Math.floor(y+.5+dy*r),0,height-1),zd=surfaceDepth[yy*width+xx];if(!Number.isFinite(zd))continue;const delta=sub3(world(xx,yy,zd),p),len=Math.hypot(delta.x,delta.y,delta.z);if(len>radius*.015&&len<radius)sum+=Math.max(0,dot3(n,delta)/len-.05)*(1-len/radius);}return clamp(1-settings.aoStrength*sum*.33,.12,1);};
    const shadeAt=(t,id,x,y,z,nx,ny,nz)=>{
        if(legacyShade)return legacyShade(t,selected(t));
        const p=world(x,y,z),view=camera.perspective?sub3(basis.eye,p):basis.back;let n=V3(nx,ny,nz),length=Math.hypot(nx,ny,nz)||1;n=mul3(n,1/length);if(dot3(n,view)<0)n=mul3(n,-1);
        const ao=ambient(p,n,x,y,z),sh=shadow(p,n),base=cached[id];
        if(t.cap){const q=sub3(p,scene.origin),h=(q.x+q.y*.71+q.z*.43)/Math.max(.00001,(scene.step||1)*.65),factor=settings.capHatch&&(h-Math.floor(h))<.12?.65:1;return base.map(x=>x*factor);}
        if(mode.faces==='none'&&!t.ground)return settings.background==='gradient'?top.map((v,i)=>v*(1-(y+.5)/height)+bg[i]*(y+.5)/height):bg;
        if(mode.faces==='shaded'||t.ground||mode.faces==='gray'||mode.faces==='clay'){
            const color=mode.faces==='gray'&&!t.ground?Array(3).fill(base[0]*.2126+base[1]*.7152+base[2]*.0722):mode.faces==='clay'&&!t.ground?[.76862745,.7490196,.6862745]:base;
            const intensity=(.45*ao+.55*Math.max(0,dot3(n,light))*sh)*exposure;return [clamp(color[0]*intensity),clamp(color[1]*intensity),clamp(color[2]*intensity)];
        }
        return shadeSurface3D(t,n,view,settings,{selected:selected(t),ao,shadow:sh,y:(y+.5)/height});
    };
    for(let y=0;y<height;y++){const row=settings.background==='gradient'?top.map((v,i)=>v*(1-(y+.5)/height)+bg[i]*(y+.5)/height):bg;for(let x=0;x<width;x++){const i=y*width+x,id=ids[i],color=id<0?row:shadeAt(scene.triangles[id],id,x,y,depth[i],normals[i*3],normals[i*3+1],normals[i*3+2]);pixels[i*4]=color[0]*255;pixels[i*4+1]=color[1]*255;pixels[i*4+2]=color[2]*255;pixels[i*4+3]=255;}}
    if(transparent){
        const accum=new Float32Array(count*4),reveal=new Float32Array(count);reveal.fill(1);
        triangles(scene,camera,width,height,settings,section,(t,id,x,y,z,nx,ny,nz)=>{const i=y*width+x;if(z>depth[i]+1e-7)return;const a=surfaceAlpha(t,settings),w=Math.max(.01,a*a*8),color=shadeAt(t,id,x,y,z,nx,ny,nz);for(let c=0;c<3;c++)accum[i*4+c]+=color[c]*a*w;accum[i*4+3]+=a*w;reveal[i]*=1-a;},t=>surfaceAlpha(t,settings)<.999);
        for(let i=0;i<count;i++){if(accum[i*4+3]<=0)continue;for(let c=0;c<3;c++)pixels[i*4+c]=pixels[i*4+c]*reveal[i]+accum[i*4+c]/accum[i*4+3]*255*(1-reveal[i]);}
    }
    const scale=width/camera.width;
    for(let index=0;index<scene.lines.length;index++){
        const line=scene.lines[index];if(!edgeVisible(line,camera,settings))continue;
        let a=line.a,b=line.b,reject=false;const planes=[...projector.planes,...(section&&!line.grid?[{n:section.normal,w:section.offset+camera.height*1e-6}]:[])];
        for(const {n,w}of planes){const da=dot3(a,n)-w,db=dot3(b,n)-w;if(da>0&&db>0){reject=true;break;}if(da*db<0){const p=lerp3(a,b,da/(da-db));if(da>0)a=p;else b=p;}}
        if(reject)continue;const p=projector.project(a),q=projector.project(b);let dx=q.x-p.x,dy=q.y-p.y;const len=Math.hypot(dx,dy);if(!Number.isFinite(len)||len<1e-6)continue;
        const dirx=dx/len,diry=dy/len,seed=(index*.61803398875)%1,sketch=settings.style==='sketchy'&&!line.grid,over=sketch?settings.overhang*scale:0;
        if(sketch){const j0=Math.sin(seed*123)*settings.jitter*scale,j1=Math.sin(seed*123+17)*settings.jitter*scale;p.x+=diry*j0-dirx*over;p.y+=-dirx*j0-diry*over;q.x+=diry*j1+dirx*over;q.y+=-dirx*j1+diry*over;dx=q.x-p.x;dy=q.y-p.y;}
        const view=camera.perspective?sub3(basis.eye,line.a):basis.back,sil=line.edge&&(!line.adjacent||line.adjacent.length<2||dot3(line.adjacent[0],view)*dot3(line.adjacent[1],view)<=0),thickness=(sil?Math.max(settings.edgeWidth,settings.silhouetteWidth):settings.edgeWidth)*scale;
        const color=legacyRGB?legacyRGB(selection.has(line.id)?'#db861e':line.edge?settings.edgeColor:line.color):color3(selection.has(line.id)?'#db861e':line.edge?settings.edgeColor:line.color),hiddenColor=color3(settings.hiddenColor),den=dx*dx+dy*dy,bias=camera.height*.00006,half=thickness*.5+.8;
        // Clip iteration bounds, including enormous construction line projections.
        const x0=Math.max(0,Math.floor(Math.min(p.x,q.x)-half)),x1=Math.min(width-1,Math.ceil(Math.max(p.x,q.x)+half)),y0=Math.max(0,Math.floor(Math.min(p.y,q.y)-half)),y1=Math.min(height-1,Math.ceil(Math.max(p.y,q.y)+half));
        const majorX=Math.abs(dx)>=Math.abs(dy),length2=Math.sqrt(den);
        // Scan the narrow major-axis strip, never the potentially enormous bounding box.
        const first=majorX?x0:y0,last=majorX?x1:y1;
        for(let major=first;major<=last;major++){
          const center=majorX?p.y+(major+.5-p.x)*dy/dx:p.x+(major+.5-p.y)*dx/dy;
          const radius=half*length2/(majorX?Math.abs(dx):Math.abs(dy))+1;
          const low=Math.max(majorX?y0:x0,Math.floor(center-radius)),high=Math.min(majorX?y1:x1,Math.ceil(center+radius));
          for(let minor=low;minor<=high;minor++){
            const x=majorX?major:minor,y=majorX?minor:major;
            const t=((x+.5-p.x)*dx+(y+.5-p.y)*dy)/den;if(t<0||t>1)continue;
            const distance=Math.abs((x+.5-p.x)*dy-(y+.5-p.y)*dx)/Math.sqrt(den);if(distance>half)continue;
            const z=(camera.perspective?1/((1-t)/p.z+t/q.z):(1-t)*p.z+t*q.z)-bias,i=y*width+x,obscured=z>depth[i]+Math.max(1e-8,Math.abs(z)*1e-8);
            if(obscured&&(!mode.hidden||line.grid||line.cap))continue;
            if(obscured&&mode.hidden===true&&(((t*(len+2*over)-over)/(settings.hiddenDash*scale))%1+1)%1>.55)continue;
            const c=obscured&&mode.hidden===true?hiddenColor:color,alpha=(1-smooth(thickness*.5-.45,thickness*.5+.6,distance))*(obscured&&mode.hidden===true?.7:1)*(selection.has(line.id)?1:(line.opacity??1));
            for(let k=0;k<3;k++)pixels[i*4+k]=c[k]*255*alpha+pixels[i*4+k]*(1-alpha);
          }
        }
    }
    return {pixels,depth,surfaceDepth,width,height};
}
