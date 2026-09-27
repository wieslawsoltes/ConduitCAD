import { V3, sub3, dot3, unit3, length3 } from '@conduitcad/geometry3d';
import { OrbitCamera } from './camera.js';
import { buildScene3D, pick3D } from './scene.js';
import { normalizeDisplaySettings, visualStyle, faceMode, color3, ENVIRONMENTS, renderSize3D } from './visual-styles.js';
import { prepareRenderScene, packRenderData } from './render-data.js';
import { rasterizeScene, softwareShadowMap } from './software.js';
import { GPUDisplayRenderer } from './webgpu.js';
import { GLDisplayRenderer } from './webgl.js';

export class SpatialRenderer {
    constructor(host,{backend='auto',camera=new OrbitCamera(),onStatus=()=>{}}={}) {
        if(!host)throw new Error('3D renderer requires a host');
        this.host=host;this.requestedBackend=backend;this.camera=camera;this.onStatus=onStatus;
        this.selection=new Set();this.selectedFace=null;this.settings=normalizeDisplaySettings();this._section=null;
        this.active=true;this.pending=0;this.uploads=0;this.revision=0;this.fallbackReasons=[];
        this.scene=buildScene3D({entities:[],layers:[],blocks:{}});this.renderScene=prepareRenderScene(this.scene,this.settings);
        this.makeCanvas();this.overlay=document.createElement('canvas');this.overlay.className='model3d-labels';this.overlay.style.pointerEvents='none';host.append(this.overlay);
        this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.ready=this.initialize(backend);
    }
    get style(){return this.settings.style;}
    set style(value){this.setDisplaySettings({style:value});}
    get section(){return this._section;}
    set section(value){let next=null;if(value){const len=length3(value.normal);if(!Number.isFinite(value.offset)||!Number.isFinite(len)||len<1e-12)throw new RangeError('Invalid section plane');next=Object.freeze({normal:Object.freeze(unit3(value.normal)),offset:value.offset/len});}if(JSON.stringify(next)===JSON.stringify(this._section))return;this._section=next;this.prepare();}
    get displaySettings(){return {...this.settings};}
    setDisplaySettings(patch,{replace=false,tolerant=false}={}) {
        const next=normalizeDisplaySettings(replace?patch:{...this.settings,...patch},{tolerant});
        const rebuild=next.creaseAngle!==this.settings.creaseAngle||next.sectionCaps!==this.settings.sectionCaps;
        const resize=next.quality!==this.settings.quality||next.style!==this.settings.style||next.shadows!==this.settings.shadows||next.ambientOcclusion!==this.settings.ambientOcclusion;
        this.settings=next;if(rebuild)this.prepare();if(resize)this.resize();this.invalidate();return this.displaySettings;
    }
    makeCanvas(){this.canvas?.remove();this.canvas=document.createElement('canvas');this.canvas.className='model3d-render';this.host.prepend(this.canvas);}
    async initialize(backend){
        if(!['auto','webgpu','webgl2','canvas'].includes(backend))throw new RangeError('Unknown 3D backend');
        const reasons=[];
        if(backend==='auto'||backend==='webgpu'){
            const gpu=new GPUDisplayRenderer();
            try{
                await gpu.initialize(this.canvas);if(this.disposed){gpu.dispose();return;}
                this.gpu=gpu;this.device=gpu.device;this.adapterInfo=gpu.adapterInfo;this.backend='WebGPU';
                gpu.onError=error=>{if(this.disposed||this.gpu!==gpu)return;this.fallbackReasons.push('WebGPU rendering error: '+error.message);this.device=null;this.gpu=null;gpu.dispose();this.backend=null;this.makeCanvas();this.ready=this.initialize('webgl2');};
                const device=this.device;
                device.lost.then(info=>{if(this.disposed||this.device!==device)return;this.device=null;this.gpu=null;gpu.dispose();this.backend=null;this.makeCanvas();this.ready=this.initialize('webgl2').then(()=>{this.fallbackReasons.push('WebGPU device lost: '+info.reason);this.reportStatus();});});
            }catch(error){reasons.push(error.message);gpu.dispose();this.makeCanvas();}
        }
        if(!this.backend&&backend!=='canvas'){
            const gl=new GLDisplayRenderer();try{gl.initialize(this.canvas);this.glRenderer=gl;this.gl=gl.gl;this.backend='WebGL2';this.bindGLRecovery();}catch(error){reasons.push(error.message);gl.dispose();this.makeCanvas();}
        }
        if(!this.backend){this.ctx=this.canvas.getContext('2d');if(!this.ctx)throw new Error('No rendering context');this.backend='Canvas 2D · software depth buffer';}
        this.fallbackReasons.push(...reasons);this.resize();this.upload();this.reportStatus();this.invalidate();
    }
    reportStatus(){this.onStatus({backend:this.backend,requested:this.requestedBackend,fallback:this.requestedBackend!=='auto'&&!this.backend.toLowerCase().startsWith(this.requestedBackend),reasons:[...this.fallbackReasons]});}
    bindGLRecovery(){
        this.glLifecycle?.abort();this.glLifecycle=new AbortController();
        this.canvas.addEventListener('webglcontextlost',event=>{
            event.preventDefault();
            if(!this.disposed)this.onStatus({backend:'WebGL2 context lost',fallback:true,reasons:['Waiting for browser restoration']});
        },{signal:this.glLifecycle.signal});
        this.canvas.addEventListener('webglcontextrestored',()=>{
            if(this.disposed)return;
            // Loss already destroyed old objects. Deleting old handles in the new
            // context is invalid; reconstruct a fresh graph and upload once.
            const next=new GLDisplayRenderer();
            try{next.initialize(this.canvas);this.glRenderer=next;this.gl=next.gl;this.resize();this.upload();this.reportStatus();}
            catch(error){next.dispose();this.fallbackFromGL(error);}
        },{signal:this.glLifecycle.signal});
    }
    fallbackFromGL(error){
        this.glLifecycle?.abort();this.glRenderer=null;this.gl=null;this.backend=null;
        this.fallbackReasons.push('WebGL2 display resources unavailable: '+error.message);
        this.makeCanvas();this.ready=this.initialize('canvas');
    }
    resize(){if(this.disposed)return;const r=this.host.getBoundingClientRect();if(r.width<1||r.height<1)return;
        this.transparent=this.settings.style==='xray'||this.hasTransparent;
        const options={ao:this.settings.ambientOcclusion,shadows:this.settings.shadows,transparent:this.transparent};
        const size=renderSize3D(r.width,r.height,devicePixelRatio||1,this.settings,this.transparent,matchMedia('(pointer:coarse)').matches,this.device?.limits.maxTextureDimension2D??this.glRenderer?.maxDimension??8192);
        const {width,height,scale:dpr}=size;this.attachmentBytes=size.estimatedAttachmentBytes;
        this.camera.resize(r.width,r.height);this.dpr=dpr;
        if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;this.overlay.width=width;this.overlay.height=height;}
        this.gpu?.resize(width,height,options);
        try{this.glRenderer?.resize(width,height,options);}catch(error){this.glRenderer?.dispose();this.fallbackFromGL(error);}
        this.invalidate();
    }
    prepare(){if(!this.scene)return;this.renderScene=prepareRenderScene(this.scene,this.settings,this.section);this.revision++;this.shadowState=null;this.hasTransparent=this.scene.items.some(i=>(i.material?.opacity??1)<.999);this.resize();this.upload();this.invalidate();}
    setDocument(document,options={}){this.document=document;this.scene=buildScene3D(document,options);this.prepare();}
    setSelection(ids,face=null){const set=new Set(ids);if(set.size===this.selection.size&&[...set].every(id=>this.selection.has(id))&&JSON.stringify(face)===JSON.stringify(this.selectedFace))return;this.selection=set;this.selectedFace=face;this.upload();this.invalidate();}
    upload(){if(!this.renderScene||!this.backend)return;this.data=packRenderData(this.renderScene,this.selection,this.selectedFace);this.counts=[this.data[0].length/17,this.data[1].length/21];this.uploads++;this.gpu?.upload(this.data);this.glRenderer?.upload(this.data);}
    invalidate(){if(this.disposed||this.pending||!this.active)return;this.pending=requestAnimationFrame(()=>{this.pending=0;this.draw();});}
    shadowCamera(){
        const key=this.revision+':'+this.settings.environment;if(this.cachedShadow?.key===key)return this.cachedShadow.camera;
        const l=unit3(V3(...ENVIRONMENTS.find(e=>e.id===this.settings.environment).light)),c=new OrbitCamera({yaw:Math.atan2(l.y,l.x),pitch:Math.asin(l.z)});c.resize(1024,1024);c.fit(this.scene.points);
        const radius=Math.max(1,c.height);c.near=()=>Math.max(1e-5,c.distance-radius*2);c.far=()=>c.distance+radius*2;this.cachedShadow={key,camera:c};return c;
    }
    frameData(){
        const s=this.settings,mode=visualStyle(s.style),o=this.scene.origin,b=this.camera.basis(),envIndex=ENVIRONMENTS.findIndex(e=>e.id===s.environment),l=unit3(V3(...ENVIRONMENTS[envIndex].light)),eye=sub3(b.eye,o),section=this.section;
        const size=Math.max(1,...['x','y','z'].map(k=>this.scene.bounds.empty?1:this.scene.bounds.max[k]-this.scene.bounds.min[k])),shadow=this.shadowCamera();this.currentShadowCamera=shadow;
        return new Float32Array([
            ...this.camera.matrix(o),...shadow.matrix(o),...(section?[section.normal.x,section.normal.y,section.normal.z,section.offset-dot3(o,section.normal)]:[0,0,0,1]),
            eye.x,eye.y,eye.z,0,l.x,l.y,l.z,1,...color3(s.backgroundColor),s.background==='gradient'?1:0,...color3(s.backgroundTop),0,...color3(s.edgeColor),1,...color3(s.hiddenColor),1,
            faceMode(s.style),this.transparent?1:0,mode.visible?1:0,mode.hidden==='solid'?2:mode.hidden?1:0,
            s.style==='xray'?s.xrayOpacity:1,s.edgeWidth*this.dpr,s.silhouetteWidth*this.dpr,Math.cos(s.creaseAngle*Math.PI/180),
            s.grid?1:0,s.ground?1:0,s.shadows?1:0,s.ambientOcclusion?1:0,
            s.exposure,envIndex,mode.smooth?1:0,s.edgeDetail==='all'||s.style==='wireframe'?1:0,
            this.canvas.width,this.canvas.height,1/this.canvas.width,1/this.canvas.height,
            this.camera.near(),this.camera.far(),this.camera.perspective?1:0,this.camera.height,
            b.right.x,b.right.y,b.right.z,0,b.up.x,b.up.y,b.up.z,0,b.back.x,b.back.y,b.back.z,0,
            s.aoRadius*size,s.aoStrength,0,this.renderScene.step*.65,
            s.style==='sketchy'?s.jitter*this.dpr:0,s.style==='sketchy'?s.overhang*this.dpr:0,s.hiddenDash*this.dpr,0,
            ...color3(s.groundColor),this.renderScene.groundZ-o.z,0,0,0,0,...color3(s.capColor),s.capHatch?1:0
        ]);
    }
    draw(){if(!this.backend||this.disposed||!this.active||!this.data)return;const start=performance.now(),frame=this.frameData(),s=this.settings,shadowKey=JSON.stringify([this.revision,this.section,s.environment]);
        const options={shadows:s.shadows,ao:s.ambientOcclusion,shadowKey,transparent:!!this.transparent};
        if(this.gpu)this.gpu.draw(frame,options);else if(this.glRenderer)this.glRenderer.draw(frame,options);else this.drawCanvas(shadowKey);
        this.drawLabels();this.stats={backend:this.backend,style:s.style,triangles:this.scene.triangles.length,segments:this.scene.lines.length,frameMs:performance.now()-start,uploads:this.uploads,passes:this.gpu?.lastPassCount??this.glRenderer?.lastPassCount??2+(this.transparent?2:0)+(s.shadows?1:0)+(s.ambientOcclusion?1:0),estimatedAttachmentBytes:this.attachmentBytes,capTriangles:this.renderScene.triangles.filter(t=>t.cap).length};this.onFrame?.(this.stats);
    }
    drawCanvas(shadowKey){
        const budget=this.settings.quality==='high'?1200000:this.settings.quality==='draft'?240000:600000,scale=Math.min(1,Math.sqrt(budget/(this.canvas.width*this.canvas.height))),width=Math.max(1,Math.round(this.canvas.width*scale)),height=Math.max(1,Math.round(this.canvas.height*scale));
        if(this.settings.shadows&&this.shadowState?.key!==shadowKey)this.shadowState={key:shadowKey,map:softwareShadowMap(this.renderScene,this.currentShadowCamera,this.settings,this.section)};
        const image=rasterizeScene(this.renderScene,this.camera,{width,height,style:this.style,settings:this.settings,section:this.section,selection:this.selection,selectedFace:this.selectedFace,shadowMap:this.shadowState?.map});this.softwareFrame=image;
        if(!this.softwareCanvas)this.softwareCanvas=document.createElement('canvas');if(this.softwareCanvas.width!==width||this.softwareCanvas.height!==height){this.softwareCanvas.width=width;this.softwareCanvas.height=height;}
        this.softwareCanvas.getContext('2d').putImageData(new ImageData(image.pixels,width,height),0,0);this.ctx.setTransform(1,0,0,1,0,0);this.ctx.drawImage(this.softwareCanvas,0,0,this.canvas.width,this.canvas.height);
    }
    drawLabels(){const ctx=this.overlay.getContext('2d'),dpr=this.dpr||1;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,this.camera.width,this.camera.pixelHeight);ctx.font='12px system-ui';
        for(const label of this.scene.labels){const p=this.camera.project(label.p);if(!p.visible||(this.section&&dot3(label.p,this.section.normal)>this.section.offset))continue;ctx.fillStyle=label.color;ctx.fillText(label.text.slice(0,160),p.x,p.y);}
        if(this.marker){const p=this.camera.project(this.marker);if(p.visible){ctx.fillStyle='#dd8a1f';ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,6,0,Math.PI*2);ctx.fill();ctx.stroke();}}
        this.drawOverlay?.(ctx,this.camera);
    }
    pick(x,y,options={}){return pick3D(this.scene,this.camera,x,y,{section:this.section,...options});}
    fit(){this.camera.fit(this.scene.points);this.invalidate();}
    async capturePNG({annotations=true}={}){
        await this.ready;if(this.disposed)throw new Error('Renderer disposed');this.draw();
        const c=document.createElement('canvas');c.width=this.canvas.width;c.height=this.canvas.height;
        const ctx=c.getContext('2d');
        // Begin GPU copy synchronously after submission, before presentation can
        // retire the canvas texture. Snapshot annotations before awaiting readback.
        const readback=this.gpu?.readPixels();let overlay;
        if(annotations){overlay=document.createElement('canvas');overlay.width=c.width;overlay.height=c.height;overlay.getContext('2d').drawImage(this.overlay,0,0);}
        if(readback){const image=await readback;ctx.putImageData(new ImageData(image.pixels,image.width,image.height),0,0);}
        else ctx.drawImage(this.canvas,0,0);
        if(overlay)ctx.drawImage(overlay,0,0);
        return new Promise((resolve,reject)=>c.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG capture failed')),'image/png'));
    }
    dispose(){this.disposed=true;this.glLifecycle?.abort();cancelAnimationFrame(this.pending);this.observer.disconnect();this.gpu?.dispose();this.glRenderer?.dispose();this.canvas.remove();this.overlay.remove();}
}
