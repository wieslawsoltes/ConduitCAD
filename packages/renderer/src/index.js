import { bounds, union, emptyBounds, intersects, distance, validBounds, center, clamp } from '@conduitcad/geometry';
import { entityGeometry, entityBounds, isVisible, documentBounds, textLayout } from '@conduitcad/model';
import { SpatialIndex } from '@conduitcad/spatial';
export class Camera {
    constructor() { this.x = 560; this.y = 340; this.scale = 1; this.width = 1000; this.height = 700; }
    world(p) { return { x: (p.x - this.width / 2) / this.scale + this.x, y: -(p.y - this.height / 2) / this.scale + this.y }; }
    screen(p) { return { x: (p.x - this.x) * this.scale + this.width / 2, y: -(p.y - this.y) * this.scale + this.height / 2 }; }
    zoom(factor, anchor = { x: this.width / 2, y: this.height / 2 }) { const p = this.world(anchor); this.scale = clamp(this.scale * factor, .00001, 5000); const after = this.world(anchor); this.x += p.x - after.x; this.y += p.y - after.y; }
    pan(dx, dy) { this.x -= dx / this.scale; this.y += dy / this.scale; }
    fit(b, padding = 75) {
        if (!validBounds(b))
            return;
        const c = center(b);
        this.x = c.x;
        this.y = c.y;
        this.scale = clamp(Math.min(Math.max(40, this.width - padding * 2) / Math.max(1, b.maxX - b.minX), Math.max(40, this.height - padding * 2) / Math.max(1, b.maxY - b.minY)), .00001, 5000);
    }
    get viewport() { return { minX: this.x - this.width / 2 / this.scale, minY: this.y - this.height / 2 / this.scale, maxX: this.x + this.width / 2 / this.scale, maxY: this.y + this.height / 2 / this.scale }; }
}
export function colorRGBA(hex, alpha = 1) {
    if (!/^#[0-9a-f]{6}$/i.test(hex || ''))
        hex = '#344755';
    return [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255, alpha];
}
function segmentCount(path) { if (path.stroke === false || path.points.length < 2) return 0; return path.points.length - 1 + (path.closed && distance(path.points[0], path.points.at(-1)) > 1e-7 ? 1 : 0); }
function writeStrokeData(data, paths, origin, offset = 0) {
    let k = offset * 16;
    for (const p of paths) {
        const rgba = colorRGBA(p.color, p.opacity), pts = p.points;
        let phase = p.dashPhase || 0;
        const n = segmentCount(p);
        for (let i = 0; i < n; i++) {
            const a = pts[i], z = pts[(i + 1) % pts.length];
            data.set([a.x - origin.x, a.y - origin.y, z.x - origin.x, z.y - origin.y, ...rgba, p.width || 1.5, p.dash?.[0] || 0, p.dash?.[1] || 0, phase, p.dash?.[2] || 0, p.dash?.[3] || 0, p.dash?.[4] || 0, p.dash?.[5] || 0], k);
            k += 16;
            phase += distance(a, z);
        }
    }
}
export function buildScene(doc, { tolerance = .25, origin = null, view = null } = {}) {
    const paths = [], texts = [], items = [], diagnostics = [], spans = new Map(), entities = new Map();
    let b = emptyBounds(), count = 0;
    const started = performance.now();
    for (const e of doc.entities) {
        if (!isVisible(e, doc))
            continue;
        const g = entityGeometry(e, doc, { tolerance, view }), span = { pathStart: paths.length, pathCount: g.paths.length, textStart: texts.length, textCount: g.texts.length, offset: count, count: 0, itemIndex: -1 };
        diagnostics.push(...(g.warnings || []));
        for (const path of g.paths) {
            paths.push(path);
            count += segmentCount(path);
        }
        for (const text of g.texts)
            texts.push(text);
        span.count = count - span.offset;
        const bb = entityBounds(e, doc);
        if (validBounds(bb)) {
            span.itemIndex = items.length;
            items.push({ ...bb, id: e.id, entity: e });
            b = union(b, bb);
        }
        spans.set(e.id, span);
        entities.set(e.id, e);
    }
    origin = origin || (validBounds(b) ? center(b) : { x: 0, y: 0 });
    const data = new Float32Array(count * 16);
    writeStrokeData(data, paths, origin);
    return { paths, texts, items, diagnostics, hasInfinite: doc.entities.some(e => ['RAY', 'XLINE'].includes(e.type)), spans, entities, index: new SpatialIndex(items), bounds: b, origin, data, count, buildMs: performance.now() - started };
}
/** Patch equal-topology edits in place. A null result requests a full rebuild. */
export function updateSceneEntities(scene, doc, ids, { tolerance = .25 } = {}) {
    const requested = new Set(ids), replacements = [];
    for (const e of doc.entities) {
        if (!requested.has(e.id))
            continue;
        const span = scene.spans.get(e.id);
        if (!span || !isVisible(e, doc))
            return null;
        const g = entityGeometry(e, doc, { tolerance }), count = g.paths.reduce((n, p) => n + segmentCount(p), 0);
        if (span.count !== count || span.pathCount !== g.paths.length || span.textCount !== g.texts.length)
            return null;
        const bb = entityBounds(e, doc);
        if (validBounds(bb) !== (span.itemIndex >= 0))
            return null;
        replacements.push({ e, span, g, bb });
    }
    if (replacements.length !== requested.size)
        return null;
    const ranges = [], items = [];
    for (const { e, span, g, bb } of replacements) {
        for (let i = 0; i < g.paths.length; i++)
            scene.paths[span.pathStart + i] = g.paths[i];
        for (let i = 0; i < g.texts.length; i++)
            scene.texts[span.textStart + i] = g.texts[i];
        writeStrokeData(scene.data, g.paths, scene.origin, span.offset);
        scene.entities.set(e.id, e);
        if (span.itemIndex >= 0) {
            const item = { ...bb, id: e.id, entity: e };
            scene.items[span.itemIndex] = item;
            items.push(item);
            scene.bounds = union(scene.bounds, bb);
        }
        if (span.count)
            ranges.push({ offset: span.offset, count: span.count });
    }
    if (items.length)
        scene.index.update(items);
    return ranges;
}
const WGSL_COMMON = `
struct Segment { ab:vec4f, color:vec4f, style:vec4f, dash:vec4f };
struct View { camera:vec2f, viewport:vec2f, scale:f32, ratio:f32, count:u32, pad:f32 };
@group(0) @binding(0) var<storage,read> segments:array<Segment>;
@group(0) @binding(1) var<uniform> view:View;
`;
export const CULL_SHADER = WGSL_COMMON + `
struct Args { vertices:u32, instances:atomic<u32>, firstVertex:u32, firstInstance:u32 };
@group(0) @binding(2) var<storage,read_write> indices:array<u32>;
@group(0) @binding(3) var<storage,read_write> args:Args;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid:vec3u) {
 let id=gid.x; if(id>=view.count){return;}
 let s=segments[id]; let a=(s.ab.xy-view.camera)*vec2f(view.scale,-view.scale)+view.viewport*.5;
 let b=(s.ab.zw-view.camera)*vec2f(view.scale,-view.scale)+view.viewport*.5;
 let margin=max(s.style.x,2.0)+2.0;
 if(all(max(a,b)>=vec2f(-margin)) && all(min(a,b)<=view.viewport+vec2f(margin))){let n=atomicAdd(&args.instances,1u);indices[n]=id;}
}`;
export const LINE_SHADER = WGSL_COMMON + `
@group(0) @binding(2) var<storage,read> indices:array<u32>;
struct Out { @builtin(position) position:vec4f, @location(0) local:vec2f, @location(1) @interpolate(flat) metrics:vec2f, @location(2) @interpolate(flat) color:vec4f, @location(3) @interpolate(flat) style:vec4f, @location(4) @interpolate(flat) dash:vec4f };
@vertex fn vs(@builtin(vertex_index) vertex:u32,@builtin(instance_index) instance:u32)->Out {
 let s=segments[indices[instance]];let a=(s.ab.xy-view.camera)*vec2f(view.scale,-view.scale)+view.viewport*.5;
 let b=(s.ab.zw-view.camera)*vec2f(view.scale,-view.scale)+view.viewport*.5;let delta=b-a;let len=max(length(delta),0.0001);let dir=select(vec2f(1,0),delta/len,len>0.0001);let normal=vec2f(-dir.y,dir.x);
 let halfWidth=max(s.style.x*.5,.5);let pad=halfWidth+1.0;
 let corners=array<vec2f,6>(vec2f(0,-1),vec2f(1,-1),vec2f(1,1),vec2f(0,-1),vec2f(1,1),vec2f(0,1));let corner=corners[vertex];let local=vec2f(mix(-pad,len+pad,corner.x),corner.y*pad);let pixel=a+dir*local.x+normal*local.y;
 var o:Out;o.position=vec4f(pixel/view.viewport*vec2f(2,-2)+vec2f(-1,1),0,1);o.local=local;o.metrics=vec2f(len,halfWidth);o.color=s.color;o.style=s.style;o.dash=s.dash;return o;
}
@fragment fn fs(o:Out)->@location(0) vec4f {
 let outside=length(vec2f(max(max(-o.local.x,o.local.x-o.metrics.x),0.0),o.local.y))-o.metrics.y;
 let alpha=1.0-smoothstep(-.55,.55,outside);
 if(o.style.y+o.style.z+o.dash.x+o.dash.y+o.dash.z+o.dash.w>0.0){let pattern=array<f32,6>(o.style.y,o.style.z,o.dash.x,o.dash.y,o.dash.z,o.dash.w);let cycle=o.style.y+o.style.z+o.dash.x+o.dash.y+o.dash.z+o.dash.w;var d=(max(o.local.x,0.0)/view.scale+o.style.w)%cycle;for(var i=0u;i<6u;i++){if(d<pattern[i]){if(i%2u==1u){discard;}break;}d-=pattern[i];}}
 return vec4f(o.color.rgb,o.color.a*alpha);
}`;
class GPUBackend {
    constructor(canvas, onLost) { this.canvas = canvas; this.onLost = onLost; this.batches = []; this.name = 'WebGPU'; }
    async init() {
        if (!navigator.gpu)
            throw new Error('WebGPU API unavailable');
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter)
            throw new Error('No WebGPU adapter');
        this.device = await adapter.requestDevice();
        const d = this.device;
        d.lost.then(info => {
            if (!this.disposed)
                this.onLost('WebGPU device lost: ' + info.message);
        });
        d.addEventListener('uncapturederror', event => {
            if (!this.disposed)
                this.onLost('WebGPU validation: ' + event.error.message);
        });
        const compute = d.createShaderModule({ label: 'Conduit viewport culling', code: CULL_SHADER }), render = d.createShaderModule({ label: 'Conduit antialiased CAD strokes', code: LINE_SHADER });
        for (const module of [compute, render]) {
            const info = await module.getCompilationInfo();
            const errors = info.messages.filter(m => m.type === 'error');
            if (errors.length)
                throw new Error(errors.map(e => e.message).join('; '));
        }
        this.format = navigator.gpu.getPreferredCanvasFormat();
        this.compute = await d.createComputePipelineAsync({ layout: 'auto', compute: { module: compute, entryPoint: 'main' } });
        this.render = await d.createRenderPipelineAsync({ layout: 'auto', vertex: { module: render, entryPoint: 'vs' }, fragment: { module: render, entryPoint: 'fs', targets: [{ format: this.format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } }] }, primitive: { topology: 'triangle-list' } });
        this.context = this.canvas.getContext('webgpu');
        if (!this.context)
            throw new Error('GPU canvas context unavailable');
        this.context.configure({ device: d, format: this.format, alphaMode: 'premultiplied' });
        return this;
    }
    upload(scene) {
        const d = this.device;
        this.clear();
        this.scene = scene;
        const limit = Math.min(200000, Math.floor(d.limits.maxStorageBufferBindingSize / 64), d.limits.maxComputeWorkgroupsPerDimension * 64);
        for (let first = 0; first < scene.count; first += limit) {
            const count = Math.min(limit, scene.count - first), storage = d.createBuffer({ size: count * 64, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }), uniform = d.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }), indices = d.createBuffer({ size: Math.max(4, count * 4), usage: GPUBufferUsage.STORAGE }), args = d.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST });
            d.queue.writeBuffer(storage, 0, scene.data.buffer, scene.data.byteOffset + first * 64, count * 64);
            const entries = [{ binding: 0, resource: { buffer: storage } }, { binding: 1, resource: { buffer: uniform } }, { binding: 2, resource: { buffer: indices } }];
            this.batches.push({ first, count, storage, uniform, indices, args, computeGroup: d.createBindGroup({ layout: this.compute.getBindGroupLayout(0), entries: [...entries, { binding: 3, resource: { buffer: args } }] }), renderGroup: d.createBindGroup({ layout: this.render.getBindGroupLayout(0), entries }) });
        }
    }
    update(scene, ranges) {
        this.scene = scene;
        for (const range of ranges)
            for (const batch of this.batches) {
                const start = Math.max(range.offset, batch.first), end = Math.min(range.offset + range.count, batch.first + batch.count);
                if (end > start)
                    this.device.queue.writeBuffer(batch.storage, (start - batch.first) * 64, scene.data.buffer, scene.data.byteOffset + start * 64, (end - start) * 64);
            }
    }
    draw(camera, ratio) {
        const d = this.device, encoder = d.createCommandEncoder();
        for (const batch of this.batches) {
            const buffer = new ArrayBuffer(32), f = new Float32Array(buffer), u = new Uint32Array(buffer);
            f.set([camera.x - this.scene.origin.x, camera.y - this.scene.origin.y, camera.width, camera.height, camera.scale, ratio]);
            u[6] = batch.count;
            d.queue.writeBuffer(batch.uniform, 0, buffer);
            d.queue.writeBuffer(batch.args, 0, new Uint32Array([6, 0, 0, 0]));
            const pass = encoder.beginComputePass();
            pass.setPipeline(this.compute);
            pass.setBindGroup(0, batch.computeGroup);
            pass.dispatchWorkgroups(Math.ceil(batch.count / 64));
            pass.end();
        }
        const pass = encoder.beginRenderPass({ colorAttachments: [{ view: this.context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
        if (camera.clipInset > 0) { const x = Math.min(this.canvas.width - 1, Math.ceil(camera.clipInset * ratio)), y = Math.min(this.canvas.height - 1, Math.ceil(camera.clipInset * ratio)); pass.setScissorRect(x, y, this.canvas.width - x, this.canvas.height - y); }
        pass.setPipeline(this.render);
        for (const b of this.batches) {
            pass.setBindGroup(0, b.renderGroup);
            pass.drawIndirect(b.args, 0);
        }
        pass.end();
        d.queue.submit([encoder.finish()]);
    }
    clear() {
        for (const b of this.batches)
            for (const k of ['storage', 'uniform', 'indices', 'args'])
                b[k].destroy();
        this.batches = [];
    }
    dispose() { this.disposed = true; this.clear(); this.context?.unconfigure(); this.device?.destroy(); }
}
const GLSL_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec4 ab;layout(location=1) in vec4 color;layout(location=2) in vec4 style;layout(location=3) in vec4 dash;
uniform vec2 camera;uniform vec2 viewport;uniform float scale;
out vec2 local;flat out vec2 metrics;flat out vec4 col;flat out vec4 sty;flat out vec4 dsh;
void main(){vec2 a=(ab.xy-camera)*vec2(scale,-scale)+viewport*.5,b=(ab.zw-camera)*vec2(scale,-scale)+viewport*.5;vec2 delta=b-a;float len=max(length(delta),.0001);vec2 dir=len>.0001?delta/len:vec2(1,0),n=vec2(-dir.y,dir.x);float halfWidth=max(style.x*.5,.5),pad=halfWidth+1.;vec2 corners[6]=vec2[6](vec2(0,-1),vec2(1,-1),vec2(1,1),vec2(0,-1),vec2(1,1),vec2(0,1));vec2 corner=corners[gl_VertexID];local=vec2(mix(-pad,len+pad,corner.x),corner.y*pad);vec2 pixel=a+dir*local.x+n*local.y;gl_Position=vec4(pixel/viewport*vec2(2,-2)+vec2(-1,1),0,1);metrics=vec2(len,halfWidth);col=color;sty=style;dsh=dash;}`;
const GLSL_FRAGMENT = `#version 300 es
precision highp float;in vec2 local;flat in vec2 metrics;flat in vec4 col;flat in vec4 sty;flat in vec4 dsh;uniform float scale;out vec4 frag;
void main(){float outside=length(vec2(max(max(-local.x,local.x-metrics.x),0.),local.y))-metrics.y;float alpha=1.-smoothstep(-.55,.55,outside);if(sty.y+sty.z+dsh.x+dsh.y+dsh.z+dsh.w>0.){float pattern[6]=float[6](sty.y,sty.z,dsh.x,dsh.y,dsh.z,dsh.w);float cycle=sty.y+sty.z+dsh.x+dsh.y+dsh.z+dsh.w;float pos=mod(max(local.x,0.)/scale+sty.w,cycle);for(int i=0;i<6;i++){if(pos<pattern[i]){if(i%2==1)discard;break;}pos-=pattern[i];}}frag=vec4(col.rgb,col.a*alpha);}`;
class GLBackend {
    constructor(canvas, onLost) { this.canvas = canvas; this.name = 'WebGL2'; this.onLost = onLost; }
    async init() {
        const gl = this.canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true });
        if (!gl)
            throw new Error('WebGL2 unavailable');
        this.gl = gl;
        const shader = (kind, source) => {
            const s = gl.createShader(kind);
            gl.shaderSource(s, source);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
                throw new Error(gl.getShaderInfoLog(s));
            return s;
        };
        const vs = shader(gl.VERTEX_SHADER, GLSL_VERTEX), fs = shader(gl.FRAGMENT_SHADER, GLSL_FRAGMENT);
        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
            throw new Error(gl.getProgramInfoLog(this.program));
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        for (let i = 0; i < 4; i++) {
            gl.enableVertexAttribArray(i);
            gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 64, i * 16);
            gl.vertexAttribDivisor(i, 1);
        }
        this.uniforms = Object.fromEntries(['camera', 'viewport', 'scale'].map(k => [k, gl.getUniformLocation(this.program, k)]));
        this.canvas.addEventListener('webglcontextlost', e => {
            e.preventDefault();
            if (!this.disposed)
                this.onLost('WebGL context lost');
        });
        return this;
    }
    upload(scene) { this.scene = scene; this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer); this.gl.bufferData(this.gl.ARRAY_BUFFER, scene.data, this.gl.STATIC_DRAW); }
    update(scene, ranges) {
        this.scene = scene;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
        for (const r of ranges)
            this.gl.bufferSubData(this.gl.ARRAY_BUFFER, r.offset * 64, scene.data.subarray(r.offset * 16, (r.offset + r.count) * 16));
    }
    draw(camera) { const g = this.gl; g.viewport(0, 0, this.canvas.width, this.canvas.height); g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT); g.useProgram(this.program); g.bindVertexArray(this.vao); g.enable(g.BLEND); g.blendFuncSeparate(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA, g.ONE, g.ONE_MINUS_SRC_ALPHA); g.uniform2f(this.uniforms.camera, camera.x - this.scene.origin.x, camera.y - this.scene.origin.y); g.uniform2f(this.uniforms.viewport, camera.width, camera.height); g.uniform1f(this.uniforms.scale, camera.scale); g.drawArraysInstanced(g.TRIANGLES, 0, 6, this.scene.count); }
    dispose() { this.disposed = true; this.gl?.deleteBuffer(this.buffer); this.gl?.deleteProgram(this.program); this.gl?.deleteVertexArray(this.vao); }
}
class CanvasBackend {
    constructor(canvas) { this.canvas = canvas; this.name = 'Canvas 2D'; }
    async init() { this.ctx = this.canvas.getContext('2d'); return this; }
    upload(scene) { this.scene = scene; }
    draw(camera, ratio) {
        const c = this.ctx;
        c.setTransform(ratio, 0, 0, ratio, 0, 0);
        c.clearRect(0, 0, camera.width, camera.height);
        for (const p of this.scene.paths) {
            if (!intersects(bounds(p.points), camera.viewport))
                continue;
            drawPath(c, p, camera);
        }
    }
    dispose() { }
}
export function drawPath(ctx, path, camera, override = {}) {
    const points = path.points;
    if (path.stroke === false && !override.color) return;
    if (!points.length)
        return;
    ctx.beginPath();
    points.forEach((p, i) => {
        const s = camera.screen(p);
        if (i === 0)
            ctx.moveTo(s.x, s.y);
        else
            ctx.lineTo(s.x, s.y);
    });
    if (path.closed)
        ctx.closePath();
    ctx.strokeStyle = override.color || path.color || '#344755';
    ctx.lineWidth = override.width || path.width || 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash((override.dash || path.dash || []).map(v => Math.max(0, v * camera.scale)));
    ctx.lineDashOffset = -(path.dashPhase || 0) * camera.scale;
    ctx.globalAlpha = path.opacity ?? 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
}
export function drawFill(ctx, path, camera) {
    if (!path.fill) return;
    ctx.save(); ctx.beginPath();
    for (const contour of path.contours || [path.points]) {
        contour.forEach((p, i) => { const q = camera.screen(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.closePath();
    }
    ctx.fillStyle = path.fill; ctx.globalAlpha = path.opacity ?? 1; ctx.fill(path.fillRule || 'evenodd'); ctx.restore();
}
function cadFont(name) {
    const clean = String(name || '').replace(/["'\\;{}]/g, '').replace(/\.(ttf|otf)$/i, '');
    return !clean || /\.shx$|^(txt|standard)$/i.test(clean) ? 'ui-sans-serif, system-ui, sans-serif' : `"${clean}", ui-sans-serif, system-ui, sans-serif`;
}
export function drawText(ctx, t, camera) {
    const s = camera.screen(t.p), h = t.nominalHeight || t.height;
    if (!(h > 0) || !Number.isFinite(h)) return;
    ctx.save(); ctx.translate(s.x, s.y);
    if (t.frame) { const [a, b, c, d] = t.frame, z = camera.scale; ctx.transform(a * z, -b * z, -c * z, d * z, 0, 0); }
    else { ctx.rotate(-(t.rotation || 0) * Math.PI / 180); ctx.scale((t.widthFactor || 1) * camera.scale, camera.scale); }
    const setFont = (height, style) => ctx.font = `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${height}px ${cadFont(style.font || t.font)}`;
    const layout = textLayout(t, (text, height, style) => { setFont(height, style); return ctx.measureText(text).width; });
    ctx.globalAlpha = t.opacity ?? 1; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    if (t.backgroundFill) {
        const pad = Math.max(0, (t.backgroundScale || 1.5) - 1) * h;
        ctx.fillStyle = (t.backgroundFill & 2) ? '#fbfcfb' : t.backgroundColor || '#ffffff';
        ctx.fillRect(layout.minX - pad, layout.minY - pad, layout.width + 2 * pad, layout.height + 2 * pad);
    }
    for (const line of layout.lines) for (const run of line.runs) {
        ctx.save(); ctx.translate(run.x, run.y); ctx.scale(run.width ? run.width / Math.max(1e-12, (setFont(run.height, run), ctx.measureText(run.text).width)) : 1, 1);
        if (run.oblique) ctx.transform(1, 0, -Math.tan(run.oblique * Math.PI / 180), 1, 0, 0);
        ctx.fillStyle = run.color || t.color || '#344755'; ctx.fillText(run.text, 0, 0);
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(.25, run.height / 18);
        for (const [enabled, y] of [[run.underline, run.height * .12], [run.overline, -run.height * .85], [run.strike, -run.height * .35]]) if (enabled) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ctx.measureText(run.text).width, y); ctx.stroke();
        }
        ctx.restore();
    }
    ctx.restore();
}
/** Retained CAD renderer. Geometry uploads only after document/tessellation changes. */
export class CadRenderer {
    constructor(host, { camera = new Camera(), backend = 'auto', onStatus = () => { } } = {}) {
        this.host = host;
        this.camera = camera;
        this.preferred = backend;
        this.onStatus = onStatus;
        this.dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
        this.grid = true;
        this.rulers = true; this.camera.clipInset = 22;
        this.disposed = false;
        this.stats = { backend: 'Initializing', frameMs: 0, buildMs: 0, segments: 0, entities: 0, draws: 0 };
        this.background = document.createElement('canvas');
        this.background.className = 'cad-background';
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'cad-geometry';
        this.overlay = document.createElement('canvas');
        this.overlay.className = 'cad-overlay';
        for (const c of [this.background, this.canvas, this.overlay]) {
            Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
            host.append(c);
        }
        this.bg = this.background.getContext('2d');
        this.ctx = this.overlay.getContext('2d');
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(host);
        this.ready = this.initialize();
    }
    async initialize(skipGPU = false, skipGL = false) {
        this.engine?.dispose();
        let error = '';
        const candidates = [];
        if (!skipGPU && ['auto', 'webgpu'].includes(this.preferred))
            candidates.push(GPUBackend);
        if (!skipGL && ['auto', 'webgpu', 'webgl2'].includes(this.preferred))
            candidates.push(GLBackend);
        candidates.push(CanvasBackend);
        for (const Backend of candidates) {
            const old = this.canvas, newCanvas = document.createElement('canvas');
            newCanvas.className = 'cad-geometry';
            newCanvas.style.cssText = old.style.cssText;
            old.replaceWith(newCanvas);
            this.canvas = newCanvas;
            const e = new Backend(newCanvas, message => this.recover(message, e.name));
            try {
                await e.init();
                if (this.disposed) {
                    e.dispose();
                    return;
                }
                this.engine = e;
                if (this.scene)
                    e.upload(this.scene);
                this.stats.backend = e.name;
                this.resize();
                this.onStatus({ backend: e.name, message: error });
                this.invalidate();
                return;
            }
            catch (err) {
                error += Backend.name + ': ' + err.message + '; ';
                e.dispose();
            }
        }
    }
    recover(message, backend) {
        if (this.recovering || this.disposed)
            return;
        this.recovering = true;
        this.onStatus({ backend: 'Recovering', message });
        this.initialize(true, backend === 'WebGL2').finally(() => this.recovering = false);
    }
    resize() {
        this.dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
        const r = this.host.getBoundingClientRect();
        this.camera.width = Math.max(1, r.width);
        this.camera.height = Math.max(1, r.height);
        for (const c of [this.background, this.canvas, this.overlay]) {
            const w = Math.round(r.width * this.dpr), h = Math.round(r.height * this.dpr);
            if (c.width !== w)
                c.width = w;
            if (c.height !== h)
                c.height = h;
        }
        this.invalidate();
    }
    setDocument(doc) { this.doc = doc; this.sceneDirty = true; this.pendingEntities?.clear(); this.invalidate(); }
    updateEntities(ids) {
        this.pendingEntities ??= new Set();
        for (const id of ids)
            this.pendingEntities.add(id);
        this.invalidate();
    }
    invalidate() {
        if (!this.pending && !this.disposed) {
            this.pending = true;
            requestAnimationFrame(() => { this.pending = false; this.render(); });
        }
    }
    containsPoint(p) { const inset = this.rulers ? 22 : 0; return p.x >= inset && p.y >= inset && p.x < this.camera.width && p.y < this.camera.height; }
    render() {
        if (!this.doc || !this.engine || this.disposed)
            return;
        this.camera.clipInset = this.rulers ? 22 : 0;
        const clip = `inset(${this.camera.clipInset}px 0px 0px ${this.camera.clipInset}px)`;
        this.canvas.style.clipPath = clip; this.overlay.style.clipPath = clip;
        const viewKey = [this.camera.x, this.camera.y, this.camera.scale, this.camera.width, this.camera.height].join(':');
        if (this.scene?.hasInfinite && this.viewKey !== viewKey) this.sceneDirty = true;
        this.viewKey = viewKey;
        const start = performance.now(), lod = Math.floor(Math.log2(this.camera.scale || 1));
        if (this.pendingEntities?.size && !this.sceneDirty && this.scene && Math.abs(lod - (this.lod ?? lod)) < 2) {
            const t = performance.now(), ranges = updateSceneEntities(this.scene, this.doc, this.pendingEntities, { tolerance: clamp(.22 / (this.camera.scale * this.dpr), .00001, 3) });
            this.pendingEntities.clear();
            if (ranges === null)
                this.sceneDirty = true;
            else {
                try {
                    this.engine.update?.(this.scene, ranges);
                }
                catch (e) {
                    this.recover(e.message, this.engine.name);
                    return;
                }
                this.stats.updateMs = performance.now() - t;
                this.stats.updatedSegments = ranges.reduce((n, r) => n + r.count, 0);
            }
        }
        if (this.sceneDirty || !this.scene || Math.abs(lod - (this.lod ?? lod)) >= 2) {
            this.lod = lod;
            this.scene = buildScene(this.doc, { tolerance: clamp(.22 / (this.camera.scale * this.dpr), .00001, 3), view: this.camera.viewport });
            try {
                this.engine.upload(this.scene);
            }
            catch (e) {
                this.recover(e.message, this.engine.name);
                return;
            }
            this.sceneDirty = false;
            this.pendingEntities?.clear();
            this.stats.buildMs = this.scene.buildMs;
            this.stats.segments = this.scene.count;
            this.stats.entities = this.scene.items.length;
        }
        // Hardware strokes have six dash slots. Preserve long patterns and zero-length ink dots through the ordered fidelity compositor.
        const ordered = this.scene.paths.some(p => p.fill || p.dash?.length > 6 || p.dash?.some((v, i) => i % 2 === 0 && v === 0)) || this.scene.texts.some(t => t.backgroundFill);
        this.orderedComposite = ordered;
        this.canvas.style.visibility = ordered ? 'hidden' : 'visible';
        this.stats.compositor = ordered ? 'Canvas 2D fidelity composite' : this.engine.name;
        this.drawBackground();
        try {
            if (!ordered) this.engine.draw(this.camera, this.dpr);
        }
        catch (e) {
            this.recover(e.message, this.engine.name);
            return;
        }
        const ctx = this.ctx;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, this.camera.width, this.camera.height);
        ctx.save(); ctx.beginPath(); ctx.rect(this.camera.clipInset, this.camera.clipInset, this.camera.width, this.camera.height); ctx.clip();
        const view = this.camera.viewport;
        if (ordered) {
            const visible = new Set(this.scene.index.search(view).map(item=>item.id));
            for (const [id, span] of this.scene.spans) {
                if (!visible.has(id) && !['RAY','XLINE'].includes(this.scene.entities.get(id)?.type)) continue;
                for (let i=span.pathStart; i<span.pathStart+span.pathCount; i++) { const p=this.scene.paths[i]; drawFill(ctx,p,this.camera); drawPath(ctx,p,this.camera); }
                for (let i=span.textStart; i<span.textStart+span.textCount; i++) drawText(ctx,this.scene.texts[i],this.camera);
            }
        } else for (const t of this.scene.texts) {
            const layout = textLayout(t), pad = Math.max(layout.width, layout.height) * Math.max(1, ...(t.frame || [1]).map(Math.abs));
            if (t.p.x + pad >= view.minX && t.p.x - pad <= view.maxX && t.p.y + pad >= view.minY && t.p.y - pad <= view.maxY) drawText(ctx, t, this.camera);
        }
        this.drawOverlay?.(ctx, this.camera);
        ctx.restore();
        this.stats.frameMs = performance.now() - start;
        this.stats.draws++;
        this.onFrame?.(this.stats);
    }
    drawBackground() {
        const c = this.bg, cam = this.camera;
        c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        c.clearRect(0, 0, cam.width, cam.height);
        c.fillStyle = '#fbfcfb';
        c.fillRect(0, 0, cam.width, cam.height);
        if (this.grid) {
            let step = 10;
            while (step * cam.scale < 18)
                step *= 5;
            while (step * cam.scale > 90)
                step /= 5;
            this.gridStep = step;
            const b = cam.viewport;
            c.fillStyle = '#cedcda';
            for (let x = Math.ceil(b.minX / step) * step; x <= b.maxX; x += step)
                for (let y = Math.ceil(b.minY / step) * step; y <= b.maxY; y += step) {
                    const p = cam.screen({ x, y });
                    c.beginPath();
                    c.arc(p.x, p.y, .65, 0, Math.PI * 2);
                    c.fill();
                }
        }
        c.save(); c.beginPath(); c.rect(cam.clipInset || 0, cam.clipInset || 0, cam.width, cam.height); c.clip();
        for (const p of this.scene.paths) if (!this.orderedComposite && p.fill && intersects(bounds(p.contours ? p.contours.flat() : p.points), cam.viewport)) drawFill(c, p, cam);
        c.restore();
        if (this.rulers) {
            c.fillStyle = '#f3f6f4';
            c.fillRect(0, 0, cam.width, 22);
            c.fillRect(0, 0, 22, cam.height);
            c.strokeStyle = '#d9e3df';
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(22, 22);
            c.lineTo(cam.width, 22);
            c.moveTo(22, 22);
            c.lineTo(22, cam.height);
            c.stroke();
            let step = 100;
            while (step * cam.scale < 55)
                step *= 2;
            while (step * cam.scale > 180)
                step /= 2;
            c.font = '9px ui-monospace, monospace';
            c.fillStyle = '#99a9a5';
            c.textAlign = 'left';
            c.textBaseline = 'middle';
            const v = cam.viewport;
            for (let x = Math.ceil(v.minX / step) * step; x < v.maxX; x += step) {
                const p = cam.screen({ x, y: 0 });
                if (p.x < 28)
                    continue;
                c.fillText(String(+x.toFixed(3)), p.x + 3, 10);
                c.beginPath();
                c.moveTo(p.x, 17);
                c.lineTo(p.x, 22);
                c.stroke();
            }
            for (let y = Math.ceil(v.minY / step) * step; y < v.maxY; y += step) {
                const p = cam.screen({ x: 0, y });
                if (p.y < 30)
                    continue;
                c.save();
                c.translate(10, p.y);
                c.rotate(-Math.PI / 2);
                c.fillText(String(+y.toFixed(3)), 3, 0);
                c.restore();
            }
        }
    }
    fit() {
        if (this.doc) {
            this.camera.fit(documentBounds(this.doc), Math.min(70, this.camera.width * .1, this.camera.height * .12));
            this.invalidate();
        }
    }
    dispose() {
        this.disposed = true;
        this.resizeObserver.disconnect();
        this.engine?.dispose();
        for (const c of [this.background, this.canvas, this.overlay])
            c.remove();
    }
}
