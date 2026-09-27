import { PlanarEditSession, planarEditable, handles2, dragHandle2 } from '@conduitcad/manipulation2d';
import { layoutHandles3 } from '@conduitcad/manipulation3d';
import { clone, text, entityBounds, regenerateDimensions } from '@conduitcad/model';
import { regenerateFeatures } from '@conduitcad/modeling';
import { ConstraintSolver } from '@conduitcad/constraints';
import { emptyBounds, union, validBounds } from '@conduitcad/geometry';
import { refreshCalculations } from './parametric-workbench.js';
import { createVisualDraftingExample } from './visual-example2d.js';
import { PlanarToolPanel } from './planar-tool-panel.js';
import { escapeHTML as E, icon } from './icons.js';
const format = value => typeof value==='number' ? Number(value.toPrecision(8)).toString() : String(value);
const titles = { geometry:'Edit geometry',move:'Move / copy',rotate:'Rotate / copy',scale:'Scale / copy',offset:'Offset',fillet:'Fillet two lines' };
const glyphs = { geometry:'properties',move:'move',rotate:'rotate',scale:'scale',offset:'offset',fillet:'fillet' };
const b = (key,label,glyph='properties',extra='') => `<button type="button" data-planar-command="${E(key)}" aria-label="${E(label)}" title="${E(label)}" ${extra}>${icon(glyph)}<span>${E(label)}</span></button>`;
/** Native planar geometry editor. Pointer previews never modify the user's document. */
export class VisualEditing2D {
    constructor(w) {
        this.w=w;this.session=null;this.frame=0;this.drag=null;this.nav=null;this.nodes=new Map();this.snap=true;this.step=1;
        this.root=document.createElement('div');this.root.className='planar-editor';this.root.hidden=true;
        this.root.innerHTML=`<div class="planar-handles"></div><section class="planar-controls" role="region" aria-label="Visual 2D editing">
        <header><strong class="planar-title"></strong><span class="planar-status" role="status" aria-live="polite">Drag geometry or tap a dimension</span></header>
        <div class="planar-commandbar"><div class="planar-utilities">${b('options','All values','properties')}${b('snap','Snap 1','snap','aria-pressed="true"')}${b('undo','Undo draft','undo')}${b('redo','Redo draft','redo')}${b('fit','Fit preview','fit')}</div><div class="planar-confirmation">${b('cancel','Cancel','close')}${b('apply','Apply','check','class="primary"')}</div></div>
        <div class="planar-fields" role="toolbar" aria-label="Editable dimensions"></div><p class="planar-error" role="alert" hidden></p></section>
        <section class="planar-options" role="region" aria-label="Geometry values" hidden><header><strong>Geometry values</strong>${b('options-close','Close values','close')}</header><input type="search" class="planar-value-search" placeholder="Find a vertex or dimension…" aria-label="Find geometry values"><div class="planar-options-body"></div></section>
        <form class="planar-entry" aria-label="Exact planar value" hidden><label class="planar-entry-label"></label><span class="planar-entry-result"></span><div>${b('entry-cancel','Revert value','close')}<button type="submit" aria-label="Keep value">${icon('check')}<span>Keep value</span></button></div></form>`;
        w.$('.canvas-area').append(this.root);
        this.context=document.createElement('nav');this.context.className='planar-context';this.context.setAttribute('aria-label','Selected geometry');this.context.hidden=true;
        this.context.innerHTML=b('geometry','Edit on canvas','properties')+b('move','Move','move')+b('rotate','Rotate','rotate')+b('scale','Scale','scale');w.$('.canvas-area').append(this.context);
        this.panel=new PlanarToolPanel(w,this);
        const options={signal:w.abort.signal};
        this.root.addEventListener('click',e=>this.click(e),options);this.context.addEventListener('click',e=>this.click(e),options);
        this.root.querySelector('.planar-entry').addEventListener('submit',e=>{e.preventDefault();e.stopPropagation();this.acceptEntry();},options);
        this.root.querySelector('.planar-entry').addEventListener('input',()=>this.inputEntry(),options);
        this.root.querySelector('.planar-value-search').addEventListener('input',e=>this.filterFields(e.target.value),options);
        this.root.addEventListener('focusin',e=>{if(e.target.dataset.planarHandle)this.activeHandle=e.target.dataset.planarHandle;},options);
        w.root.addEventListener('conduit:selection',()=>this.sync(),options);
        w.root.addEventListener('conduit:documentchange',()=>{this.cancel();this.panel.close();this.sync();},options);
        let size='';this.resizeObserver=new ResizeObserver(entries=>{const r=entries[0].contentRect,key=r.width+':'+r.height;if(size&&size!==key)this.cancelDrag();size=key;this.updatePositions();});
        this.resizeObserver.observe(w.$('.viewport'));
    }
    get active(){return !!this.session;}
    get enabled(){return this.w.options.drawingInteraction!=='dialog';}
    report(message=''){const p=this.root.querySelector('.planar-error');p.textContent=message;p.hidden=!message;}
    action(id){
        if(!this.enabled)return false;
        if(id==='planar-example'){this.cancel();this.panel.close();this.w.openDocument(createVisualDraftingExample(),{context:{viewMode:'2d',currentLayer:'0'}});return true;}
        if(id.startsWith('2d-visual-')){this.start(id.slice(10));return true;}
        if(this.w.model3d.active)return false;
        const operation={'native-vertices':'geometry','rotate-angle':'rotate','offset':'offset','fillet':'fillet'}[id];
        if(operation){this.start(operation);return true;}
        if(id==='shapes'||id==='more'){this.panel.palette();return true;}
        if(id==='draw-exact-point'){this.panel.exactPoint();return true;}
        if(id==='draw-options'){this.panel.drawingOptions();return true;}
        return false;
    }
    start(operation='geometry',{create=null,field=null}={}){
        this.cancel();this.panel.close();this.w.closeModal();this.w.closePanels();this.w.setTool('select');this.w.input.reset();
        const facade=Object.create(this.w);facade.solver=new ConstraintSolver();
        const session=new PlanarEditSession(this.w.doc,[...this.w.selection],{operation,create,process:(draft,ids)=>{
            facade.doc=draft;facade.solveConstraints();refreshCalculations(facade);regenerateFeatures(draft);regenerateDimensions(draft);facade.reroute(ids);this.solveStatus=facade.lastSolve;
        }});
        this.nodes.clear();this.handles=[];this.hitHandles=[];this.root.querySelector('.planar-handles').replaceChildren();this.root.querySelector('.planar-options-body').replaceChildren();this.session=session;this.initialSelection=new Set(this.w.selection);this.initialCamera={x:this.w.camera.x,y:this.w.camera.y,scale:this.w.camera.scale};this.fitted=false;
        this.w.selection=new Set(session.ids);this.root.hidden=false;this.w.$('.canvas-area').classList.add('planar-active');this.context.hidden=true;
        this.root.querySelector('.planar-title').innerHTML=icon(glyphs[operation])+E(create?'Place '+create.type:titles[operation]);
        this.root.querySelector('.planar-options').hidden=true;this.root.querySelector('.planar-value-search').value='';this.optionsOpen=false;this.report();this.fieldsKey=null;
        this.requestPreview(true);this.root.querySelector('[data-planar-command=apply]').focus({preventScroll:true});if(field)this.openEntry(field);
        return session;
    }
    beginText(point){const w=this.w;return this.start('geometry',{create:text(point,'Label',14,{layer:w.currentLayer,layout:w.doc.activeLayout}),field:'text'});}
    requestPreview(immediate=false){
        if(!this.session)return;cancelAnimationFrame(this.frame);this.frame=0;this.root.querySelector('[data-planar-command=apply]').disabled=true;
        if(immediate)this.evaluatePreview();else this.frame=requestAnimationFrame(()=>{this.frame=0;this.evaluatePreview();});
    }
    evaluatePreview(){
        const s=this.session,w=this.w;if(!s)return;
        if(s.source!==w.doc||s.version!==w.doc.version){this.cancel('Source drawing changed');return;}
        try{const draft=s.evaluate();w.renderer.setDocument(draft);this.report();}catch(error){w.renderer.setDocument(w.doc);this.report(error.message);}
        this.render();w.renderer.invalidate();
    }
    displayValue(f){let value;try{value=this.session.value(f.name);}catch{return 'Invalid';}return f.name==='copy'?(value?'Copy':'Modify original'):f.type==='text'?(String(value).replace(/\s+/g,' ').slice(0,34)||'(empty)'):format(value);}
    fieldButton(f){return `<button type="button" data-planar-field="${E(f.name)}" ${f.readOnly?'disabled':''}><span>${E(f.label)}</span><strong>${E(this.displayValue(f))}</strong></button>`;}
    render(){
        const s=this.session;if(!s)return;
        const fields=s.definitions.filter(f=>!f.readOnly),main=fields.filter(f=>f.vertex===undefined&&!f.definition).slice(0,14),fh=this.root.querySelector('.planar-fields');
        const key=main.map(f=>f.name).join('|');if(this.fieldsKey!==key){this.fieldsKey=key;fh.innerHTML=main.map(f=>this.fieldButton(f)).join('');}
        for(const n of this.root.querySelectorAll('[data-planar-field]')){const f=s.field(n.dataset.planarField),label=this.displayValue(f);n.querySelector('strong').textContent=label;n.setAttribute('aria-label',`${f.label}: ${label}`);}
        this.root.querySelector('[data-planar-command=apply]').disabled=!s.preview||s.validatedRevision!==s.revision;
        this.root.querySelector('[data-planar-command=undo]').disabled=!s.undoStack.length;this.root.querySelector('[data-planar-command=redo]').disabled=!s.redoStack.length;
        const status=s.error?'Adjust the value to continue':this.drag?'Drag · Shift fine · Alt unsnapped':this.solveStatus?`Solved · ${this.solveStatus.degreesOfFreedom??this.solveStatus.dof??'?'} local degrees of freedom`:'Drag geometry · tap dimensions · Apply when ready';
        const p=this.root.querySelector('.planar-status');if(p.textContent!==status)p.textContent=status;
        this.updateHandles();
    }
    updateHandles(){
        if(!this.session)return;
        try{this.handles=this.session.preview?handles2(this.session,this.w.camera.scale):[];}catch{this.handles=[];}
        // Virtualize long native paths around the active control; exact values remain searchable.
        const all=this.handles,active=all.findIndex(h=>h.id===this.activeHandle),start=active>=128?Math.max(0,active-64):0;
        this.handles=all.slice(start,start+128);const keys=new Set(this.handles.map(h=>h.id));
        for(const[key,n]of this.nodes)if(!keys.has(key)){n.group.remove();this.nodes.delete(key);}
        for(const h of this.handles){
            let n=this.nodes.get(h.id);if(!n){const group=document.createElement('div');group.className='planar-handle-group';group.innerHTML=`<button type="button" class="planar-handle" data-planar-handle="${E(h.id)}" aria-label="${E(h.label)}">${icon(h.kind==='angle'?'rotate':h.kind==='axis'?'arrow':'move')}</button><button type="button" class="planar-dimension" data-planar-field="${E(h.fields[0])}"><span></span><strong></strong></button>`;this.root.querySelector('.planar-handles').append(group);n={group,button:group.firstElementChild,label:group.lastElementChild};this.nodes.set(h.id,n);}
            n.label.querySelector('span').textContent=h.label;const f=this.session.field(h.fields[0]),v=this.displayValue(f);n.label.querySelector('strong').textContent=v;n.label.setAttribute('aria-label',`${h.label}: ${v}`);
        }
        this.updatePositions();
    }
    updatePositions(){
        if(!this.session)return;const c=this.w.camera,width=c.width,height=c.height,bar=this.root.querySelector('.planar-controls').getBoundingClientRect();
        const candidates=(this.handles||[]).map(h=>{const raw=c.screen(h.point);return {...h,...raw,raw,hasLabel:h.fields.length===1,labelWidth:110,labelHeight:44,hideLabel:this.optionsOpen||!!this.drag&&h.id!==this.drag.handle.id};});
        const layout=layoutHandles3(candidates,{width,height,top:54,bottom:height-bar.height-16,active:this.drag?.handle.id||this.activeHandle,labels:height-bar.height>200});
        this.hitHandles=[];
        layout.forEach((l,i)=>{const h=candidates[i],n=this.nodes.get(h.id);n.group.hidden=!l.visible;if(!l.visible)return;n.button.style.left=l.x-22+'px';n.button.style.top=l.y-22+'px';n.button.dataset.projectedX=l.x;n.button.dataset.projectedY=l.y;this.hitHandles.push({...h,x:l.x,y:l.y});n.label.hidden=!l.label;if(l.label){n.label.style.left=l.label.x+'px';n.label.style.top=l.label.y+'px';}});
    }
    draw(ctx,cam){
        if(!this.session)return;ctx.save();ctx.lineWidth=1.2;ctx.strokeStyle='#087f73';ctx.fillStyle='#087f73';
        for(const h of this.hitHandles||[]){if(h.origin){const a=cam.screen(h.origin);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(h.raw.x,h.raw.y);ctx.stroke();if(h.kind==='angle'&&h.radius){ctx.beginPath();ctx.arc(a.x,a.y,h.radius*cam.scale,0,Math.PI*2);ctx.stroke();}}
            if(Math.hypot(h.x-h.raw.x,h.y-h.raw.y)>5){ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(h.raw.x,h.raw.y);ctx.lineTo(h.x,h.y);ctx.stroke();ctx.setLineDash([]);}ctx.beginPath();ctx.arc(h.raw.x,h.raw.y,2.3,0,Math.PI*2);ctx.fill();}
        ctx.restore();
    }
    pointerDown(p){
        if(!this.session)return false;
        const h=[...(this.hitHandles||[])].reverse().find(h=>Math.hypot(h.x-p.x,h.y-p.y)<=24);
        if(!h||p.button===1||this.w.space){this.nav=p;return true;}
        if(this.entryField&&!this.acceptEntry())return true;
        this.closeOptions();this.drag={handle:h,start:p,before:this.session.snapshot(),scale:this.w.camera.scale,moved:false};this.activeHandle=h.id;return true;
    }
    pointerMove(p){
        if(!this.session)return false;
        if(this.nav){this.w.camera.pan(p.x-this.nav.x,p.y-this.nav.y);this.nav=p;this.w.renderer.invalidate();return true;}
        const d=this.drag;if(!d)return true;if(!d.moved&&Math.hypot(p.x-d.start.x,p.y-d.start.y)<5)return true;d.moved=true;
        try{d.error=null;const step=p.alt||!this.snap?0:p.shift?this.step/10:this.step;dragHandle2(this.session,d.handle,{x:(p.x-d.start.x)/d.scale,y:-(p.y-d.start.y)/d.scale},d.before,{step,angleStep:p.alt||!this.snap?0:p.shift?1:15});this.requestPreview();}catch(error){d.error=error.message;cancelAnimationFrame(this.frame);this.frame=0;this.session.invalidate();this.session.error=d.error;this.w.renderer.setDocument(this.w.doc);this.report(error.message);this.root.querySelector('[data-planar-command=apply]').disabled=true;}
        return true;
    }
    pointerUp(p){
        if(!this.session)return false;this.nav=null;
        if(this.drag){this.pointerMove(p);const d=this.drag;this.drag=null;if(d.moved){this.session.checkpoint(d.before);if(!d.error)this.requestPreview(true);}else this.openEntry(d.handle.fields[0]);}
        return true;
    }
    cancelDrag(){this.nav=null;if(!this.drag||!this.session)return;const before=this.drag.before;this.drag=null;this.session.restore(before);this.requestPreview(true);}
    openEntry(name){
        if(!this.session)return;const f=this.session.field(name);if(f.readOnly)return;
        if(this.entryField&&!this.acceptEntry())return;const vertex=/^v(\d+)[xyb]$/.exec(name),hatch=/^(h\d+v\d+)[xy]$/.exec(name);if(vertex)this.activeHandle='vertex-'+vertex[1];if(hatch)this.activeHandle=hatch[1];this.entryField=name;this.entryBefore=this.session.snapshot();
        const form=this.root.querySelector('.planar-entry'),label=form.querySelector('label');
        const control=f.type==='text'?`<textarea rows="3" maxlength="16000"></textarea>`:f.type==='choice'?`<select>${f.options.map((v,i)=>`<option value="${i}">${E(name==='copy'?(v?'Create copy':'Modify original'):format(v))}</option>`).join('')}</select>`:'<input autocomplete="off" spellcheck="false">';
        label.innerHTML=`<span>${E(f.label)}${f.type==='text'?'':' · value or expression'}</span>${control}`;form.hidden=false;const input=label.lastElementChild;
        input.value=f.type==='choice'?String(f.options.indexOf(this.session.parameters[name])):String(this.session.parameters[name]);input.setAttribute('aria-label',f.label);input.focus({preventScroll:true});input.select?.();this.entryFeedback();this.updateHandles();
    }
    entryFeedback(){const result=this.root.querySelector('.planar-entry-result');if(!this.session||!this.entryField)return;try{const f=this.session.field(this.entryField),value=this.session.value(this.entryField);result.textContent=f.type==='text'?'Live text preview · Apply keeps the drawing change':f.type==='choice'?'Live option preview':'= '+format(value)+' · Enter keeps this value';this.root.querySelector('.planar-entry label').lastElementChild.setAttribute('aria-invalid',String(!!this.session.error));}catch(error){result.textContent=error.message;this.root.querySelector('.planar-entry label').lastElementChild.setAttribute('aria-invalid','true');}}
    inputEntry(){if(!this.entryField||!this.session)return;try{const f=this.session.field(this.entryField),input=this.root.querySelector('.planar-entry label').lastElementChild;this.session.set(f.name,f.type==='choice'?f.options[+input.value]:input.value);this.entryFeedback();this.requestPreview();return true;}catch(error){cancelAnimationFrame(this.frame);this.frame=0;this.session.invalidate();this.session.error=error.message;this.w.renderer.setDocument(this.w.doc);this.render();this.report(error.message);this.entryFeedback();return false;}}
    acceptEntry(){if(!this.entryField)return true;if(this.inputEntry()===false)return false;this.requestPreview(true);if(!this.session?.preview){this.entryFeedback();return false;}this.session.checkpoint(this.entryBefore);this.hideEntry();this.render();return true;}
    hideEntry(){const form=this.root.querySelector('.planar-entry');if(form.contains(document.activeElement))this.w.$('.viewport').focus({preventScroll:true});form.hidden=true;this.entryField=null;this.entryBefore=null;}
    abortEntry(){if(this.entryField&&this.session){this.session.restore(this.entryBefore);this.hideEntry();this.requestPreview(true);}}
    openOptions(){if(this.entryField&&!this.acceptEntry())return;this.optionsOpen=true;this.root.querySelector('.planar-options').hidden=false;this.root.querySelector('[data-planar-command=options]').setAttribute('aria-expanded','true');this.filterFields(this.root.querySelector('.planar-value-search').value);this.updatePositions();}
    filterFields(query){if(!this.session)return;const words=query.toLowerCase().trim().split(/\s+/),fields=this.session.definitions.filter(f=>words.every(w=>(f.label+' '+f.name).toLowerCase().includes(w))),visible=fields.slice(0,80);this.root.querySelector('.planar-options-body').innerHTML=visible.map(f=>this.fieldButton(f)).join('')+`<p>${fields.length>80?'Showing first 80; refine the search.':fields.length+' values'}</p>`;}
    closeOptions(){this.optionsOpen=false;this.root.querySelector('.planar-options').hidden=true;this.root.querySelector('[data-planar-command=options]').setAttribute('aria-expanded','false');this.updatePositions();}
    fit(){if(!this.session?.preview)return;let box=emptyBounds();for(const e of this.session.preview.entities)if(this.session.resultIds.includes(e.id))box=union(box,entityBounds(e,this.session.preview));if(validBounds(box)){this.w.camera.fit(box,100);this.fitted=true;this.w.renderer.invalidate();}}
    async click(event){
        const field=event.target.closest('[data-planar-field]'),command=event.target.closest('[data-planar-command]');if(!field&&!command)return;event.preventDefault();event.stopPropagation();
        try{if(field){this.openEntry(field.dataset.planarField);return;}const id=command.dataset.planarCommand;
            if(Object.hasOwn(titles,id)){this.start(id);return;}if(id==='apply'){this.apply();return;}if(id==='cancel'){this.cancel();return;}if(id==='entry-cancel'){this.abortEntry();return;}
            if(id==='options'){this.optionsOpen?this.closeOptions():this.openOptions();return;}if(id==='options-close'){this.closeOptions();return;}if(id==='fit'){this.fit();return;}
            if(id==='snap'){this.snap=!this.snap;command.setAttribute('aria-pressed',String(this.snap));command.querySelector('span').textContent=this.snap?'Snap '+this.step:'Unsnapped';return;}
            if(id==='undo'||id==='redo'){this.abortEntry();this.cancelDrag();this.session[id]();this.requestPreview(true);}
        }catch(error){this.report(error.message);this.w.toast(error.message,true);}
    }
    apply(){
        const s=this.session;if(!s)return;if(this.entryField&&!this.acceptEntry())return;this.cancelDrag();
        if(this.frame)this.requestPreview(true);
        // Never let keyboard/API activation bypass a failed gesture or stale preview.
        if(this.session!==s)return;
        if(s.error||!s.preview||s.validatedRevision!==s.revision){this.report(s.error||'A valid current preview is required');return;}
        try{if(!s.changed){this.finish();return;}this.applying=true;this.w.edit(titles[s.operation],()=>{const ids=s.commit(this.w.doc);this.w.selection=new Set(ids);});this.finish();}
        catch(error){this.report(error.message);if(s.source!==this.w.doc)this.cancel('The edit was rolled back; restart on the restored drawing');}
        finally{this.applying=false;}
    }
    finish(){
        cancelAnimationFrame(this.frame);this.frame=0;const s=this.session;this.session=null;this.drag=null;this.nav=null;this.hideEntry();s?.cancel();this.nodes.clear();this.root.querySelector('.planar-handles').replaceChildren();this.root.hidden=true;this.w.$('.canvas-area').classList.remove('planar-active');this.w.renderer.setDocument(this.w.doc);this.w.updateSelection();this.w.$('.viewport').focus({preventScroll:true});
    }
    cancel(message=''){
        if(!this.session)return;const same=this.session.source===this.w.doc;if(same){this.w.selection=this.initialSelection;if(this.fitted)Object.assign(this.w.camera,this.initialCamera);}this.finish();if(message)this.w.toast(message);
    }
    beforeEdit(){if(!this.applying)this.cancel();}
    sync(){
        if(this.active&&!this.applying&&(this.session.source!==this.w.doc||this.session.version!==this.w.doc.version||this.w.model3d.active))this.cancel('Drawing or workspace changed');
        const selected=this.w.selected();this.context.hidden=!!this.w.parameters?.active||!this.enabled||this.active||this.w.model3d.active||this.w.tool!=='select'||!selected.length||selected.some(e=>planarEditable(e,this.w.doc));
        this.context.querySelector('[data-planar-command=geometry]').disabled=selected.length!==1;
    }
    keyDown(e){
        if(this.panel.keyDown(e))return true;if(!this.active)return false;
        if(e.key==='Escape'){e.preventDefault();if(this.entryField)this.abortEntry();else if(this.optionsOpen)this.closeOptions();else this.cancel();return true;}
        if(e.target.closest('input,select,textarea'))return false;
        const cmd=e.ctrlKey||e.metaKey;if(cmd&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();this.cancelDrag();this.session[e.key.toLowerCase()==='y'||e.shiftKey?'redo':'undo']();this.requestPreview(true);return true;}
        const key=e.target.dataset.planarHandle,h=this.hitHandles?.find(h=>h.id===key);
        if(h&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
            e.preventDefault();const amount=e.shiftKey?.1:1,delta={x:e.key==='ArrowRight'?amount:e.key==='ArrowLeft'?-amount:0,y:e.key==='ArrowUp'?amount:e.key==='ArrowDown'?-amount:0},before=this.session.snapshot();
            try{if(h.kind==='angle')this.session.dragValue(h.fields[0],this.session.value(h.fields[0])+(delta.x||delta.y),before);else dragHandle2(this.session,h,delta,before);this.session.checkpoint(before);this.requestPreview(true);}catch(error){this.report(error.message);}return true;
        }
        if(e.key==='Enter'&&h){e.preventDefault();this.openEntry(h.fields[0]);return true;}
        if(e.key==='Enter'&&!e.target.closest('button')){e.preventDefault();this.apply();return true;}
        if(['Delete','Backspace'].includes(e.key)||!cmd&&e.key.length===1)return true; // Do not arm a different CAD command mid-draft.
        return false;
    }
    dispose(){this.cancel();this.panel.dispose();this.resizeObserver.disconnect();this.root.remove();this.context.remove();}
}
