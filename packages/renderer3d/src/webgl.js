import { FRAME_FLOATS, GLSL_SURFACE_VERTEX, GLSL_SURFACE_FRAGMENT, GLSL_FULLSCREEN_VERTEX, GLSL_FULLSCREEN_FRAGMENT, GLSL_EDGE_VERTEX, GLSL_EDGE_FRAGMENT } from './shaders.js';
const define=(source,key,value)=>source.replace('#version 300 es',`#version 300 es\n#define ${key} ${value}`);
export class GLDisplayRenderer {
    initialize(canvas) {
        const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,preserveDrawingBuffer:true});if(!gl)throw new Error('WebGL2 context unavailable');this.gl=gl;this.maxDimension=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
        if(!gl.getExtension('EXT_color_buffer_float'))throw new Error('WebGL2 floating color attachments unavailable; software visual styles required');
        this.programs={};this.samplers={};this.textures={};this.framebuffers={};this.renderbuffers=[];this.buffers=[];this.vaos=[];
        const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(message);}return s;};
        const program=(name,vs,fs)=>{const v=compile(gl.VERTEX_SHADER,vs),f=compile(gl.FRAGMENT_SHADER,fs),p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));const index=gl.getUniformBlockIndex(p,'FrameBlock');if(index!==gl.INVALID_INDEX)gl.uniformBlockBinding(p,index,0);this.programs[name]=p;this.samplers[name]=Object.entries({normalDepth:'normal',shadowDepth:'shadow',opaqueImage:'opaque',accumulation:'accum',revealage:'reveal'}).map(([u,t])=>({location:gl.getUniformLocation(p,u),texture:t})).filter(s=>s.location!==null);};
        for(const [name,pass]of [['opaque',0],['normal',1],['shadow',2],['accum',3],['reveal',4]]) program(name,GLSL_SURFACE_VERTEX.replace('PROJECTION',name==='shadow'?'f.shadowMatrix':'f.matrix'),define(GLSL_SURFACE_FRAGMENT,'PASS',pass));
        program('background',GLSL_FULLSCREEN_VERTEX,define(GLSL_FULLSCREEN_FRAGMENT,'COMPOSITE',0));program('composite',GLSL_FULLSCREEN_VERTEX,define(GLSL_FULLSCREEN_FRAGMENT,'COMPOSITE',1));
        program('visible',GLSL_EDGE_VERTEX,define(GLSL_EDGE_FRAGMENT,'HIDDEN',0));program('hidden',GLSL_EDGE_VERTEX,define(GLSL_EDGE_FRAGMENT,'HIDDEN',1));
        this.uniform=gl.createBuffer();gl.bindBuffer(gl.UNIFORM_BUFFER,this.uniform);gl.bufferData(gl.UNIFORM_BUFFER,FRAME_FLOATS*4,gl.DYNAMIC_DRAW);gl.bindBufferBase(gl.UNIFORM_BUFFER,0,this.uniform);
        for(const [i,sizes]of [[0,[3,3,3,3,4,1]],[1,[3,3,3,3,4,1,4]]]){const vao=gl.createVertexArray(),buffer=gl.createBuffer();this.vaos.push(vao);this.buffers.push(buffer);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);let offset=0;const stride=sizes.reduce((a,b)=>a+b,0)*4;for(let at=0;at<sizes.length;at++){gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,sizes[at],gl.FLOAT,false,stride,offset);gl.vertexAttribDivisor(at,i);offset+=sizes[at]*4;}}
        this.emptyVAO=gl.createVertexArray();
        const supported=gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES);this.samples=supported.includes(4)?4:1;
    }
    upload(data){const gl=this.gl;data.forEach((a,i)=>{gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers[i]);gl.bufferData(gl.ARRAY_BUFFER,a,gl.STATIC_DRAW);});this.counts=[data[0].length/17,data[1].length/21];}
    clearTargets(){const gl=this.gl;Object.values(this.textures||{}).forEach(t=>gl.deleteTexture(t));Object.values(this.framebuffers||{}).forEach(f=>gl.deleteFramebuffer(f));this.renderbuffers?.forEach(b=>gl.deleteRenderbuffer(b));this.textures={};this.framebuffers={};this.renderbuffers=[];}
    resize(width,height,{ao=false,transparent=false,shadows=false}={}){const key=[width,height,ao,transparent,shadows].join(':');if(this.targetKey===key)return;this.targetKey=key;this.width=width;this.height=height;const gl=this.gl;this.clearTargets();
        const check=()=>{const status=gl.checkFramebufferStatus(gl.FRAMEBUFFER);if(status!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Incomplete 3D framebuffer: '+status);};
        const tex=(name,format,w=width,h=height)=>{const t=gl.createTexture();this.textures[name]=t;gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texStorage2D(gl.TEXTURE_2D,1,format,w,h);return t;};
        const fb=(name)=>{const f=gl.createFramebuffer();this.framebuffers[name]=f;gl.bindFramebuffer(gl.FRAMEBUFFER,f);return f;};
        const rb=(format,samples=this.samples,w=width,h=height)=>{const r=gl.createRenderbuffer();this.renderbuffers.push(r);gl.bindRenderbuffer(gl.RENDERBUFFER,r);if(samples>1)gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,format,w,h);else gl.renderbufferStorage(gl.RENDERBUFFER,format,w,h);return r;};
        tex('shadow',gl.DEPTH_COMPONENT24,shadows?1024:1,shadows?1024:1);fb('shadow');gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.textures.shadow,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);check();
        tex('normal',gl.RGBA16F,ao?width:1,ao?height:1);fb('normal');gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.textures.normal,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb(gl.DEPTH_COMPONENT24,1,ao?width:1,ao?height:1));check();
        const depth=rb(gl.DEPTH_COMPONENT24);
        for(const [name,format]of [['opaque',gl.RGBA8],['accum',gl.RGBA16F],['reveal',gl.RGBA16F],['final',gl.RGBA8]]){
            const active=transparent||!['accum','reveal'].includes(name);tex(name,format,active?width:1,active?height:1);if(!active)continue;fb(name+'Resolved');gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.textures[name],0);check();
            fb(name);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,rb(format));gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);check();
        }
        this.shadowKey=null;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
    draw(frame,{shadows=false,ao=false,shadowKey='',transparent=false}={}){
        this.lastPassCount=2+(transparent?2:0)+(ao?1:0)+(shadows&&this.shadowKey!==shadowKey?1:0);
        const gl=this.gl;if(gl.isContextLost())return;
        gl.bindBuffer(gl.UNIFORM_BUFFER,this.uniform);gl.bufferSubData(gl.UNIFORM_BUFFER,0,frame);gl.bindBufferBase(gl.UNIFORM_BUFFER,0,this.uniform);
        const use=name=>{gl.useProgram(this.programs[name]);this.samplers[name].forEach((s,unit)=>{gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,this.textures[s.texture]);gl.uniform1i(s.location,unit);});};
        const surface=name=>{use(name);gl.bindVertexArray(this.vaos[0]);gl.drawArrays(gl.TRIANGLES,0,this.counts[0]);};
        const full=name=>{use(name);gl.bindVertexArray(this.emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3);};
        const bind=(name,clear,depth=false,w=this.width,h=this.height)=>{gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffers[name]);gl.viewport(0,0,w,h);if(clear)gl.clearColor(...clear);gl.depthMask(depth);gl.clear((clear?gl.COLOR_BUFFER_BIT:0)|(depth?gl.DEPTH_BUFFER_BIT:0));};
        const resolve=name=>{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,this.framebuffers[name]);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,this.framebuffers[name+'Resolved']);gl.blitFramebuffer(0,0,this.width,this.height,0,0,this.width,this.height,gl.COLOR_BUFFER_BIT,gl.NEAREST);};
        gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.disable(gl.SCISSOR_TEST);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearDepth(1);
        if(shadows&&this.shadowKey!==shadowKey){bind('shadow',null,true,1024,1024);surface('shadow');this.shadowKey=shadowKey;}
        if(ao){bind('normal',[0,0,0,0],true);surface('normal');}
        bind('opaque',[0,0,0,1],true);gl.depthFunc(gl.ALWAYS);gl.depthMask(false);full('background');gl.depthFunc(gl.LEQUAL);gl.depthMask(true);surface('opaque');resolve('opaque');
        if(transparent)for(const name of ['accum','reveal']){bind(name,name==='accum'?[0,0,0,0]:[1,1,1,1],false);if(transparent){gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);if(name==='accum')gl.blendFunc(gl.ONE,gl.ONE);else gl.blendFunc(gl.ZERO,gl.ONE_MINUS_SRC_ALPHA);surface(name);gl.disable(gl.BLEND);}resolve(name);}
        bind('final',[0,0,0,1],false);gl.depthFunc(gl.ALWAYS);full('composite');gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
        for(const name of ['visible','hidden']){if(name==='hidden'&&frame[63]<.5)continue;gl.depthFunc(name==='hidden'?gl.GREATER:gl.LEQUAL);use(name);gl.bindVertexArray(this.vaos[1]);gl.drawArraysInstanced(gl.TRIANGLES,0,6,this.counts[1]);}
        gl.disable(gl.BLEND);gl.depthMask(true);resolve('final');gl.bindFramebuffer(gl.READ_FRAMEBUFFER,this.framebuffers.finalResolved);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);gl.blitFramebuffer(0,0,this.width,this.height,0,0,this.width,this.height,gl.COLOR_BUFFER_BIT,gl.NEAREST);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
    dispose(){if(!this.gl)return;this.clearTargets();const gl=this.gl;this.buffers?.forEach(b=>gl.deleteBuffer(b));this.vaos?.forEach(v=>gl.deleteVertexArray(v));gl.deleteVertexArray(this.emptyVAO);Object.values(this.programs||{}).forEach(p=>gl.deleteProgram(p));gl.deleteBuffer(this.uniform);}
}
