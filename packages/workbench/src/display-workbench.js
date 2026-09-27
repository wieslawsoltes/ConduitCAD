import { VISUAL_STYLES, ENVIRONMENTS, MATERIAL_PRESETS, createRenderingStudy, normalizeDisplaySettings, normalizeMaterial, visualStyle } from '@conduitcad/renderer3d';
import { isLocked, resolveStyle } from '@conduitcad/model';
import { downloadFile } from '@conduitcad/storage';
import { escapeHTML as E, icon, commandButton, setCommandLabel } from './icons.js';
const glyph=s=>s.includes('wireframe')||s==='hidden'?'wireframe':s==='xray'?'eye':s==='sketchy'?'sketch':s==='normals'?'axis-z':'appearance';
const choice=(name,label,values,value)=>`<label class="field">${E(label)}<select data-display-setting="${name}">${values.map(([v,text])=>`<option value="${v}" ${v===value?'selected':''}>${E(text)}</option>`).join('')}</select></label>`;
const check=(name,label,value)=>`<label class="display3d-check"><input type="checkbox" data-display-setting="${name}" ${value?'checked':''}><span>${E(label)}</span></label>`;
const number=(name,label,value,min,max,step)=>`<label class="field">${E(label)}<input type="number" data-display-setting="${name}" min="${min}" max="${max}" step="${step}" value="${value}" inputmode="decimal"></label>`;
const color=(name,label,value)=>`<label class="field">${E(label)}<input type="color" data-display-setting="${name}" value="${value}"></label>`;
function thumbnail(s){
    const colors=s.id==='gray'||s.id==='clay'?['#d2cdbf','#989486','#726e62']:s.id==='conceptual'?['#e4c16d','#658aad','#3f5a8c']:['#77b3ba','#4e8895','#275767'];
    const fill=s.faces==='none',opacity=s.id==='xray'?.35:1,stroke=s.visible?'#294c58':'none';
    return `<svg class="display3d-thumb" viewBox="0 0 80 64" aria-hidden="true" focusable="false"><g stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" opacity="${opacity}"><path d="M40 5 70 20 40 36 10 20Z" fill="${fill?'none':colors[0]}"/><path d="M10 20 40 36v24L10 44Z" fill="${fill?'none':colors[1]}"/><path d="M40 36 70 20v24L40 60Z" fill="${fill?'none':colors[2]}"/></g>${s.hidden?`<path d="M40 5v23L10 44M40 28l30 16" fill="none" stroke="#80959d" stroke-width="1.25" ${s.hidden===true?'stroke-dasharray="3 3"':''}/>`:''}</svg>`;
}
export function syncDisplay3D(m){const r=m.renderer;if(!r)return;const button=m.stage.querySelector('[data-action="3d-display"]');setCommandLabel(button,'Display · '+visualStyle(r.style).label,glyph(r.style));if(button)button.setAttribute('aria-label','3D display styles · '+visualStyle(r.style).label);}
export function displayDialog3D(m){
    const w=m.w,r=m.renderer,original=r.displaySettings,originalCamera=r.camera.snapshot(),lifetime=new AbortController();let accepted=false,peek=false,previewFrame=0;
    const restoreCamera=()=>{Object.assign(r.camera,originalCamera);r.invalidate();};
    w.openModal('3D display styles',`<p>Choose a look. Changes preview immediately; Cancel restores this document’s previous view. Geometry and 2D drafting are unchanged.</p>
        <label class="field">Find a style<input type="search" id="display3d-search" placeholder="Shaded, hidden, realistic, X-ray…" autocomplete="off"></label>
        <div class="display3d-styles" role="group" aria-label="Visual styles">${VISUAL_STYLES.map(s=>`<button type="button" data-display-style="${s.id}" aria-pressed="${s.id===r.style}" title="${E(s.description)}">${thumbnail(s)}<span>${E(s.label)}</span><small>${E(s.group)}</small></button>`).join('')}</div>
        <p class="display3d-no-results" hidden>No matching styles.</p><p class="display3d-description" role="status">${E(visualStyle(r.style).description)}</p>
        <details open><summary>${icon('appearance')}Lighting and presentation</summary><div class="display3d-fields">
        ${choice('environment','Environment',ENVIRONMENTS.map(e=>[e.id,e.label]),original.environment)}${number('exposure','Exposure · stops',original.exposure,-6,6,.25)}
        ${check('shadows','Cast shadows',original.shadows)}${check('ambientOcclusion','Ambient occlusion',original.ambientOcclusion)}
        ${number('aoStrength','Occlusion strength',original.aoStrength,0,1.5,.05)}${number('aoRadius','Occlusion radius · scene fraction',original.aoRadius,.002,.5,.005)}
        ${number('xrayOpacity','X-ray surface opacity',original.xrayOpacity,.02,.95,.02)}${choice('quality','Quality / pixel budget',[['draft','Draft · lightest'],['balanced','Balanced'],['high','High']],original.quality)}
        </div></details>
        <details><summary>${icon('line-style')}Edges and silhouettes</summary><div class="display3d-fields">
        ${choice('edgeDetail','Edge detail',[['feature','Feature edges and silhouettes'],['all','All mesh polygon edges']],original.edgeDetail)}${number('creaseAngle','Smoothing / crease angle · degrees',original.creaseAngle,0,89,1)}
        ${number('edgeWidth','Edge width · CSS pixels',original.edgeWidth,.5,5,.25)}${number('silhouetteWidth','Silhouette width · CSS pixels',original.silhouetteWidth,0,6,.25)}
        ${color('edgeColor','Visible edge color',original.edgeColor)}${color('hiddenColor','Hidden edge color',original.hiddenColor)}
        ${number('hiddenDash','Hidden dash period · CSS pixels',original.hiddenDash,2,24,1)}${number('jitter','Sketch jitter · CSS pixels',original.jitter,0,4,.1)}${number('overhang','Sketch overhang · CSS pixels',original.overhang,0,10,.5)}
        </div></details>
        <details><summary>${icon('section-view')}Scene and section display</summary><div class="display3d-fields">
        ${check('grid','Construction grid',original.grid)}${check('ground','Ground plane',original.ground)}
        ${choice('background','Background',[['solid','Solid'],['gradient','Gradient']],original.background)}${color('backgroundColor','Background / lower color',original.backgroundColor)}${color('backgroundTop','Upper color',original.backgroundTop)}${color('groundColor','Ground color',original.groundColor)}
        ${check('sectionCaps','Cap closed section contours',original.sectionCaps)}${check('capHatch','Hatch section caps',original.capHatch)}${color('capColor','Section cap color',original.capColor)}
        </div><p class="muted-note" id="display3d-section-status">${E(r.renderScene.diagnostics.filter(d=>/section|cap/i.test(d.message)).map(d=>d.message).join(" · "))}</p><p class="muted-note">Section caps are display-only, even-odd fills. Open or non-manifold contours are left uncapped with a diagnostic. Use Section analysis to place the cutting plane.</p></details>
        <details><summary>${icon('save')}Custom presets and portable defaults</summary><label class="field">Preset name<input id="display3d-preset-name" maxlength="80" placeholder="Optional: my inspection view"></label>
        <label class="display3d-check"><input id="display3d-save-default" type="checkbox"><span>Save this view as the drawing’s default</span></label>
        <div class="display3d-presets">${(Array.isArray(w.doc.metadata?.displayPresets3d)?w.doc.metadata.displayPresets3d:[]).slice(0,32).map((p,i)=>`<button class="btn" type="button" data-display-preset="${i}">${icon('appearance')}${E(p.name)}</button>`).join('')}</div>
        <p class="muted-note">Named presets and a drawing default are stored in Conduit project/DXF application metadata. They are not native Autodesk VISUALSTYLE or MATERIAL object definitions.</p></details>
        <div class="display3d-utilities">${commandButton('3d-capture','Capture PNG','btn','','file-image')}${commandButton('3d-rendering-study','Material study','btn','','appearance')}<button type="button" class="btn" id="display3d-reset">${icon('reset')}Reset display</button></div>
        <p class="muted-note">${E(r.backend)} · smooth normals · depth-tested edges · weighted transparency. Realistic uses procedural studio lighting, not an offline ray tracer. Software rendering has a bounded resolution; GPU paths use multisample antialiasing.</p><div class="error-text" role="alert"></div>`,{
        wide:true,confirm:'Keep display',onClose:()=>{lifetime.abort();cancelAnimationFrame(previewFrame);restoreCamera();if(!accepted){r.setDisplaySettings(original,{replace:true});syncDisplay3D(m);}},onConfirm:()=>{
            const next=readSettings(),name=w.modal.querySelector('#display3d-preset-name').value.trim(),save=w.modal.querySelector('#display3d-save-default').checked;
            r.setDisplaySettings(next,{replace:true});
            if(save||name)w.edit('Save 3D display preset',()=>{w.doc.metadata??={};if(save)w.doc.metadata.display3d=next;if(name){const list=(Array.isArray(w.doc.metadata.displayPresets3d)?w.doc.metadata.displayPresets3d:[]).filter(p=>p.name!==name);if(list.length>=32)throw new Error('A drawing supports at most 32 named display presets');w.doc.metadata.displayPresets3d=[...list,{name,settings:next}];}});
            accepted=true;restoreCamera();m.saveView();w.closeModal();syncDisplay3D(m);
        }
    });
    w.modal.classList.add('display3d-backdrop');
    w.modal.querySelector('.modal').classList.add('display3d-dialog');
    const panel=w.modal.querySelector('.modal'),body=panel.querySelector('.modal-body');body.id='display3d-options';
    const quick=document.createElement('div');quick.className='display3d-quick';
    quick.innerHTML=`<label class="field">Style<select id="display3d-quick-style">${VISUAL_STYLES.map(s=>`<option value="${s.id}" ${s.id===r.style?'selected':''}>${E(s.label)}</option>`).join('')}</select></label><button id="display3d-peek" type="button" class="btn" aria-expanded="true" aria-controls="display3d-options">${icon('eye')}<span>Preview model</span></button>`;
    body.before(quick);
    // Temporarily fit the working view into the unobscured screen area. This is
    // presentation only: neither Keep nor Cancel changes the working camera.
    const arrangePreview=()=>{
        cancelAnimationFrame(previewFrame);previewFrame=requestAnimationFrame(()=>{
            if(!peek||!panel.isConnected)return;
            restoreCamera();
            const host=r.host.getBoundingClientRect(),dialog=panel.getBoundingClientRect();
            const top=m.stage.querySelector('.model3d-info')?.getBoundingClientRect().bottom||host.top;
            const toolbar=m.stage.querySelector('.model3d-bottom')?.getBoundingClientRect().top||host.bottom;
            const bottomSheet=dialog.width>=innerWidth-2;
            const region={left:host.left+8,top:Math.max(host.top+8,top+8),right:bottomSheet?host.right-8:Math.min(host.right-8,dialog.left-8),bottom:bottomSheet?dialog.top-8:Math.min(host.bottom-8,toolbar-8)};
            const width=Math.max(32,region.right-region.left),height=Math.max(32,region.bottom-region.top),scale=host.height/height;
            r.camera.resize(width,height);r.camera.fit(r.scene.points);
            r.camera.height*=scale;r.camera.distance*=scale;r.camera.resize(host.width,host.height);
            r.camera.pan((region.left+region.right-host.left-host.right)/2,(region.top+region.bottom-host.top-host.bottom)/2);
            r.invalidate();
        });
    };
    quick.querySelector('#display3d-peek').addEventListener('click',event=>{
        peek=!peek;panel.classList.toggle('display3d-peek',peek);
        const button=event.currentTarget;button.setAttribute('aria-expanded',String(!peek));button.querySelector('span').textContent=peek?'Show options':'Preview model';
        if(peek)arrangePreview();else{cancelAnimationFrame(previewFrame);restoreCamera();}
    });
    window.addEventListener('resize',arrangePreview,{signal:lifetime.signal});
    const readSettings=()=>{const values={...r.displaySettings};for(const el of w.modal.querySelectorAll('[data-display-setting]'))values[el.dataset.displaySetting]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;return normalizeDisplaySettings(values);};
    const update=()=>{const settings=r.displaySettings;quick.querySelector('select').value=settings.style;for(const el of w.modal.querySelectorAll('[data-display-setting]')){if(el.type==='checkbox')el.checked=settings[el.dataset.displaySetting];else el.value=settings[el.dataset.displaySetting];}for(const el of w.modal.querySelectorAll('[data-display-style]'))el.setAttribute('aria-pressed',String(el.dataset.displayStyle===settings.style));w.modal.querySelector('.display3d-description').textContent=visualStyle(settings.style).description;syncDisplay3D(m);};
    quick.querySelector('select').addEventListener('change',e=>{r.setDisplaySettings({style:e.target.value});update();});
    w.modal.addEventListener('click',event=>{const style=event.target.closest('[data-display-style]'),preset=event.target.closest('[data-display-preset]');if(style){r.setDisplaySettings({style:style.dataset.displayStyle});update();}else if(preset){r.setDisplaySettings(w.doc.metadata.displayPresets3d[Number(preset.dataset.displayPreset)].settings,{replace:true,tolerant:true});update();}});
    w.modal.querySelector('#display3d-search').addEventListener('input',e=>{const words=e.target.value.toLowerCase().trim().split(/\s+/);for(const el of w.modal.querySelectorAll('[data-display-style]')){const s=visualStyle(el.dataset.displayStyle);el.hidden=!words.every(word=>(s.label+' '+s.group+' '+s.description).toLowerCase().includes(word));}w.modal.querySelector('.display3d-no-results').hidden=!!w.modal.querySelector('[data-display-style]:not([hidden])');});
    w.modal.querySelector('#display3d-reset').addEventListener('click',()=>{r.setDisplaySettings({},{replace:true});update();});
    w.modal.addEventListener('change',e=>{if(!e.target.matches('[data-display-setting]'))return;try{r.setDisplaySettings(readSettings(),{replace:true});w.modal.querySelector('.error-text').textContent='';const status=w.modal.querySelector('#display3d-section-status');if(status)status.textContent=r.renderScene.diagnostics.filter(d=>/section|cap/i.test(d.message)).map(d=>d.message).join(' · ');syncDisplay3D(m);}catch(error){w.modal.querySelector('.error-text').textContent=error.message;}});
}
export function appearanceDialog3D(m){
    const w=m.w,e=w.selected()[0];if(!e)throw new Error('Select an entity');if(isLocked(e,w.doc))throw new Error('The selected entity is locked');
    const native=resolveStyle(e,w.doc),mat=normalizeMaterial({...e.appearance3d,color:native.color,opacity:native.opacity},native.color),id=e.id;
    w.openModal('3D appearance',`<label class="field">Name<input id="model3d-label" maxlength="160" value="${E(e.label||e.type)}"></label>
        <label class="field">Material preset<select id="material3d-preset"><option value="">Custom / current</option>${MATERIAL_PRESETS.map(p=>`<option value="${p.id}">${E(p.label)}</option>`).join('')}</select></label>
        <div class="display3d-fields"><label class="field">Surface / line color<input id="model3d-color" type="color" value="${E(mat.color)}"></label>
        <label class="field">Layer<select id="model3d-layer">${w.doc.layers.map(l=>`<option ${l.name===e.layer?'selected':''}>${E(l.name)}</option>`).join('')}</select></label>
        ${['metallic','roughness','opacity','emission'].map(k=>`<label class="field">${E(k[0].toUpperCase()+k.slice(1))}<input id="material3d-${k}" value="${mat[k]}" inputmode="decimal" autocomplete="off"></label>`).join('')}</div>
        <label class="display3d-check"><input id="material3d-realistic" type="checkbox" checked><span>Show result in Realistic mode</span></label>
        <p class="muted-note">Metallic 0–1, roughness 0.04–1, opacity 0–1, emission 0–4. Expressions use drawing parameters. Color and opacity are native DXF properties; material coefficients use Conduit metadata. Transparent polymer is weighted blended transparency, not optical refraction.</p><div class="error-text" role="alert"></div>`,{confirm:'Apply appearance',onConfirm:()=>{
            const values={};for(const k of ['metallic','roughness','opacity','emission']){const n=w.eval(w.modal.querySelector('#material3d-'+k).value),lo=k==='roughness'?.04:0,hi=k==='emission'?4:1;if(n<lo||n>hi||!Number.isFinite(n))throw new Error('Invalid material '+k);values[k]=n;}
            const color=w.modal.querySelector('#model3d-color').value,label=w.modal.querySelector('#model3d-label').value.slice(0,160),layer=w.modal.querySelector('#model3d-layer').value,realistic=w.modal.querySelector('#material3d-realistic').checked;
            w.edit('3D appearance',()=>{const target=w.doc.entities.find(t=>t.id===id);if(!target||isLocked(target,w.doc))throw new Error('Material target is no longer editable');Object.assign(target,{label,color,layer,opacity:values.opacity,appearance3d:{...values,color}});});
            if(realistic){m.renderer.setDisplaySettings({style:'realistic'});m.saveView();}w.closeModal();syncDisplay3D(m);
        }});
    w.modal.querySelector('#material3d-preset').addEventListener('change',e=>{const p=MATERIAL_PRESETS.find(p=>p.id===e.target.value);if(!p)return;w.modal.querySelector('#model3d-color').value=p.color;for(const k of ['metallic','roughness','opacity','emission'])w.modal.querySelector('#material3d-'+k).value=p[k]??0;});
}
export async function displayAction3D(m,action){
    if(action==='3d-rendering-study'){m.w.closeModal();m.w.openDocument(createRenderingStudy(),{context:{viewMode:'3d',currentLayer:'Annotations'}});await m.ready;return true;}
    if(action==='3d-display'){displayDialog3D(m);return true;}
    if(action==='3d-capture'){const blob=await m.renderer.capturePNG();downloadFile(m.w.basename()+'-'+m.renderer.style+'.png',blob,'image/png');m.w.toast('3D viewport image exported');return true;}
    return false;
}
