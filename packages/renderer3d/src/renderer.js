import { rasterizeScene } from './software.js';
import { V3, sub3, dot3, unit3, lerp3 } from '@conduitcad/geometry3d';
import { OrbitCamera } from './camera.js';
import { buildScene3D, pick3D } from './scene.js';
const light = unit3(V3(-.3, -.6, 1));
const rgb = (color) => { const value = /^#[0-9a-f]{6}$/i.test(color) ? parseInt(color.slice(1), 16) : 0x648596; return [(value >> 16) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]; };
const shade = (t, selected) => { const c = rgb(selected ? '#f0b359' : t.color), a = .45 + .55 * Math.max(0, dot3(t.normal, light)); return [...c.map(x => x * a), 1]; };
const css = values => `rgb(${values.slice(0, 3).map(x => Math.round(x * 255)).join(' ')})`;
const WGSL = `struct Frame { matrix: mat4x4<f32>, section: vec4<f32> };
@group(0) @binding(0) var<uniform> frame: Frame;
struct VertexOut { @builtin(position) position: vec4<f32>, @location(0) color: vec4<f32>, @location(1) world: vec3<f32> };
@vertex fn vs(@location(0) position: vec3<f32>, @location(1) color: vec4<f32>) -> VertexOut {
var output: VertexOut; let p=frame.matrix*vec4<f32>(position,1.0);
output.position=vec4<f32>(p.xy,(p.z+p.w)*0.5,p.w);output.color=color;output.world=position;return output;
}
@fragment fn fs(input:VertexOut)->@location(0) vec4<f32> {
if(dot(input.world,frame.section.xyz)>frame.section.w){discard;}return input.color;
}`;
const VS = `#version 300 es
precision highp float;layout(location=0)in vec3 position;layout(location=1)in vec4 color;uniform mat4 matrix;out vec4 vColor;out vec3 world;void main(){gl_Position=matrix*vec4(position,1.);vColor=color;world=position;}`;
const FS = `#version 300 es
precision highp float;in vec4 vColor;in vec3 world;uniform vec4 section;out vec4 outputColor;void main(){if(dot(world,section.xyz)>section.w)discard;outputColor=vColor;}`;
export class SpatialRenderer {
    constructor(host, { backend = 'auto', camera = new OrbitCamera(), onStatus = () => { } } = {}) {
        if (!host)
            throw new Error('3D renderer requires a host');
        this.host = host;
        this.requestedBackend = backend;
        this.camera = camera;
        this.onStatus = onStatus;
        this.selection = new Set();
        this.selectedFace = null;
        this.style = 'shaded-edges';
        this.section = null;
        this.active = true;
        this.pending = 0;
        this.uploads = 0;
        this.makeCanvas();
        this.overlay = document.createElement('canvas');
        this.overlay.className = 'model3d-labels';
        host.append(this.overlay);
        this.overlay.style.pointerEvents = 'none';
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(host);
        this.ready = this.initialize(backend);
        this.scene = buildScene3D({ entities: [], layers: [], blocks: {} });
    }
    makeCanvas() { this.canvas?.remove(); this.canvas = document.createElement('canvas'); this.canvas.className = 'model3d-render'; this.host.prepend(this.canvas); }
    async initialize(backend) {
        if (!['auto', 'webgpu', 'webgl2', 'canvas'].includes(backend))
            throw new Error('Unknown 3D backend');
        const reasons = [];
        if (backend === 'auto' || backend === 'webgpu')
            try {
                await this.initGPU();
                if (this.disposed) {
                    this.device?.destroy();
                    return;
                }
                this.backend = 'WebGPU';
            }
            catch (error) {
                reasons.push(error.message);
                this.device?.destroy();
                this.device = null;
                this.makeCanvas();
            }
        if (!this.backend && backend !== 'canvas')
            try {
                this.initGL();
                this.backend = 'WebGL2';
            }
            catch (error) {
                reasons.push(error.message);
                this.gl = null;
                this.makeCanvas();
            }
        if (!this.backend) {
            this.ctx = this.canvas.getContext('2d');
            this.backend = 'Canvas 2D · software depth buffer';
        }
        this.fallbackReasons = reasons;
        this.onStatus({ backend: this.backend, requested: backend, fallback: backend !== 'auto' && !this.backend.toLowerCase().startsWith(backend), reasons });
        this.resize();
        this.upload();
        this.invalidate();
    }
    async initGPU() {
        if (!navigator.gpu)
            throw new Error('WebGPU API is unavailable');
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter)
            throw new Error('No WebGPU adapter');
        this.adapterInfo = { vendor: adapter.info?.vendor, architecture: adapter.info?.architecture, device: adapter.info?.device, description: adapter.info?.description };
        const d = await adapter.requestDevice();
        this.device = d;
        const context = this.canvas.getContext('webgpu');
        if (!context)
            throw new Error('WebGPU canvas unavailable');
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device: d, format, alphaMode: 'opaque' });
        this.gpuContext = context;
        this.gpuFormat = format;
        d.pushErrorScope('validation');
        const module = d.createShaderModule({ code: WGSL }), layout = d.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }] }), pipelineLayout = d.createPipelineLayout({ bindGroupLayouts: [layout] });
        const descriptor = { layout: pipelineLayout, vertex: { module, entryPoint: 'vs', buffers: [{ arrayStride: 28, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x4' }] }] }, fragment: { module, entryPoint: 'fs', targets: [{ format }] }, multisample: { count: 4 } };
        this.trianglePipeline = await d.createRenderPipelineAsync({ ...descriptor, primitive: { topology: 'triangle-list', cullMode: 'none' }, depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less-equal', depthBias: 1 } });
        this.linePipeline = await d.createRenderPipelineAsync({ ...descriptor, primitive: { topology: 'line-list' }, depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less-equal' } });
        const error = await d.popErrorScope();
        if (error)
            throw new Error(error.message);
        this.uniform = d.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.bindGroup = d.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: this.uniform } }] });
        d.lost.then(info => { if (this.disposed || this.device !== d)
            return; this.backend = null; this.device = null; this.gpuBuffers?.forEach(b => b.destroy()); this.makeCanvas(); this.initialize('webgl2').then(() => this.onStatus({ backend: this.backend, reasons: ['WebGPU device lost: ' + info.reason], fallback: true })); });
    }
    initGL() {
        const gl = this.canvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: true });
        if (!gl)
            throw new Error('WebGL2 context unavailable');
        this.gl = gl;
        const compile = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
            throw new Error(gl.getShaderInfoLog(s)); return s; };
        const vertex = compile(gl.VERTEX_SHADER, VS), fragment = compile(gl.FRAGMENT_SHADER, FS), program = gl.createProgram();
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
            throw new Error(gl.getProgramInfoLog(program));
        this.program = program;
        this.glMatrix = gl.getUniformLocation(program, 'matrix');
        this.glSection = gl.getUniformLocation(program, 'section');
        this.glBuffers = [gl.createBuffer(), gl.createBuffer()];
        this.vao = gl.createVertexArray();
        this.glLifecycle?.abort();
        this.glLifecycle = new AbortController();
        this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (this.disposed)
            return; this.onStatus({ backend: 'WebGL2 context lost', fallback: true, reasons: ['Context loss; restoring on browser signal'] }); }, { signal: this.glLifecycle.signal });
        this.canvas.addEventListener('webglcontextrestored', () => { if (this.disposed)
            return; this.initGL(); this.upload(); this.resize(); }, { signal: this.glLifecycle.signal });
    }
    resize() {
        if (this.disposed)
            return;
        const r = this.host.getBoundingClientRect();
        if (r.width < 1 || r.height < 1)
            return;
        const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(6000000 / (r.width * r.height))), width = Math.round(r.width * dpr), height = Math.round(r.height * dpr);
        this.camera.resize(r.width, r.height);
        this.dpr = dpr;
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.overlay.width = width;
            this.overlay.height = height;
            this.depth?.destroy();
            this.multisample?.destroy();
            this.depth = null;
            this.multisample = null;
        }
        if (this.device && !this.depth) {
            this.depth = this.device.createTexture({ size: [width, height], sampleCount: 4, format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
            this.multisample = this.device.createTexture({ size: [width, height], sampleCount: 4, format: this.gpuFormat, usage: GPUTextureUsage.RENDER_ATTACHMENT });
        }
        this.invalidate();
    }
    setDocument(doc, options = {}) { this.document = doc; this.scene = buildScene3D(doc, options); this.upload(); this.invalidate(); }
    setSelection(ids, face = null) { this.selection = new Set(ids); this.selectedFace = face; this.upload(); this.invalidate(); }
    upload() {
        if (!this.scene || !this.backend)
            return;
        const vertices = [], edges = [], origin = this.scene.origin;
        const push = (array, p, c) => { const q = sub3(p, origin); array.push(q.x, q.y, q.z, ...c); };
        for (const t of this.scene.triangles) {
            const selected = this.selection.has(t.id) && (!this.selectedFace || this.selectedFace.face === t.face), color = shade(t, selected);
            for (const p of t.vertices)
                push(vertices, p, color);
        }
        for (const line of this.scene.lines) {
            if (line.edge && (this.style === 'shaded' || (this.style === 'shaded-edges' && line.coplanar)))
                continue;
            const selected = this.selection.has(line.id), color = [...rgb(selected ? '#db861e' : line.edge ? '#344d58' : line.color), 1];
            push(edges, line.a, color);
            push(edges, line.b, color);
        }
        // A finite world grid is display-only and never enters the DXF document.
        const size = Math.max(this.scene.bounds.empty ? 100 : Math.max(this.scene.bounds.max.x - this.scene.bounds.min.x, this.scene.bounds.max.y - this.scene.bounds.min.y) * 1.4, 100), step = 10 ** Math.floor(Math.log10(size / 12)), extent = Math.min(25, Math.ceil(size / step));
        for (let i = -extent; i <= extent; i++) {
            const c = [.77, .82, .82, 1], x = origin.x + i * step, y = origin.y + i * step;
            push(edges, V3(x, origin.y - extent * step, 0), c);
            push(edges, V3(x, origin.y + extent * step, 0), c);
            push(edges, V3(origin.x - extent * step, y, 0), c);
            push(edges, V3(origin.x + extent * step, y, 0), c);
        }
        this.data = [new Float32Array(vertices), new Float32Array(edges)];
        this.counts = this.data.map(d => d.length / 7);
        this.uploads++;
        if (this.device) {
            this.gpuBuffers?.forEach(b => b.destroy());
            this.gpuBuffers = this.data.map(a => { const b = this.device.createBuffer({ size: Math.max(4, a.byteLength), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }); if (a.byteLength)
                this.device.queue.writeBuffer(b, 0, a); return b; });
        }
        if (this.gl) {
            this.data.forEach((a, i) => { this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.glBuffers[i]); this.gl.bufferData(this.gl.ARRAY_BUFFER, a, this.gl.STATIC_DRAW); });
        }
    }
    invalidate() { if (this.disposed || this.pending || !this.active)
        return; this.pending = requestAnimationFrame(() => { this.pending = 0; this.draw(); }); }
    frameData() { const origin = this.scene.origin, s = this.section; return new Float32Array([...this.camera.matrix(origin), ...(s ? [s.normal.x, s.normal.y, s.normal.z, s.offset - dot3(origin, s.normal)] : [0, 0, 0, 1])]); }
    draw() {
        if (!this.backend || this.disposed || !this.active || !this.data)
            return;
        const start = performance.now(), data = this.frameData();
        if (this.device && this.depth) {
            const d = this.device;
            d.queue.writeBuffer(this.uniform, 0, data);
            const encoder = d.createCommandEncoder(), pass = encoder.beginRenderPass({ colorAttachments: [{ view: this.multisample.createView(), resolveTarget: this.gpuContext.getCurrentTexture().createView(), clearValue: { r: .94, g: .96, b: .96, a: 1 }, loadOp: 'clear', storeOp: 'discard' }], depthStencilAttachment: { view: this.depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' } });
            pass.setBindGroup(0, this.bindGroup);
            for (let i = 0; i < 2; i++) {
                if (i === 0 && this.style === 'wireframe')
                    continue;
                pass.setPipeline(i ? this.linePipeline : this.trianglePipeline);
                pass.setVertexBuffer(0, this.gpuBuffers[i]);
                pass.draw(this.counts[i]);
            }
            pass.end();
            d.queue.submit([encoder.finish()]);
        }
        else if (this.gl) {
            const gl = this.gl;
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            gl.clearColor(.94, .96, .96, 1);
            gl.clearDepth(1);
            gl.depthMask(true);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(gl.LEQUAL);
            gl.useProgram(this.program);
            gl.bindVertexArray(this.vao);
            gl.uniformMatrix4fv(this.glMatrix, false, data.subarray(0, 16));
            gl.uniform4fv(this.glSection, data.subarray(16));
            for (let i = 0; i < 2; i++) {
                if (i === 0 && this.style === 'wireframe')
                    continue;
                gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffers[i]);
                gl.enableVertexAttribArray(0);
                gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
                gl.enableVertexAttribArray(1);
                gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
                gl.depthMask(i === 0);
                if (i === 0) {
                    gl.enable(gl.POLYGON_OFFSET_FILL);
                    gl.polygonOffset(1, 1);
                }
                else
                    gl.disable(gl.POLYGON_OFFSET_FILL);
                gl.drawArrays(i ? gl.LINES : gl.TRIANGLES, 0, this.counts[i]);
            }
            gl.depthMask(true);
        }
        else
            this.drawCanvas();
        this.drawLabels();
        this.stats = { backend: this.backend, triangles: this.scene.triangles.length, segments: this.scene.lines.length, frameMs: performance.now() - start, uploads: this.uploads };
        this.onFrame?.(this.stats);
    }
    drawCanvas() {
        const scale = Math.min(1, Math.sqrt(1200000 / (this.canvas.width * this.canvas.height))), width = Math.max(1, Math.round(this.canvas.width * scale)), height = Math.max(1, Math.round(this.canvas.height * scale));
        const image = rasterizeScene(this.scene, this.camera, { width, height, style: this.style, section: this.section, selection: this.selection, selectedFace: this.selectedFace, shade, rgb });
        this.softwareFrame = image;
        if (!this.softwareCanvas)
            this.softwareCanvas = document.createElement('canvas');
        if (this.softwareCanvas.width !== width || this.softwareCanvas.height !== height) {
            this.softwareCanvas.width = width;
            this.softwareCanvas.height = height;
        }
        this.softwareCanvas.getContext('2d').putImageData(new ImageData(image.pixels, width, height), 0, 0);
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.drawImage(this.softwareCanvas, 0, 0, this.canvas.width, this.canvas.height);
    }
    drawLabels() { const ctx = this.overlay.getContext('2d'), dpr = this.dpr || 1; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, this.camera.width, this.camera.pixelHeight); ctx.font = '12px system-ui'; for (const label of this.scene.labels) {
        const p = this.camera.project(label.p);
        if (!p.visible)
            continue;
        ctx.fillStyle = label.color;
        ctx.fillText(label.text.slice(0, 160), p.x, p.y);
    } if (this.marker) {
        const p = this.camera.project(this.marker);
        if (p.visible) {
            ctx.fillStyle = '#dd8a1f';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    } this.drawOverlay?.(ctx, this.camera); }
    pick(x, y, options = {}) { return pick3D(this.scene, this.camera, x, y, { section: this.section, ...options }); }
    fit() { this.camera.fit(this.scene.points); this.invalidate(); }
    dispose() { this.disposed = true; this.glLifecycle?.abort(); cancelAnimationFrame(this.pending); this.observer.disconnect(); this.gpuBuffers?.forEach(b => b.destroy()); this.depth?.destroy(); this.multisample?.destroy(); this.uniform?.destroy(); this.device?.destroy(); if (this.gl) {
        this.glBuffers.forEach(b => this.gl.deleteBuffer(b));
        this.gl.deleteVertexArray(this.vao);
        this.gl.deleteProgram(this.program);
    } this.canvas.remove(); this.overlay.remove(); }
}
