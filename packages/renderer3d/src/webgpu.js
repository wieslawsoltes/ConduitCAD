import { WGSL, FRAME_FLOATS } from './shaders.js';
const surfaceAttributes=[3,3,3,3,4,1].map((n,i,a)=>({shaderLocation:i,offset:a.slice(0,i).reduce((x,y)=>x+y,0)*4,format:n===1?'float32':`float32x${n}`}));
const edgeAttributes=[3,3,3,3,4,1,4].map((n,i,a)=>({shaderLocation:i,offset:a.slice(0,i).reduce((x,y)=>x+y,0)*4,format:n===1?'float32':`float32x${n}`}));
/** Four-sample opaque/weighted-OIT/edge render graph. All display changes are uniforms. */
export class GPUDisplayRenderer {
    async initialize(canvas) {
        if(!navigator.gpu)throw new Error('WebGPU API is unavailable');
        const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('No WebGPU adapter');
        this.adapterInfo={vendor:adapter.info?.vendor,architecture:adapter.info?.architecture,device:adapter.info?.device,description:adapter.info?.description};
        const d=await adapter.requestDevice();this.device=d;this.context=canvas.getContext('webgpu');if(!this.context)throw new Error('WebGPU canvas unavailable');
        this.format=navigator.gpu.getPreferredCanvasFormat();this.context.configure({device:d,format:this.format,alphaMode:'opaque',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
        this.errors=[];d.addEventListener('uncapturederror',e=>{this.errors.push(e.error.message);this.onError?.(e.error);});
        d.pushErrorScope('validation');const module=d.createShaderModule({code:WGSL});
        const compilation=await module.getCompilationInfo();const errors=compilation.messages.filter(m=>m.type==='error');if(errors.length)throw new Error(errors.map(e=>`${e.lineNum}:${e.linePos} ${e.message}`).join('\n'));
        this.uniform=d.createBuffer({size:FRAME_FLOATS*4,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
        const blend={color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'}};
        const spec={
            opaque:{fragment:'opaqueFragment',format:this.format,samples:4,depth:'depth24plus',write:true},
            normal:{fragment:'depthFragment',format:'rgba16float',samples:1,depth:'depth32float',write:true},
            shadow:{vertex:'shadowVertex',fragment:'shadowFragment',samples:1,depth:'depth32float',write:true},
            accum:{fragment:'accumulateFragment',format:'rgba16float',samples:4,depth:'depth24plus',write:false,blend:{color:{srcFactor:'one',dstFactor:'one',operation:'add'},alpha:{srcFactor:'one',dstFactor:'one',operation:'add'}}},
            reveal:{fragment:'revealFragment',format:'rgba16float',samples:4,depth:'depth24plus',write:false,blend:{color:{srcFactor:'zero',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'zero',dstFactor:'one-minus-src-alpha',operation:'add'}}},
            background:{vertex:'fullscreen',fragment:'backgroundFragment',format:this.format,samples:4,depth:'depth24plus',write:false,compare:'always',full:true},
            composite:{vertex:'fullscreen',fragment:'compositeFragment',format:this.format,samples:4,depth:'depth24plus',write:false,compare:'always',full:true},
            visible:{vertex:'edgeVertex',fragment:'edgeFragment',format:this.format,samples:4,depth:'depth24plus',write:false,edge:true,blend},
            hidden:{vertex:'edgeVertex',fragment:'hiddenFragment',format:this.format,samples:4,depth:'depth24plus',write:false,edge:true,blend,compare:'greater'}
        };
        this.pipelines={};this.groups={};
        for(const [name,s]of Object.entries(spec)){
            const pipeline=await d.createRenderPipelineAsync({layout:'auto',vertex:{module,entryPoint:s.vertex||'surfaceVertex',buffers:s.full?[]:[{arrayStride:s.edge?84:68,stepMode:s.edge?'instance':'vertex',attributes:s.edge?edgeAttributes:surfaceAttributes}]},fragment:{module,entryPoint:s.fragment,targets:s.format?[{format:s.format,...(s.blend?{blend:s.blend}:{})}]:[]},primitive:{topology:'triangle-list',cullMode:'none'},multisample:{count:s.samples},depthStencil:{format:s.depth,depthWriteEnabled:s.write,depthCompare:s.compare||'less-equal'}});
            this.pipelines[name]=pipeline;
            this.groups[name]=d.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}}]});
        }
        const error=await d.popErrorScope();if(error)throw new Error(error.message);
        this.textures={};this.frameGroups={};this.buffers=[];
    }
    upload(data){this.buffers.forEach(b=>b.destroy());this.buffers=data.map(a=>{const b=this.device.createBuffer({size:Math.max(4,a.byteLength),usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});if(a.byteLength)this.device.queue.writeBuffer(b,0,a);return b;});this.counts=[data[0].length/17,data[1].length/21];}
    resize(width,height,{ao=false,transparent=false,shadows=false}={}){const key=[width,height,ao,transparent,shadows].join(':');if(this.targetKey===key)return;this.targetKey=key;this.width=width;this.height=height;Object.values(this.textures).forEach(t=>t.destroy());const d=this.device,T=GPUTextureUsage;
        const tex=(name,format,samples=1,w=width,h=height,sampled=true)=>this.textures[name]=d.createTexture({size:[w,h],format,sampleCount:samples,usage:T.RENDER_ATTACHMENT|(sampled&&samples===1?T.TEXTURE_BINDING:0)});
        tex('normal','rgba16float',1,ao?width:1,ao?height:1);tex('normalDepth','depth32float',1,ao?width:1,ao?height:1,false);tex('shadow','depth32float',1,shadows?1024:1,shadows?1024:1);
        tex('depth','depth24plus',4,width,height,false);
        for(const [name,format]of [['opaque',this.format],['accum','rgba16float'],['reveal','rgba16float']]){const active=name==='opaque'||transparent;tex(name,format,1,active?width:1,active?height:1);if(active)tex(name+'MS',format,4);}
        tex('finalMS',this.format,4);
        for(const name of ['opaque','accum'])this.frameGroups[name]=d.createBindGroup({layout:this.pipelines[name].getBindGroupLayout(1),entries:[{binding:0,resource:this.textures.normal.createView()},{binding:1,resource:this.textures.shadow.createView()}]});
        this.frameGroups.composite=d.createBindGroup({layout:this.pipelines.composite.getBindGroupLayout(1),entries:[{binding:2,resource:this.textures.opaque.createView()},{binding:3,resource:this.textures.accum.createView()},{binding:4,resource:this.textures.reveal.createView()}]});this.shadowKey=null;
    }
    draw(frame,{shadows=false,ao=false,shadowKey='',transparent=false}={}){
        this.lastPassCount=2+(transparent?2:0)+(ao?1:0)+(shadows&&this.shadowKey!==shadowKey?1:0);
        const d=this.device;d.queue.writeBuffer(this.uniform,0,frame);const encoder=d.createCommandEncoder(),t=this.textures;
        const depth=(name,clear)=>({view:t[name].createView(),depthClearValue:1,depthLoadOp:clear?'clear':'load',depthStoreOp:'store'});
        const color=(name,clear)=>({view:t[name+'MS'].createView(),resolveTarget:t[name].createView(),clearValue:clear,loadOp:'clear',storeOp:'discard'});
        const bind=(pass,name)=>{pass.setPipeline(this.pipelines[name]);pass.setBindGroup(0,this.groups[name]);if(this.frameGroups[name])pass.setBindGroup(1,this.frameGroups[name]);};
        const geometry=(pass,name)=>{bind(pass,name);pass.setVertexBuffer(0,this.buffers[0]);pass.draw(this.counts[0]);};
        if(shadows&&this.shadowKey!==shadowKey){const p=encoder.beginRenderPass({colorAttachments:[],depthStencilAttachment:depth('shadow',true)});geometry(p,'shadow');p.end();this.shadowKey=shadowKey;}
        if(ao){const p=encoder.beginRenderPass({colorAttachments:[{view:t.normal.createView(),clearValue:[0,0,0,0],loadOp:'clear',storeOp:'store'}],depthStencilAttachment:depth('normalDepth',true)});geometry(p,'normal');p.end();}
        {const p=encoder.beginRenderPass({colorAttachments:[color('opaque',[0,0,0,1])],depthStencilAttachment:depth('depth',true)});bind(p,'background');p.draw(3);geometry(p,'opaque');p.end();}
        if(transparent)for(const name of ['accum','reveal']){const p=encoder.beginRenderPass({colorAttachments:[color(name,name==='accum'?[0,0,0,0]:[1,1,1,1])],depthStencilAttachment:depth('depth',false)});if(transparent)geometry(p,name);p.end();}
        {const p=encoder.beginRenderPass({colorAttachments:[{view:t.finalMS.createView(),resolveTarget:this.context.getCurrentTexture().createView(),loadOp:'clear',clearValue:[0,0,0,1],storeOp:'discard'}],depthStencilAttachment:depth('depth',false)});bind(p,'composite');p.draw(3);
            for(const name of ['visible','hidden']){if(name==='hidden'&&frame[63]<.5)continue;bind(p,name);p.setVertexBuffer(0,this.buffers[1]);p.draw(6,this.counts[1]);}p.end();}
        d.queue.submit([encoder.finish()]);
    }
    /** Copy before presentation; map asynchronously after the swapchain texture expires. */
    async readPixels(){
        const d=this.device,texture=this.context.getCurrentTexture(),width=this.width,height=this.height;
        const bytesPerRow=Math.ceil(width*4/256)*256;
        const buffer=d.createBuffer({size:bytesPerRow*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
        try{
            const encoder=d.createCommandEncoder();
            encoder.copyTextureToBuffer({texture},{buffer,bytesPerRow,rowsPerImage:height},[width,height]);
            d.queue.submit([encoder.finish()]);await buffer.mapAsync(GPUMapMode.READ);
            const mapped=new Uint8Array(buffer.getMappedRange()),pixels=new Uint8ClampedArray(width*height*4);
            for(let y=0;y<height;y++)pixels.set(mapped.subarray(y*bytesPerRow,y*bytesPerRow+width*4),y*width*4);
            if(this.format.startsWith('bgra'))for(let i=0;i<pixels.length;i+=4){const red=pixels[i];pixels[i]=pixels[i+2];pixels[i+2]=red;}
            buffer.unmap();return {width,height,pixels};
        }finally{buffer.destroy();}
    }
    dispose(){this.buffers?.forEach(b=>b.destroy());Object.values(this.textures||{}).forEach(t=>t.destroy());this.uniform?.destroy();this.context?.unconfigure();this.device?.destroy();}
}
