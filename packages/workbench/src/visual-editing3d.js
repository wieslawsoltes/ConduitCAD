import { VisualEditSession, VISUAL_TOOLS, inputAccepts3, visibleFields3, visualHandles3, beginAxisDrag3, updateAxisDrag3, beginPlaneDrag3, updatePlaneDrag3, beginAngleDrag3, updateAngleDrag3, rayPlane3, layoutHandles3 } from '@conduitcad/manipulation3d';
import { V3, add3, mul3 } from '@conduitcad/geometry3d';
import { actionIcon } from './icon-map.js';
import { escapeHTML as E, icon } from './icons.js';
const format = n => Number.isFinite(n) ? Number(n.toPrecision(7)).toString() : '—';
const button = (command, label, glyph = 'properties', extra = '') => `<button type="button" data-visual-command="${E(command)}" title="${E(label)}" aria-label="${E(label)}" ${extra}>${icon(glyph)}<span>${E(label)}</span></button>`;
const faceKinds = new Set(['hole', 'offset-face', 'face-profile']);
const MIN_DRAG = 5;
/** Non-modal visual modeling controller. Geometry remains isolated until an explicit Apply. */
export class VisualEditing3D {
    constructor(modeler) {
        this.m = modeler; this.w = modeler.w; this.session = null; this.drag = null; this.frame = 0;
        this.mode = 'dimensions'; this.snap = true; this.step = 1; this.generation = 0; this.handleNodes = new Map();
        this.root = document.createElement('div'); this.root.className = 'visual3d'; this.root.hidden = true;
        this.root.innerHTML = `<div class="visual3d-handles"></div><section class="visual3d-controls" role="region" aria-label="Visual 3D editing">
          <div class="visual3d-heading"><span class="visual3d-title"></span><span class="visual3d-status" role="status" aria-live="polite"></span></div>
          <div class="visual3d-inputs" role="toolbar" aria-label="Source geometry"></div>
          <div class="visual3d-commandbar" role="toolbar" aria-label="Visual edit actions">
            <div class="visual3d-adjustments"><div class="visual3d-modes"></div>${button('options','Options','settings','aria-expanded="false"')}${button('snap','Snap 1','snap','aria-pressed="true"')}${button('undo','Undo draft','undo')}${button('redo','Redo draft','redo')}${button('fit','Fit preview','fit')}</div>
            <div class="visual3d-confirmation">${button('cancel','Cancel','close')}${button('apply','Apply','check','class="visual3d-primary"')}</div>
          </div>
          <div class="visual3d-fields" role="toolbar" aria-label="Editable dimensions"></div>
          <p class="visual3d-error" role="alert" hidden></p>
        </section>
        <section class="visual3d-options" role="region" aria-label="More feature options" hidden></section>
        <form class="visual3d-entry" aria-label="Exact dimension" hidden><label><span class="visual3d-entry-title"></span><input autocomplete="off" spellcheck="false" aria-label="Dimension value or expression"></label><span class="visual3d-entry-result"></span><button type="submit" title="Update preview">${icon('check')}<span>Set</span></button><button type="button" data-visual-command="entry-close" title="Close dimension">${icon('close')}</button></form>`;
        modeler.stage.append(this.root);
        this.palette = document.createElement('section'); this.palette.className = 'visual3d-palette'; this.palette.hidden = true;
        this.palette.setAttribute('aria-label', 'Create and modify in 3D'); this.palette.setAttribute('role', 'region'); modeler.stage.append(this.palette);
        const opt = { signal: this.w.abort.signal };
        this.root.addEventListener('click', e => this.click(e), opt);
        this.palette.addEventListener('click', e => this.click(e), opt);
        this.root.querySelector('.visual3d-entry').addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); this.acceptEntry(); }, opt);
        this.root.querySelector('.visual3d-entry input').addEventListener('input', () => this.previewEntryValue(), opt);
        this.root.querySelector('.visual3d-entry input').addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.closeEntry(); } }, opt);
        this.root.addEventListener('change', e => this.optionChanged(e), opt);
        this.root.addEventListener('focusin', e => { if (e.target.matches('[data-visual-handle]')) this.activeHandle = e.target.dataset.visualHandle; }, opt);
        this.w.root.addEventListener('conduit:documentchange', () => this.cancel('Document changed'), opt);
        let lastSize='';
        this.resizeObserver=new ResizeObserver(entries=>{
            const {width,height}=entries[0].contentRect,key=width+':'+height;
            if(lastSize&&key!==lastSize&&this.drag)this.cancelDrag();
            lastSize=key;this.updatePositions();
        });
        this.resizeObserver.observe(modeler.host);
        this.w.abort.signal.addEventListener('abort',()=>this.resizeObserver.disconnect(),{once:true});
    }
    get active() { return !!this.session; }
    report(message = '') {
        const el = this.root.querySelector('.visual3d-error'); el.textContent = message; el.hidden = !message;
    }
    start(kind, id = null) {
        this.w.parameters?.cancel(); this.m.path?.cancel();
        this.m.inspection?.cancel();this.w.visual2d?.cancel();
        this.cancel(); this.closePalette(); this.w.closeModal(); this.w.closePanels();
        this.m.input.reset(); this.m.cancelDrag();
        const selected = this.w.selected(); const tool = VISUAL_TOOLS.find(t => t.id === kind);
        if (!tool) throw new Error('Unknown visual tool');
        const inputs = [];
        if (kind === 'vertex' && selected.length === 1) inputs.push(selected[0].id);
        else if (tool.inputs) {
            const used = new Set();
            for (let i = 0; i < (tool.multiple ? Math.min(32,Math.max(tool.inputs, selected.length)) : tool.inputs); i++) {
                const e = selected.find(e => !used.has(e.id) && inputAccepts3(kind, i, e));
                if (e) { inputs[i] = e.id; used.add(e.id); } else inputs[i] = '';
            }
        }
        const params = !tool.inputs && !id ? { x: Number(this.m.camera.target.x.toPrecision(8)), y: Number(this.m.camera.target.y.toPrecision(8)), z: 0 } : {};
        // Center new box footprints under the working view instead of placing one corner there.
        // Existing features retain their exact placement and never auto-fit.
        if(!id && ['box','wedge'].includes(kind)){
            params.x-=tool.fields.find(f=>f.name==='width').value/2;
            params.y-=tool.fields.find(f=>f.name==='depth').value/2;
        }
        const session = new VisualEditSession(this.w.doc, kind, { id, inputs, parameters: params, hit: this.m.hit });
        this.session = session; this.mode = kind === 'transform' || kind === 'vertex' ? 'move' : 'dimensions';
        this.initialSelection = new Set(this.w.selection); this.initialHit = this.m.hit; this.initialMarker = this.m.renderer.marker;
        this.initialCamera = this.m.camera.snapshot(); this.frameNew = !id && !tool.inputs && this.w.doc.entities.length===0; this.autoFramed=false; this.sourceVersion = this.w.doc.version;
        this.m.previewDocument = null; this.m.operation = null; this.m.renderer.marker = null; this.picking = null; this.entryField = null;
        this.root.hidden = false; this.m.stage.classList.add('visual3d-active'); this.report();
        this.root.querySelector('.visual3d-title').innerHTML = `${icon(['face-profile','sketch-profile'].includes(kind) ? 'sketch-face' : kind === 'vertex' ? 'vertex' : actionIcon('3d-op-'+kind))}<strong>${E(id ? 'Edit ' : '')}${E(session.tool.label)}</strong><small>Live preview</small>`;
        this.buildModes(); this.renderUI();
        if (session.inputs.some(id => !id)) this.pickInput(session.inputs.findIndex(id => !id));
        else if (!id && faceKinds.has(kind) && this.m.hit?.face === undefined) this.pickInput(0);
        else this.requestPreview();
        this.root.querySelector('[data-visual-command=apply]').focus({ preventScroll: true });
    }
    buildModes() {
        const s = this.session;
        const values = s.kind === 'transform' ? [['move','Move','move'],['rotate','Rotate','rotate'],['scale','Scale','scale']]
            : !s.tool.inputs ? [['dimensions','Size','dimension'],['move','Position','move']] : [];
        this.root.querySelector('.visual3d-modes').innerHTML = values.map(([k,l,g]) => button('mode:'+k,l,g,`aria-pressed="${this.mode===k}"`)).join('');
    }
    labelInput(i) {
        const k = this.session.kind;
        if (faceKinds.has(k)) return 'Support face';
        if (k === 'vertex') return 'Native vertex';
        if (k === 'sweep') return i ? 'Path' : 'Profile';
        if (k === 'extrude') return i ? 'Target body' : 'Profile';
        if (k === 'subtract') return i ? 'Cutter' : 'Target';
        return k === 'loft' ? `Profile ${i+1}` : `Input ${i+1}`;
    }
    renderUI() {
        const s = this.session; if (!s) return;
        let count = s.tool.inputs || 0; try { count = s.inputCount(); } catch {}
        const inputs = Array.from({ length: count }, (_, i) => {
            const e = s.base.entities.find(e => e.id === s.inputs[i]);
            return `<span class="visual3d-input-group">${button('pick:'+i, `${this.labelInput(i)}: ${e?.label || e?.type || 'Pick…'}`, 'select', `aria-pressed="${this.picking===i}"`)}${s.tool.multiple&&i>=s.tool.inputs?button('remove-input:'+i,'Remove section '+(i+1),'close'):''}</span>`;
        }).join('') + (s.tool.multiple ? button('add-input','Add section','plus',count>=32?'disabled':'') : !count ? button('place','Place on XY plane','move') : '');
        const ih = this.root.querySelector('.visual3d-inputs'); if (ih.innerHTML !== inputs && !this.drag) ih.innerHTML = inputs;
        const fields = visibleFields3(s).filter(f => !['segments','face','index','detach','px','py','pz','samples'].includes(f.name));
        const markup = fields.map(f => {
            let value; try { value = s.value(f.name); } catch { value = NaN; }
            return `<button type="button" data-visual-field="${E(f.name)}" title="Edit ${E(f.label)}" aria-label="${E(f.label)}: ${E(f.options?.[value] || format(value))}"><span>${E(f.label)}</span><strong>${E(f.options?.[value] || format(value))}${!f.options && !Number.isFinite(Number(s.parameters[f.name])) ? ' ƒ' : ''}</strong></button>`;
        }).join('');
        const fh = this.root.querySelector('.visual3d-fields');
        // Do not recreate the toolbar while focused or while dragging. Values update in place.
        if (fh.dataset.keys !== fields.map(f=>f.name).join('|')) { fh.dataset.keys = fields.map(f=>f.name).join('|'); fh.innerHTML = markup; }
        else fields.forEach(f => { const b=fh.querySelector(`[data-visual-field="${f.name}"]`); let v;try{v=s.value(f.name);}catch{v=NaN;} const text=f.options?.[v]||format(v); b.querySelector('strong').textContent=text+(!f.options&&!Number.isFinite(Number(s.parameters[f.name]))?' ƒ':''); b.setAttribute('aria-label',`${f.label}: ${text}`); });
        this.root.querySelector('[data-visual-command=apply]').disabled = !!this.picking || this.picking===0 || !s.preview || s.validatedRevision !== s.revision;
        this.root.querySelector('[data-visual-command=undo]').disabled = !s.undoStack.length;
        this.root.querySelector('[data-visual-command=redo]').disabled = !s.redoStack.length;
        const status = this.root.querySelector('.visual3d-status');
        const statusText = this.picking !== null ? this.picking === 'place' ? 'Tap the ground plane to place' : `Tap ${this.labelInput(this.picking).toLowerCase()} on the model` : this.drag ? 'Drag · Shift fine · Alt unsnapped' : s.error ? 'Adjust the value to continue' : s.preview ? 'Drag handles · tap dimensions · Apply when ready' : 'Updating preview…';
        if(status.textContent!==statusText)status.textContent=statusText;
        for (const b of this.root.querySelectorAll('[data-visual-command^="mode:"]')) b.setAttribute('aria-pressed',String(b.dataset.visualCommand.slice(5)===this.mode));
        this.updateHandles();
    }
    requestPreview({ immediate = false } = {}) {
        if (!this.session || this.picking !== null) return;
        this.report();
        // A changed draft cannot Apply or display an older successful shape.
        this.root.querySelector('[data-visual-command=apply]').disabled = true;
        if (this.frame) cancelAnimationFrame(this.frame);
        const generation = this.generation;
        const run = () => { this.frame = 0; if (generation !== this.generation || !this.session) return; this.evaluatePreview(); };
        if (immediate) run(); else this.frame = requestAnimationFrame(run);
    }
    evaluatePreview() {
        const s = this.session; if (!s) return;
        if (s.source !== this.w.doc || s.sourceVersion !== this.w.doc.version) { this.cancel('Source drawing changed'); return; }
        try {
            const draft = s.evaluate(); this.m.previewDocument = draft;
            this.m.renderer.setDocument(draft, { showInputs: this.m.showInputs });
            this.m.renderer.setSelection(new Set([s.resultId])); this.report();
        } catch (error) {
            this.m.previewDocument = null; this.m.renderer.setDocument(this.w.doc, { showInputs: this.m.showInputs });
            this.m.renderer.setSelection(this.initialSelection); this.report(error.message);
        }
        this.renderUI();
        if(s.preview && this.frameNew){this.frameNew=false;this.autoFramed=true;this.fitPreview();}
        this.m.renderer.invalidate();
    }
    fitPreview(){
        if(!this.session?.preview)return;
        const r=this.m.renderer,c=this.m.camera,host=this.m.host.getBoundingClientRect(),bar=this.root.querySelector('.visual3d-controls').getBoundingClientRect();
        const points=r.scene.items.filter(i=>i.id===this.session.resultId).flatMap(i=>i.points);
        if(!points.length)return;
        const left=28,right=host.width-28,top=76,bottom=Math.max(top+40,bar.top-host.top-20),width=Math.max(40,right-left),height=Math.max(40,bottom-top);
        const scale=host.height/height;c.resize(width,height);c.fit(points);c.height*=scale;c.distance*=scale;c.resize(host.width,host.height);c.pan((left+right-host.width)/2,(top+bottom-host.height)/2);
        r.invalidate();this.updatePositions();
    }
    updateHandles() {
        if (!this.session) return;
        try { this.handles = this.picking !== null ? [] : visualHandles3(this.session,this.m.camera,this.mode); } catch { this.handles=[]; }
        const host = this.root.querySelector('.visual3d-handles'), keys = new Set(this.handles.map(h=>h.id));
        for (const [key,nodes] of this.handleNodes) if(!keys.has(key)){nodes.group.remove();this.handleNodes.delete(key);}
        for (const h of this.handles) {
            let nodes = this.handleNodes.get(h.id);
            if (!nodes) {
                const group=document.createElement('div');group.className='visual3d-handle-group';
                group.innerHTML=`<button type="button" class="visual3d-handle" data-visual-handle="${E(h.id)}" role="${h.kind==='plane'?'button':'slider'}" aria-label="${E(h.label)}"><span>${icon(h.kind==='angle'?'rotate':h.kind==='plane'?'move':'arrow')}</span></button>${h.field?`<button type="button" class="visual3d-dimension" data-visual-label="${E(h.field)}"><span></span><strong></strong></button>`:''}`;
                host.append(group);nodes={group,button:group.querySelector('.visual3d-handle'),label:group.querySelector('.visual3d-dimension')};this.handleNodes.set(h.id,nodes);
            }
            nodes.group.style.setProperty('--handle-color',h.color);
            if (h.field) { nodes.button.setAttribute('aria-valuenow',String(h.value)); nodes.button.setAttribute('aria-valuetext',`${format(h.value)} ${h.unit==='angle'?'degrees':h.unit==='scale'?'times':this.w.doc.units}`); nodes.button.setAttribute('aria-valuemin',String(Math.min(-1e12,h.value)));nodes.button.setAttribute('aria-valuemax',String(Math.max(1e12,h.value)));nodes.label.querySelector('span').textContent=h.label;nodes.label.querySelector('strong').textContent=format(h.value)+(Number.isFinite(Number(this.session.parameters[h.field]))?'':' ƒ'); }
        }
        this.updatePositions();
    }
    updatePositions() {
        if (!this.session || !this.handles) return;
        const width=this.m.camera.width,height=this.m.camera.pixelHeight;
        const controls=this.root.querySelector('.visual3d-controls'), bottom=height-controls.getBoundingClientRect().height-14;
        const top=this.w.mobileMedia?.matches?60:62, candidates=[];this.hitHandles=[];
        for(const h of this.handles){
            const nodes=this.handleNodes.get(h.id),raw=this.m.camera.project(h.point),a=this.m.camera.project(h.origin);
            nodes.group.hidden=!raw.visible||!Number.isFinite(raw.x)||!Number.isFinite(raw.y);
            if(nodes.group.hidden)continue;
            let x=raw.x,y=raw.y;
            if(h.kind==='axis'&&Math.hypot(raw.x-a.x,raw.y-a.y)<28){x=a.x;y=a.y-54;}
            const label=nodes.label;
            candidates.push({...h,x,y,raw,hasLabel:!!label,labelWidth:label?.offsetWidth||110,labelHeight:label?.offsetHeight||44,hideLabel:this.optionsOpen||!!this.drag&&this.drag.handle.id!==h.id});
            if(h.kind==='axis')nodes.button.querySelector('.icon').style.transform=`rotate(${Math.atan2(y-a.y,x-a.x)}rad)`;
        }
        const layout=layoutHandles3(candidates,{width,height,top,bottom,active:this.drag?.handle.id||this.activeHandle,labels:bottom-top>=170});
        for(let i=0;i<layout.length;i++){
            const l=layout[i],h=candidates[i],nodes=this.handleNodes.get(h.id);nodes.group.hidden=!l.visible;if(!l.visible)continue;
            nodes.button.style.left=`${l.x-22}px`;nodes.button.style.top=`${l.y-22}px`;
            nodes.button.setAttribute('data-projected-x',String(l.x));nodes.button.setAttribute('data-projected-y',String(l.y));
            this.hitHandles.push({...h,x:l.x,y:l.y});
            if(nodes.label){nodes.label.hidden=!l.label;if(l.label){nodes.label.style.left=`${l.label.x}px`;nodes.label.style.top=`${l.label.y}px`;}}
        }
    }
    draw(ctx) {
        if(!this.session)return;
        ctx.save();ctx.lineWidth=1.5;ctx.setLineDash([]);
        for(const h of this.hitHandles||[]){
            const a=this.m.camera.project(h.origin);ctx.strokeStyle=h.color;ctx.fillStyle=h.color;
            if(a.visible){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(h.raw.x,h.raw.y);ctx.stroke();
                if(Math.hypot(h.raw.x-h.x,h.raw.y-h.y)>5){ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(h.raw.x,h.raw.y);ctx.lineTo(h.x,h.y);ctx.stroke();ctx.setLineDash([]);}
                if(h.kind==='angle'){ctx.beginPath();let started=false;for(let i=0;i<=64;i++){const t=i*Math.PI/32,p=this.m.camera.project(add3(h.origin,add3(mul3(h.u,h.radius*Math.cos(t)),mul3(h.v,h.radius*Math.sin(t)))));if(!p.visible){started=false;continue;}if(started)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);started=true;}ctx.stroke();}
                ctx.beginPath();ctx.arc(a.x,a.y,3,0,Math.PI*2);ctx.fill();
            }
        }
        ctx.restore();
    }
    pointerDown(p) {
        if(!this.session||this.picking!==null)return false;
        const h=[...(this.hitHandles||[])].reverse().find(h=>Math.hypot(p.x-h.x,p.y-h.y)<=24);
        if(!h)return false;
        this.closeEntry();this.closeOptions();
        try{
            const init=h.kind==='plane'?beginPlaneDrag3:h.kind==='angle'?beginAngleDrag3:beginAxisDrag3;
            // Use the true projected anchor for displaced handles; every move is relative to the initial pointer.
            const start={x:h.raw.x,y:h.raw.y};
            const motion=h.kind==='axis'?init(this.m.camera,h.origin,h.axis,start):init(this.m.camera,h.origin,h.u,h.v,start);
            this.drag={handle:h,motion,pointer:p,offset:{x:start.x-p.x,y:start.y-p.y},before:this.session.snapshot(),values:this.session.values(),moved:false};
            this.activeHandle=h.id;this.renderUI();return true;
        }catch(error){this.report(error.message);return true;}
    }
    pointerMove(p) {
        const drag=this.drag;if(!drag||!this.session)return false;
        if(!drag.moved&&Math.hypot(p.x-drag.pointer.x,p.y-drag.pointer.y)<MIN_DRAG)return true;
        drag.moved=true;
        const h=drag.handle,q={x:p.x+drag.offset.x,y:p.y+drag.offset.y};
        const step = p.alt || !this.snap ? 0 : h.unit === 'angle' ? (p.shift ? 1 : 15) : h.unit === 'scale' ? (p.shift ? .01 : .1) : (p.shift ? this.step / 10 : this.step);
        try{
            if(h.kind==='plane'){
                const delta=updatePlaneDrag3(drag.motion,q);h.fields.forEach((f,i)=>this.session.dragValue(f,delta[i?'v':'u'],drag.before.parameters[f],drag.values[f],step));
            }else{
                const delta=h.kind==='angle'?updateAngleDrag3(drag.motion,q):updateAxisDrag3(drag.motion,q)*(h.factor||1);
                this.session.dragValue(h.field,delta,drag.before.parameters[h.field],drag.values[h.field],step);
            }
            this.requestPreview();this.renderUI();
        }catch(error){this.report(error.message);}
        return true;
    }
    pointerUp(p) {
        if(this.drag){
            this.pointerMove(p);const d=this.drag;this.drag=null;
            if(d.moved){this.session.checkpoint(d.before);this.requestPreview({immediate:true});}
            else if(d.handle.field)this.openEntry(d.handle.field);
            this.renderUI();return true;
        }
        return false;
    }
    cancelDrag() {
        if(!this.drag||!this.session)return;
        const before=this.drag.before;this.drag=null;this.session.restore(before);this.requestPreview({immediate:true});
    }
    pickInput(index) {
        if(!this.session)return;
        this.cancelDrag();this.closeEntry();this.closeOptions();if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;
        this.picking=index;this.m.previewDocument=null;this.m.renderer.setDocument(this.w.doc,{showInputs:true});this.m.renderer.setSelection(this.initialSelection);this.report();this.renderUI();
    }
    pickAt(p) {
        if(!this.session)return false;
        if(this.picking===null)return true; // Blank tap during edit must not replace selection/history inputs.
        try{
            const s=this.session;
            if(this.picking==='place'){
                const point=rayPlane3(this.m.camera.ray(p.x,p.y),V3(0,0,s.value('z')),V3(0,0,1));
                if(!point)throw new Error('Ground plane is edge-on; choose ISO or Top first');
                s.checkpoint();s.set('x',point.x);s.set('y',point.y);
            }else{
                const mode=faceKinds.has(s.kind)?'face':s.kind==='vertex'?'vertex':'body';
                const hit=this.m.renderer.pick(p.x,p.y,{mode,radius:p.pointerType==='touch'?18:9});
                if(!hit)throw new Error('No compatible geometry here; tap the model');
                s.checkpoint();s.setInput(this.picking,hit.id,hit);
            }
            this.picking=null;
            const missing=s.inputs.findIndex(id=>!id);if(missing>=0)this.pickInput(missing);else this.requestPreview();
            this.renderUI();
        }catch(error){this.report(error.message);}
        return true;
    }
    openEntry(name) {
        if(!this.session)return;
        const f=visibleFields3(this.session).find(f=>f.name===name);
        if(!f)return;
        if(f.options){this.openOptions(name);return;}
        this.closeOptions();this.entryField=name;
        const form=this.root.querySelector('.visual3d-entry');form.hidden=false;
        const unit=['rx','ry','rz','angle','sinkAngle'].includes(name)?'degrees':['sx','sy','sz','taper'].includes(name)?'factor':['count','segments','samples','index','face','plane'].includes(name)?'':this.w.doc.units;
        form.querySelector('.visual3d-entry-title').textContent=f.label+(unit?' · '+unit:'');
        const input=form.querySelector('input');input.value=String(this.session.parameters[name]);input.focus({preventScroll:true});input.select();this.previewEntryValue();
    }
    previewEntryValue(){
        const field=this.root.querySelector('.visual3d-entry input'),result=this.root.querySelector('.visual3d-entry-result');
        try{result.textContent='= '+format(this.w.eval(field.value))+' · Enter to preview';field.setAttribute('aria-invalid','false');}catch(error){result.textContent=error.message;field.setAttribute('aria-invalid','true');}
    }
    acceptEntry(){
        if(!this.session||!this.entryField)return;
        const input=this.root.querySelector('.visual3d-entry input');
        try{this.w.eval(input.value);this.session.checkpoint();this.session.set(this.entryField,input.value);this.closeEntry();this.requestPreview({immediate:true});return true;}catch(error){this.report(error.message);return false;}
    }
    closeEntry(){const form=this.root.querySelector('.visual3d-entry');if(form.contains(document.activeElement))this.m.host.focus({preventScroll:true});form.hidden=true;this.entryField=null;}
    openOptions(focusField=null){
        if(!this.session)return;
        this.closeEntry();this.optionsOpen=true;const panel=this.root.querySelector('.visual3d-options'),s=this.session;
        panel.innerHTML=`<header><strong>Feature options</strong>${button('options-close','Close','close')}</header><div class="visual3d-options-body">
          <p>Canvas stays interactive. Values accept design expressions.</p>
          ${s.kind==='vertex'&&s.base.entities.find(e=>e.id===s.inputs[0])?.feature3d?'<p class="visual3d-warning">Moving this native vertex detaches this feature. Its upstream inputs stay retained. Enable Detach explicitly below.</p>':''}
          ${visibleFields3(s).map(f=>{
            let n;try{n=s.value(f.name);}catch{n=NaN;}
            return `<label>${E(f.label)}${f.options?`<select data-visual-option="${f.name}">${!Number.isInteger(Number(s.parameters[f.name]))?`<option value="${E(s.parameters[f.name])}" selected>ƒ ${E(s.parameters[f.name])}</option>`:''}${f.options.map((label,i)=>`<option value="${i}" ${String(s.parameters[f.name])===String(i)?'selected':''}>${E(label)}</option>`).join('')}</select>`:`<input data-visual-option="${f.name}" value="${E(s.parameters[f.name])}" spellcheck="false" autocomplete="off">`}</label>`;
          }).join('')}<label>Snap increment<input data-visual-step type="number" min="0.000001" max="1000000" value="${this.step}"></label>
          <label>Feature name<input data-visual-name maxlength="160" value="${E(s.name)}"></label>
          <p>Drags keep expression links by adding an offset. Shift: fine. Alt: unsnapped.</p>
          ${!['face-profile','sketch-profile','vertex'].includes(s.kind)?button('advanced','Advanced dialog…','settings'):''}</div>`;
        panel.hidden=false;this.root.querySelector('[data-visual-command=options]').setAttribute('aria-expanded','true');
        if(focusField)panel.querySelector(`[data-visual-option="${focusField}"]`)?.focus({preventScroll:true});
        this.updatePositions();
    }
    closeOptions(){const panel=this.root.querySelector('.visual3d-options');if(panel.contains(document.activeElement))this.m.host.focus({preventScroll:true});this.optionsOpen=false;panel.hidden=true;this.root.querySelector('[data-visual-command=options]').setAttribute('aria-expanded','false');}
    optionChanged(event){
        const e=event.target,s=this.session;if(!s)return;
        try{
            if(e.matches('[data-visual-step]')){const n=Number(e.value);if(!Number.isFinite(n)||n<1e-6||n>1e6)throw new Error('Snap increment must be 0.000001–1000000');this.step=n;this.updateSnap();return;}
            s.checkpoint();
            if(e.dataset.visualOption){s.set(e.dataset.visualOption,e.value);if(s.kind==='vertex'&&e.dataset.visualOption==='index'){s.loadVertex(s.value('index'));s.invalidate();}}
            if(e.matches('[data-visual-name]')){s.name=e.value;s.invalidate();}
            this.requestPreview({immediate:true});
            if(['extent','holeType','through','shape','useNormal','operation','index'].includes(e.dataset.visualOption))this.openOptions();
        }catch(error){this.requestPreview({immediate:true});this.report(error.message);}
    }
    updateSnap(){const b=this.root.querySelector('[data-visual-command=snap]');b.setAttribute('aria-pressed',String(this.snap));const label=this.snap?'Snap '+format(this.step):'Free movement';b.querySelector('span').textContent=label;b.setAttribute('aria-label',label);b.title=label;}
    historyStep(redo=false){
        if(!this.session)return;this.cancelDrag();this.closeEntry();this.picking=null;
        redo?this.session.redo():this.session.undo();this.requestPreview();if(this.optionsOpen)this.openOptions();
    }
    async apply(){
        const s=this.session;if(!s||this.applying)return;
        this.cancelDrag();if(this.entryField && !this.acceptEntry())return;if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;
        if(this.picking!==null){this.report('Pick the source geometry first');return;}
        try{
            s.assertSource(this.w.doc);s.evaluate();
            // An unchanged existing feature is a no-op, not an extra undo entry.
            if(s.id&&JSON.stringify(s.snapshot())===JSON.stringify(s.initial)){this.cancel();return;}
            this.applying=true;this.m.previewDocument=null;let result;
            this.w.edit((s.id?'Edit ':'Create ')+s.tool.label,()=>{result=s.commit(this.w.doc);this.w.selection=new Set([result.id]);});
            this.finish();this.m.hit=null;this.m.sync();this.w.updateSelection();this.m.saveView();this.w.toast(s.tool.label+' applied');
        }catch(error){this.report(error.message);this.applying=false;if(this.session&&this.session.source!==this.w.doc){this.cancel('The edit was rolled back');}else {this.renderUI();this.m.renderer.invalidate();}}
        finally{this.applying=false;}
    }
    finish(){
        if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;this.generation++;this.drag=null;
        this.session?.cancel();this.session=null;this.m.previewDocument=null;this.picking=null;
        this.root.hidden=true;this.m.stage.classList.remove('visual3d-active');this.closeEntry();this.closeOptions();
        this.root.querySelector('.visual3d-handles').replaceChildren();this.handleNodes.clear();this.handles=[];this.hitHandles=[];
        this.m.host.focus({preventScroll:true});
    }
    cancel(message=''){
        this.closePalette();if(!this.session)return;
        if(this.applying)return;
        const restore=this.session.source===this.w.doc, selection=this.initialSelection,hit=this.initialHit,marker=this.initialMarker;
        if(restore&&this.autoFramed)Object.assign(this.m.camera,this.initialCamera,{target:{...this.initialCamera.target}});
        this.finish();if(restore){this.w.selection=new Set(selection);this.m.hit=hit;this.m.renderer.marker=marker;}
        if(this.m.renderer&&this.m.active){this.m.renderer.setDocument(this.w.doc,{showInputs:this.m.showInputs});this.m.renderer.setSelection(this.w.selection);this.m.renderer.invalidate();}
        if(message)this.w.toast(message);
    }
    externalChange(){if(this.session&&!this.applying&&(this.session.source!==this.w.doc||this.sourceVersion!==this.w.doc.version))this.cancel('Visual preview closed because the drawing changed');}
    beforeEdit(){if(this.session&&!this.applying)this.cancel();}
    click(event){
        const el=event.target.closest('button');if(!el)return;event.stopPropagation();
        if(el.dataset.action){this.w.action(el.dataset.action).catch(error=>this.w.toast(error.message,true));return;}
        if(el.dataset.visualField||el.dataset.visualLabel){this.openEntry(el.dataset.visualField||el.dataset.visualLabel);return;}
        const action=el.dataset.visualCommand;if(!action)return;
        try{
            if(action.startsWith('create:')){this.start(action.slice(7));return;}
            if(action==='palette-close'){this.closePalette();return;}
            if(action==='apply'){this.apply();return;}
            if(action==='cancel'){this.cancel();this.m.sync();return;}
            if(action==='options'){this.optionsOpen?this.closeOptions():this.openOptions();return;}
            if(action==='options-close'){this.closeOptions();return;}
            if(action==='entry-close'){this.closeEntry();return;}
            if(action==='fit'){this.fitPreview();return;}
            if(action==='snap'){this.snap=!this.snap;this.updateSnap();return;}
            if(action==='undo'||action==='redo'){this.historyStep(action==='redo');return;}
            if(action.startsWith('mode:')){this.mode=action.slice(5);this.renderUI();this.m.renderer.invalidate();return;}
            if(action.startsWith('pick:')){this.pickInput(Number(action.slice(5)));return;}
            if(action==='place'){this.pickInput('place');return;}
            if(action==='add-input'){if(this.session.inputs.length>=32)throw new Error('At most 32 source sections are allowed');this.session.checkpoint();this.session.inputs.push('');this.session.invalidate();this.pickInput(this.session.inputs.length-1);return;}
            if(action.startsWith('remove-input:')){const i=Number(action.slice(13));if(!Number.isInteger(i)||i<this.session.tool.inputs||i>=this.session.inputs.length)throw new Error('Cannot remove required source section');this.session.checkpoint();this.session.inputs.splice(i,1);this.session.invalidate();this.picking=null;this.requestPreview();this.renderUI();return;}
            if(action==='advanced'){
                const s=this.session,kind=s.kind,id=s.id,values=s.snapshot();this.cancel();this.m.operationDialog(kind,id);
                for(const e of this.w.modal.querySelectorAll('[data-model-field]'))if(Object.hasOwn(values.parameters,e.dataset.modelField)){
                    const value=String(values.parameters[e.dataset.modelField]);
                    if(e.tagName==='SELECT' && ![...e.options].some(o=>o.value===value))e.add(new Option('Expression: '+value,value));
                    e.value=value;
                }
                const selects=[...this.w.modal.querySelectorAll('[data-model-input]')];selects.forEach((e,i)=>{e.value=values.inputs[i]||'';});
                const target=this.w.modal.querySelector('[data-model-target]');if(target)target.value=values.inputs[1]||'';
                const name=this.w.modal.querySelector('[data-model-name]');if(name)name.value=values.name;
                this.w.modal.dispatchEvent(new Event('change'));return;
            }
        }catch(error){this.report(error.message);}
    }
    openPalette(){
        this.w.parameters?.cancel(); this.m.path?.cancel();
        this.cancel();this.w.closeModal();this.w.closePanels();
        this.palette.innerHTML=`<header><div><small>BUILD ON THE CANVAS</small><h3>Create & modify</h3></div>${button('palette-close','Close tools','close')}</header>
          <label class="visual3d-search">${icon('search')}<input type="search" placeholder="Find a 3D tool…" aria-label="Find a 3D tool"></label><div class="visual3d-palette-body">${[...new Set(VISUAL_TOOLS.map(t=>t.group))].map(group=>`<section><h4>${E(group)}</h4><div>${VISUAL_TOOLS.filter(t=>t.group===group).map(t=>button('create:'+t.id,t.label,['face-profile','sketch-profile'].includes(t.id)?'sketch':t.id==='vertex'?'vertex':actionIcon('3d-op-'+t.id))).join('')}</div></section>`).join('')}<section><h4>Spatial curves</h4><div><button type="button" data-action="3d-path">${icon('polyline')}<span>Spatial path</span></button><button type="button" data-action="3d-live-workshop">${icon('formula')}<span>Parametric path workshop</span></button></div></section><p class="visual3d-empty" hidden>No matching tools.</p></div>`;
        this.palette.hidden=false;this.palette.querySelector('input').addEventListener('input',e=>{const words=e.target.value.toLowerCase().split(/\s+/);let count=0;for(const b of this.palette.querySelectorAll('[data-visual-command^="create:"],[data-action="3d-path"],[data-action="3d-live-workshop"]')){b.hidden=!words.every(w=>b.textContent.toLowerCase().includes(w));if(!b.hidden)count++;}for(const section of this.palette.querySelectorAll('section'))section.hidden=![...section.querySelectorAll('button')].some(b=>!b.hidden);this.palette.querySelector('.visual3d-empty').hidden=!!count;});
        this.palette.querySelector('[data-visual-command=palette-close]').focus({preventScroll:true});
    }
    closePalette(){this.palette.hidden=true;}
    keyDown(event){
        if(!this.palette.hidden&&event.key==='Escape'){event.preventDefault();this.closePalette();return true;}
        if(!this.session||this.w.modal)return false;
        if(event.key==='Escape'){event.preventDefault();if(this.drag)this.cancelDrag();else if(this.entryField)this.closeEntry();else if(this.optionsOpen)this.closeOptions();else {this.cancel();this.m.sync();}return true;}
        const input=event.target.closest?.('input,select,textarea');if(input)return false;
        const cmd=event.ctrlKey||event.metaKey;
        if(cmd&&['z','y'].includes(event.key.toLowerCase())){event.preventDefault();this.historyStep(event.key.toLowerCase()==='y'||event.shiftKey);return true;}
        const h=(this.handles||[]).find(h=>h.id===event.target.dataset?.visualHandle);
        if(h){
            if(event.key==='Enter'||event.key===' '){event.preventDefault();if(h.field)this.openEntry(h.field);return true;}
            if(['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(event.key)&&h.field){event.preventDefault();const step=h.unit==='angle'?15:h.unit==='scale' ? .1 : this.step,delta=step*(event.shiftKey ? .1 : 1)*(['ArrowDown','ArrowLeft'].includes(event.key)?-1:1);this.session.checkpoint();this.session.dragValue(h.field,delta,this.session.parameters[h.field],this.session.value(h.field));this.requestPreview();return true;}
        }
        if(event.key==='Enter'){event.preventDefault();this.apply();return true;}
        if(['Delete','Backspace'].includes(event.key)){event.preventDefault();this.report('Apply or cancel this preview before deleting geometry');return true;}
        return false;
    }
    dispose(){this.resizeObserver.disconnect();this.cancel();this.root.remove();this.palette.remove();}
}
