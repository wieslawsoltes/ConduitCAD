import { beginAxisDrag3, updateAxisDrag3, expressionDelta3, measurePoints3, sectionFrame3 } from '@conduitcad/manipulation3d';
import { V3, add3, mul3, dot3, faceNormal, meshProperties, sliceMesh } from '@conduitcad/geometry3d';
import { clone, entity, isLocked, resolveStyle } from '@conduitcad/model';
import { MATERIAL_PRESETS, normalizeMaterial } from '@conduitcad/renderer3d';
import { syncDisplay3D } from './display-workbench.js';
import { escapeHTML as E, icon } from './icons.js';
const number=n=>Number(n.toPrecision(8)).toString();
const cmd=(id,label,glyph='properties',extra='')=>`<button type="button" data-inspect-command="${id}" aria-label="${E(label)}" title="${E(label)}" ${extra}>${icon(glyph)}<span>${E(label)}</span></button>`;
const normals={x:V3(1,0,0),y:V3(0,1,0),z:V3(0,0,1)};
/** Non-modal section, measurement and appearance workflows on the existing depth renderer. */
export class VisualInspection3D {
    constructor(m){
        this.m=m;this.w=m.w;this.mode=null;this.frame=0;this.drag=null;this.valid=true;
        this.root=document.createElement('div');this.root.className='inspect3d';this.root.hidden=true;
        this.root.innerHTML=`<section class="inspect3d-panel" role="region" aria-label="3D inspection options"><header><strong></strong>${cmd('collapse','Preview model','eye')}</header><div class="inspect3d-body"></div></section><div class="inspect3d-markers"></div><div class="inspect3d-controls" role="toolbar" aria-label="3D inspection actions"><div class="inspect3d-tools"></div><div class="inspect3d-confirm">${cmd('options','Options','settings')}${cmd('cancel','Cancel','close')}${cmd('apply','Keep','check','class="primary"')}</div><p class="inspect3d-error" role="alert" hidden></p></div>`;
        m.stage.append(this.root);const options={signal:this.w.abort.signal};this.root.addEventListener('click',e=>this.click(e),options);this.root.addEventListener('input',e=>this.input(e),options);this.root.addEventListener('change',e=>{if(e.target.matches('select'))this.input(e);},options);
        this.w.root.addEventListener('conduit:documentchange',()=>this.cancel(),options);
        let last='';this.observer=new ResizeObserver(entries=>{const r=entries[0].contentRect,key=r.width+':'+r.height;if(last&&last!==key)this.cancelDrag();last=key;this.updatePositions();});this.observer.observe(m.host);
    }
    get active(){return !!this.mode;}
    get persistedSection(){return this.active&&this.source===this.w.doc?this.originalSection:this.m.renderer?.section;}
    get persistedDisplay(){return this.mode==='appearance'&&this.source===this.w.doc?this.originalDisplay:this.m.renderer?.displaySettings;}
    report(message=''){const n=this.root.querySelector('.inspect3d-error');n.textContent=message;n.hidden=!message;}
    start(mode){
        if(!['section','measure','appearance'].includes(mode))throw new Error('Unknown inspection mode');
        this.cancel();this.m.visual.cancel();this.m.visual.closePalette();this.w.closeModal();this.w.closePanels();this.m.input.reset();
        this.source=this.w.doc;this.version=this.w.doc.version;this.signature=JSON.stringify(this.w.doc);this.originalSection=clone(this.m.renderer.section);this.originalDisplay=this.m.renderer.displaySettings;this.base=clone(this.w.doc);this.ids=[...this.w.selection];this.valid=true;
        if(mode==='appearance'){const e=this.w.selected()[0];if(!e)throw new Error('Select at least one editable entity');if(this.w.selected().some(e=>isLocked(e,this.w.doc)))throw new Error('A selected entity is locked');const style=resolveStyle(e,this.w.doc);this.material=normalizeMaterial({...e.appearance3d,color:style.color,opacity:style.opacity},style.color);this.originalMaterial=clone(this.material);this.values={...this.material};this.realistic=true;}
        this.mode=mode;this.root.hidden=false;this.root.querySelector('.inspect3d-panel').hidden=false;this.m.stage.classList.add('inspect3d-active');this.report();
        const body=this.root.querySelector('.inspect3d-body'),tools=this.root.querySelector('.inspect3d-tools');
        const title={section:'Section on canvas',measure:'Measure on the model',appearance:'Appearance on canvas'}[mode];this.root.querySelector('header strong').textContent=title;
        this.root.querySelector('[data-inspect-command=apply]').querySelector('span').textContent=mode==='measure'?'Done':'Apply';
        if(mode==='section'){
            const box=this.m.renderer.scene.bounds,c=box.empty?V3():mul3(add3(box.min,box.max),.5);this.center=c;this.span=box.empty?100:Math.max(10,...['x','y','z'].map(k=>box.max[k]-box.min[k]))*1.25;
            this.normal=clone(this.originalSection?.normal||normals.z);this.offsetSource=String(this.originalSection?.offset??dot3(c,this.normal));this.enabled=true;this.pickingFace=false;
            body.innerHTML=`<p>Drag the plane handle, type an offset, or align to a picked face. Orbit and zoom remain available.</p><div class="inspect3d-axis">${['x','y','z'].map(k=>cmd('axis-'+k,k.toUpperCase(),'axis-'+k)).join('')}${cmd('camera','View plane','eye')}${cmd('face','Pick face','face')}${cmd('flip','Flip','rotate')}</div><label>Signed offset · ${E(this.w.doc.units)}<input data-inspect-offset autocomplete="off" spellcheck="false" value="${E(this.offsetSource)}"></label><label class="inspect3d-check"><input data-inspect-enabled type="checkbox" checked>Enable section clipping</label><p class="inspect3d-section-info"></p><p>Caps and hatching are display only. Create section lines makes an independent WCS snapshot, not a solid split.</p>`;
            tools.innerHTML=cmd('section-lines','Create section lines','line');this.root.querySelector('.inspect3d-markers').innerHTML=`<button type="button" class="inspect3d-plane-handle" aria-label="Section offset handle" role="slider" tabindex="0">${icon('arrow')}</button><button type="button" class="inspect3d-plane-value" data-inspect-command="offset" aria-label="Exact section offset"></button>`;this.update(true);
        }else if(mode==='measure'){
            this.points=[];this.pickIndex=0;this.vertexSnap=false;this.measurement=null;
            body.innerHTML=`<p class="inspect3d-prompt" role="status">Tap the first point on visible geometry.</p><label class="inspect3d-check"><input data-inspect-vertices type="checkbox">Snap to native vertices</label><div class="inspect3d-readings"></div><details><summary>Exact XYZ points</summary>${[0,1].map(i=>`<fieldset><legend>Point ${i+1}</legend>${['x','y','z'].map(k=>`<label>${k.toUpperCase()}<input data-inspect-point="${i}:${k}" value="0" autocomplete="off" spellcheck="false"></label>`).join('')}</fieldset>`).join('')}</details><div class="inspect3d-topology"></div><p>Measurements are world-space snapshots. They do not constrain or associate to the picked geometry. Mesh volume is faceted and is not a self-intersection certificate.</p>`;
            tools.innerHTML=cmd('pick0','Point 1','point')+cmd('pick1','Point 2','point')+cmd('new-pair','New pair','plus')+cmd('guide-line','Create guide line','line');this.root.querySelector('.inspect3d-markers').replaceChildren();this.topology();this.updateMeasurement();
        }else{
            body.innerHTML=`<p>${this.ids.length} selected. Presets and sliders preview directly on the model. Apply keeps one undoable edit.</p><div class="inspect3d-materials">${MATERIAL_PRESETS.map(p=>`<button type="button" data-inspect-preset="${p.id}" aria-label="${E(p.label)}"><i style="background:${p.color}"></i><span>${E(p.label)}</span></button>`).join('')}</div><label>Color<input type="color" data-inspect-material="color" value="${this.material.color}"></label>${['metallic','roughness','opacity','emission'].map(k=>`<label>${k[0].toUpperCase()+k.slice(1)}<span class="inspect3d-coefficient"><input type="range" aria-label="${k} slider" data-inspect-range="${k}" min="${k==='roughness'?.04:0}" max="${k==='emission'?4:1}" step=".01" value="${this.material[k]}"><input aria-label="${k} expression" data-inspect-material="${k}" value="${this.material[k]}" autocomplete="off" spellcheck="false"></span></label>`).join('')}<label class="inspect3d-check"><input type="checkbox" data-inspect-realistic checked>Preview realistic shading</label><p>Native color/opacity; Conduit material coefficients. Transparent polymer is weighted transparency, not optical refraction. Coefficient expressions are evaluated at Apply, not persistent constraints.</p>`;
            tools.innerHTML=cmd('reset-material','Reset','reset');this.root.querySelector('.inspect3d-markers').replaceChildren();this.update(true);
        }
        this.root.querySelector('header strong').tabIndex=-1;this.root.querySelector('header strong').focus({preventScroll:true});this.m.renderer.invalidate();
    }
    update(immediate=false){cancelAnimationFrame(this.frame);this.frame=0;if(!this.active)return;const run=()=>{this.frame=0;if(!this.active)return;try{if(this.mode==='section')this.previewSection();else if(this.mode==='appearance')this.previewMaterial();this.valid=true;this.report();}catch(error){this.valid=false;this.report(error.message);if(this.mode==='section')this.m.renderer.section=this.originalSection;if(this.mode==='appearance'){this.m.previewDocument=null;this.m.renderer.setDocument(this.w.doc,{showInputs:this.m.showInputs});}}this.root.querySelector('[data-inspect-command=apply]').disabled=!this.valid;this.updatePositions();this.m.renderer.invalidate();};if(immediate)run();else this.frame=requestAnimationFrame(run);}
    previewSection(){const offset=this.w.eval(this.offsetSource);if(!Number.isFinite(offset)||Math.abs(offset)>1e12)throw new Error('Use a finite section offset within drawing range');this.guide=sectionFrame3(this.normal,offset,this.center,this.span);this.m.renderer.section=this.enabled?{normal:this.guide.normal,offset:this.guide.offset}:null;const info=this.root.querySelector('.inspect3d-section-info');info.textContent='Normal '+['x','y','z'].map(k=>number(this.normal[k])).join(', ')+' · offset '+number(offset);}
    previewMaterial(){const values={color:this.values.color};if(!/^#[0-9a-f]{6}$/i.test(values.color))throw new Error('Use a six-digit RGB color');for(const k of ['metallic','roughness','opacity','emission']){const n=this.w.eval(String(this.values[k])),lo=k==='roughness'?.04:0,hi=k==='emission'?4:1;if(!Number.isFinite(n)||n<lo||n>hi)throw new Error(k+' must be between '+lo+' and '+hi);values[k]=n;}
        const draft=clone(this.base);for(const e of draft.entities)if(this.ids.includes(e.id))Object.assign(e,{color:values.color,opacity:values.opacity,appearance3d:{...values},dirty:true});this.material=values;this.m.previewDocument=draft;this.m.renderer.setDocument(draft,{showInputs:this.m.showInputs});this.m.renderer.setDisplaySettings(this.realistic?{style:'realistic'}:this.originalDisplay,{replace:!this.realistic});syncDisplay3D(this.m);
    }
    topology(){const items=this.m.renderer.scene.items.filter(i=>this.ids.includes(i.id)&&i.faces.length),out=[];for(const item of items.slice(0,16)){try{const p=meshProperties(item);out.push(`<h4>${E(this.w.doc.entities.find(e=>e.id===item.id)?.label||item.id)}</h4><dl><dt>Surface area</dt><dd>${number(p.area)} ${E(this.w.doc.units)}²</dd><dt>Volume</dt><dd>${p.volume===null?'Open / non-manifold':number(p.volume)+' '+E(this.w.doc.units)+'³'}</dd><dt>Boundary edges</dt><dd>${p.boundaryEdges}</dd></dl>`);}catch(error){out.push(`<p>${E(error.message)}</p>`);}}this.root.querySelector('.inspect3d-topology').innerHTML=out.join('')||'<p>Select a body before Inspect for area/volume details.</p>';}
    updateMeasurement(){
        const host=this.root.querySelector('.inspect3d-readings');if(!host)return;this.measurement=this.points.length===2?measurePoints3(...this.points):null;
        const v=this.measurement;host.innerHTML=v?`<strong class="inspect3d-distance">${number(v.distance)} ${E(this.w.doc.units)}</strong><dl>${[['ΔX',v.delta.x],['ΔY',v.delta.y],['ΔZ',v.delta.z],['XY distance',v.horizontal],['Inclination °',v.inclination]].map(([k,n])=>`<dt>${k}</dt><dd>${number(n)}</dd>`).join('')}</dl>`:'<p>Pick two points to measure a distance.</p>';
        this.root.querySelector('.inspect3d-prompt').textContent=this.pickIndex===null?'Tap Point 1 or Point 2 to replace it. Orbit without losing the measurement.':`Tap point ${this.pickIndex+1} on visible geometry.`;
        this.root.querySelector('[data-inspect-command=guide-line]').disabled=!v||v.distance<=1e-8||!this.valid;
        const markers=this.root.querySelector('.inspect3d-markers');markers.innerHTML=this.points.map((p,i)=>`<button type="button" data-inspect-command="pick${i}" class="inspect3d-measure-point" aria-label="Replace measurement point ${i+1}">${i+1}</button>`).join('')+(v?'<span class="inspect3d-measure-label"></span>':'');this.updatePositions();this.m.renderer.invalidate();
    }
    input(e){const n=e.target;try{
        if(n.matches('[data-inspect-offset]')){this.offsetSource=n.value;this.update();}
        if(n.matches('[data-inspect-enabled]')){this.enabled=n.checked;this.update();}
        if(n.matches('[data-inspect-realistic]')){this.realistic=n.checked;this.update();}
        if(n.matches('[data-inspect-vertices]'))this.vertexSnap=n.checked;
        if(n.dataset.inspectMaterial){this.values[n.dataset.inspectMaterial]=n.value;const range=this.root.querySelector(`[data-inspect-range="${n.dataset.inspectMaterial}"]`);if(range){try{range.value=this.w.eval(n.value);}catch{}}this.update();}
        if(n.dataset.inspectRange){this.values[n.dataset.inspectRange]=n.value;this.root.querySelector(`[data-inspect-material="${n.dataset.inspectRange}"]`).value=n.value;this.update();}
        if(n.dataset.inspectPoint){const points=[V3(),V3()];for(const input of this.root.querySelectorAll('[data-inspect-point]')){const[i,k]=input.dataset.inspectPoint.split(':');const value=this.w.eval(input.value);if(!Number.isFinite(value)||Math.abs(value)>1e12)throw new Error('Invalid measurement coordinate');points[+i][k]=value;}this.points=points;this.pickIndex=null;this.valid=true;this.report();this.updateMeasurement();}
    }catch(error){this.valid=false;this.report(error.message);this.measurement=null;this.root.querySelector('.inspect3d-readings')?.replaceChildren();this.root.querySelector('.inspect3d-markers')?.replaceChildren();const button=this.root.querySelector('[data-inspect-command=guide-line]');if(button)button.disabled=true;this.m.renderer.invalidate();}}
    updatePositions(){
        if(!this.active)return;const c=this.m.camera,w=c.width,h=c.pixelHeight,bottom=h-this.root.querySelector('.inspect3d-controls').getBoundingClientRect().height-15;
        if(this.mode==='section'){
            const button=this.root.querySelector('.inspect3d-plane-handle'),label=this.root.querySelector('.inspect3d-plane-value');if(!button||!this.guide)return;const p=c.project(this.guide.origin),x=Math.max(26,Math.min(w-26,p.x)),y=Math.max(66,Math.min(bottom-25,p.y));button.hidden=!p.visible||!this.valid||!this.enabled;label.hidden=button.hidden;this.handle={x,y,raw:p,point:this.guide.origin};button.style.left=x-22+'px';button.style.top=y-22+'px';button.setAttribute('aria-valuenow',String(this.guide.offset));button.setAttribute('aria-valuetext',number(this.guide.offset)+' '+this.w.doc.units);button.setAttribute('aria-valuemin','-1000000000000');button.setAttribute('aria-valuemax','1000000000000');label.textContent=number(this.guide.offset)+' '+this.w.doc.units;label.style.left=Math.max(6,Math.min(w-140,x+30))+'px';label.style.top=Math.max(52,Math.min(bottom-44,y-60))+'px';
        }else if(this.mode==='measure'){
            for(const[n,i]of [...this.root.querySelectorAll('.inspect3d-measure-point')].map((n,i)=>[n,i])){const p=c.project(this.points[i]);n.hidden=!p.visible;n.style.left=Math.max(0,Math.min(w-44,p.x-22))+'px';n.style.top=Math.max(52,Math.min(bottom-44,p.y-22))+'px';}
            const label=this.root.querySelector('.inspect3d-measure-label');if(label&&this.measurement){const p=c.project(this.measurement.midpoint);label.hidden=!p.visible||!this.valid;label.textContent=number(this.measurement.distance)+' '+this.w.doc.units;label.style.left=Math.max(8,Math.min(w-150,p.x-40))+'px';label.style.top=Math.max(52,Math.min(bottom-44,p.y-40))+'px';}
        }
    }
    draw(ctx){
        if(!this.active||!this.valid)return;const c=this.m.camera;ctx.save();ctx.lineWidth=1.5;ctx.strokeStyle='#b56d21';ctx.fillStyle='#db913712';
        if(this.mode==='section'&&this.guide&&this.enabled){const corners=this.guide.corners.map(p=>c.project(p));if(corners.every(p=>p.visible)){ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.setLineDash([6,4]);ctx.stroke();ctx.setLineDash([]);}const p=c.project(this.guide.origin),q=c.project(add3(this.guide.origin,mul3(this.normal,this.span*.15)));if(p.visible&&q.visible){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}if(this.handle&&p.visible){ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(this.handle.x,this.handle.y);ctx.stroke();}}
        if(this.mode==='measure'&&this.points.length){ctx.strokeStyle='#087f73';ctx.fillStyle='#087f73';for(const p of this.points.map(p=>c.project(p)))if(p.visible){ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();}if(this.measurement){const a=c.project(this.points[0]),b=c.project(this.points[1]);if(a.visible&&b.visible){ctx.setLineDash([5,3]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}}ctx.restore();
    }
    pointerDown(p){if(this.mode!=='section'||this.pickingFace||!this.handle||!this.valid||!this.enabled)return false;if(Math.hypot(p.x-this.handle.x,p.y-this.handle.y)>24)return false;
        this.root.querySelector('.inspect3d-panel').hidden=true;const raw=this.handle.raw;this.drag={start:p,before:this.offsetSource,value:this.w.eval(this.offsetSource),motion:beginAxisDrag3(this.m.camera,this.handle.point,this.normal,raw),offset:{x:raw.x-p.x,y:raw.y-p.y},moved:false};return true;}
    pointerMove(p){if(!this.drag)return false;const d=this.drag;if(!d.moved&&Math.hypot(p.x-d.start.x,p.y-d.start.y)<5)return true;d.moved=true;try{let delta=updateAxisDrag3(d.motion,{x:p.x+d.offset.x,y:p.y+d.offset.y});if(!p.alt)delta=Math.round(delta/(p.shift?.1:1))*(p.shift?.1:1);this.offsetSource=String(expressionDelta3(d.before,delta,d.value));this.root.querySelector('[data-inspect-offset]').value=this.offsetSource;this.update();}catch(error){this.report(error.message);}return true;}
    pointerUp(p){if(!this.drag)return false;this.pointerMove(p);const d=this.drag;this.drag=null;if(!d.moved)this.focusOffset();else this.update(true);return true;}
    cancelDrag(){if(!this.drag)return;this.offsetSource=this.drag.before;this.drag=null;this.root.querySelector('[data-inspect-offset]').value=this.offsetSource;this.update(true);}
    pickAt(p){
        if(!this.active)return false;if(this.mode==='appearance'||this.mode==='section'&&!this.pickingFace)return true;
        try{
            const hit=this.m.renderer.pick(p.x,p.y,{mode:this.mode==='section'?'face':this.vertexSnap?'vertex':'body',radius:p.pointerType==='touch'?20:10});if(!hit)throw new Error('Tap visible geometry'+(this.vertexSnap?' close to a native vertex':''));
            if(this.mode==='section'){const item=this.m.renderer.scene.items.find(i=>i.id===hit.id&&i.sourceId===hit.sourceId&&i.faces[hit.face]);if(!item)throw new Error('Pick a polygon face');this.normal=faceNormal(item.points,item.faces[hit.face]);this.offsetSource=String(dot3(hit.point,this.normal));this.pickingFace=false;this.root.querySelector('[data-inspect-offset]').value=this.offsetSource;this.update(true);}
            else if(this.pickIndex!==null){if(!this.points[0])this.pickIndex=0;this.points[this.pickIndex]=clone(hit.point);this.pickIndex=this.points.length===2?null:1;this.valid=true;this.report();this.syncPointFields();this.updateMeasurement();}
        }catch(error){this.report(error.message);}return true;
    }
    syncPointFields(){for(const input of this.root.querySelectorAll('[data-inspect-point]')){const[i,k]=input.dataset.inspectPoint.split(':');input.value=String(this.points[+i]?.[k]??0);}}
    focusOffset(){this.root.querySelector('.inspect3d-panel').hidden=false;const input=this.root.querySelector('[data-inspect-offset]');input.focus({preventScroll:true});input.select();}
    async click(event){
        const button=event.target.closest('button');if(!button)return;event.preventDefault();event.stopPropagation();try{
            if(button.dataset.inspectPreset){const p=MATERIAL_PRESETS.find(p=>p.id===button.dataset.inspectPreset);if(!p)return;this.values={...normalizeMaterial(p,p.color)};this.syncMaterialFields();this.update(true);return;}
            const id=button.dataset.inspectCommand||'';if(id==='cancel'){this.cancel();return;}if(id==='apply'){this.apply();return;}
            if(id==='options'||id==='collapse'){this.root.querySelector('.inspect3d-panel').hidden=id==='collapse';return;}
            if(id==='offset'){this.focusOffset();return;}
            if(id.startsWith('axis-')){this.normal=normals[id.slice(5)];this.offsetSource=String(dot3(this.center,this.normal));this.root.querySelector('[data-inspect-offset]').value=this.offsetSource;this.update(true);}
            if(id==='camera'){this.normal=mul3(this.m.camera.basis().forward,-1);this.offsetSource=String(dot3(this.center,this.normal));this.root.querySelector('[data-inspect-offset]').value=this.offsetSource;this.update(true);}
            if(id==='flip'){this.normal=mul3(this.normal,-1);this.offsetSource='-('+this.offsetSource+')';this.root.querySelector('[data-inspect-offset]').value=this.offsetSource;this.update(true);}
            if(id==='face'){this.pickingFace=true;this.root.querySelector('.inspect3d-panel').hidden=true;this.report('Tap a polygon face to place the section plane');}
            if(id==='section-lines'){this.createSection();return;}
            if(id==='pick0'||id==='pick1'){this.pickIndex=this.points[0]?+id.at(-1):0;this.updateMeasurement();}
            if(id==='new-pair'){this.points=[];this.pickIndex=0;this.valid=true;this.report();this.syncPointFields();this.updateMeasurement();}
            if(id==='guide-line'){this.createGuide();return;}
            if(id==='reset-material'){this.values=clone(this.originalMaterial);this.syncMaterialFields();this.update(true);}
        }catch(error){this.report(error.message);}
    }
    syncMaterialFields(){for(const e of this.root.querySelectorAll('[data-inspect-material]'))e.value=this.values[e.dataset.inspectMaterial];for(const e of this.root.querySelectorAll('[data-inspect-range]'))e.value=this.values[e.dataset.inspectRange];}
    guard(){if(this.source!==this.w.doc||JSON.stringify(this.w.doc)!==this.signature)throw new Error('The drawing changed. Restart inspection before creating geometry.');}
    createSection(){
        this.update(true);if(!this.valid)throw new Error('Correct the section plane first');this.guard();const items=this.m.renderer.scene.items.filter(i=>this.ids.includes(i.id)&&i.faces.length);if(!items.length)throw new Error('Select one or more mesh bodies before starting a section');
        const segments=[];for(const item of items){segments.push(...sliceMesh(item,this.guide.normal,this.guide.offset));if(segments.length>100000)throw new Error('Section exceeds 100000 segments');}if(!segments.length)throw new Error('This plane does not intersect the selected bodies');
        const lines=segments.map(([a,b])=>entity('LINE',{a,b,layer:this.outputLayer(),layout:'Model',color:'#b56d21'}));this.applying=true;
        try{this.w.edit('Create spatial section lines',()=>{this.w.doc.entities.push(...lines);this.w.selection=new Set(lines.map(e=>e.id));});this.finish(true);}finally{this.applying=false;}
    }
    outputLayer(){const l=this.w.doc.layers.find(l=>l.name===this.w.currentLayer&&!l.locked&&l.visible!==false)||this.w.doc.layers.find(l=>!l.locked&&l.visible!==false);if(!l)throw new Error('Choose an unlocked visible output layer');return l.name;}
    createGuide(){if(!this.valid||!this.measurement||this.measurement.distance<=1e-8)throw new Error('Pick two distinct valid points');this.guard();const e=entity('LINE',{a:clone(this.points[0]),b:clone(this.points[1]),layout:'Model',layer:this.outputLayer()});this.applying=true;try{this.w.edit('Create measured guide line',()=>{this.w.doc.entities.push(e);this.w.selection=new Set([e.id]);});this.finish(true);}finally{this.applying=false;}}
    apply(){
        if(this.mode==='measure'){this.finish(true);return;}this.update(true);if(!this.valid)return;
        try{this.guard();this.applying=true;if(this.mode==='appearance'&&this.ids.some(id=>{const e=this.base.entities.find(e=>e.id===id),s=resolveStyle(e,this.base);return JSON.stringify(normalizeMaterial({...e.appearance3d,color:s.color,opacity:s.opacity},s.color))!==JSON.stringify(this.material);})){const material=clone(this.material);this.w.edit('Visual appearance',()=>{for(const e of this.w.doc.entities)if(this.ids.includes(e.id)){if(isLocked(e,this.w.doc))throw new Error('A material target is locked');Object.assign(e,{color:material.color,opacity:material.opacity,appearance3d:{...material},dirty:true});}});}this.finish(true);}catch(error){this.report(error.message);if(this.source!==this.w.doc)this.cancel();}finally{this.applying=false;}
    }
    finish(accepted=false){
        if(!this.active)return;cancelAnimationFrame(this.frame);this.frame=0;const same=this.source===this.w.doc,mode=this.mode;
        if(same&&!accepted){if(mode==='section')this.m.renderer.section=this.originalSection;if(mode==='appearance')this.m.renderer.setDisplaySettings(this.originalDisplay,{replace:true});}
        this.mode=null;this.drag=null;this.guide=null;this.points=[];this.measurement=null;this.m.previewDocument=null;this.root.hidden=true;this.m.stage.classList.remove('inspect3d-active');this.m.renderer.setDocument(this.w.doc,{showInputs:this.m.showInputs});syncDisplay3D(this.m);if(same)this.m.saveView();this.m.renderer.invalidate();this.m.host.focus({preventScroll:true});
    }
    cancel(){this.finish(false);}
    beforeEdit(){if(!this.applying)this.cancel();}
    externalChange(){if(this.active&&!this.applying&&(this.source!==this.w.doc||this.version!==this.w.doc.version||this.w.viewMode!=='3d'))this.cancel();}
    keyDown(e){if(!this.active)return false;if(e.key==='Escape'){e.preventDefault();if(this.drag)this.cancelDrag();else this.cancel();return true;}if(e.target.closest('input,textarea,select')){if(e.key==='Enter'){e.preventDefault();this.update(true);e.target.blur();return true;}return false;}
        if(e.target.matches('.inspect3d-plane-handle')){if(e.key==='Enter'){e.preventDefault();this.focusOffset();return true;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const delta=(e.key==='ArrowLeft'||e.key==='ArrowDown'?-1:1)*(e.shiftKey?.1:1);this.offsetSource=String(expressionDelta3(this.offsetSource,delta,this.w.eval(this.offsetSource)));this.root.querySelector('[data-inspect-offset]').value=this.offsetSource;this.update(true);return true;}}
        if(!e.ctrlKey&&!e.metaKey&&(e.key.length===1||['Delete','Backspace'].includes(e.key)))return true;return false;
    }
    dispose(){this.cancel();this.observer.disconnect();this.root.remove();}
}
