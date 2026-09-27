import { parseDrawingPoint } from '@conduitcad/drawing';
import { distance } from '@conduitcad/geometry';
import { drawingToolSections, acceptDrawingPoint } from './drawing-workbench.js';
import { iconPreferencesMarkup } from './iconography.js';
import { icon, toolIcon, escapeHTML as E } from './icons.js';
const closeButton=`<button type="button" data-planar-panel-close title="Close tools" aria-label="Close tools">${icon('close')}</button>`;
/** Non-modal creation palette and exact entry. The drawing canvas remains active. */
export class PlanarToolPanel {
    constructor(w,editor){
        this.w=w;this.editor=editor;this.root=document.createElement('section');this.root.className='planar-tool-panel';this.root.hidden=true;this.root.setAttribute('role','region');w.$('.canvas-area').append(this.root);
        const options={signal:w.abort.signal};this.root.addEventListener('click',e=>this.click(e),options);
        this.root.addEventListener('input',e=>{if(e.target.matches('[data-drawing-search]'))this.filter(e.target.value);},options);
        this.root.addEventListener('submit',e=>{e.preventDefault();e.stopPropagation();try{this.submit?.();}catch(error){this.error(error.message);}},options);
        this.root.addEventListener('change',e=>{if(e.target.matches('[data-draw-setting]'))this.changeOptions();},options);
    }
    show(title,body){this.w.closeModal();this.root.hidden=false;this.root.innerHTML=`<header><strong tabindex="-1">${E(title)}</strong>${closeButton}</header><div class="planar-panel-body">${body}<p class="planar-panel-error" role="alert" hidden></p></div>`;this.root.setAttribute('aria-label',title);this.root.querySelector('strong').focus({preventScroll:true});}
    error(message=''){const n=this.root.querySelector('.planar-panel-error');if(n){n.textContent=message;n.hidden=!message;}}
    close(){if(this.root.contains(document.activeElement))this.w.$('.viewport').focus({preventScroll:true});if(this.kind==='options'&&this.w.drawingOptionsError){this.w.drawingOptionsError=null;this.w.toast('Invalid tool options discarded; previous valid settings retained');}this.root.hidden=true;this.submit=null;this.kind=null;}
    palette(){
        this.editor.cancel();this.w.closePanels();this.kind='palette';
        const quick=['select','pan','line','rect','circle','polyline','text','dimension','connect'];
        const actions=[['planar-example','Visual drafting workshop','file'],['2d-visual-geometry','Edit on canvas','properties'],['2d-visual-move','Move / copy','move'],['2d-visual-rotate','Rotate / copy','rotate'],['2d-visual-scale','Scale / copy','scale'],['offset','Offset','offset'],['fillet','Fillet','fillet'],['trim','Trim','trim'],['extend','Extend','extend'],['parameters','Parameters','param'],['constraint','Constraints','param'],['blocks','Block editor','symbols'],['calculated-text','Calculated label','text'],['make-symbol','Make symbol','symbols'],['explode','Explode','symbols'],['solver-report','Solve status','param'],['multi-select','Multi-select','select'],['select-all','Select all','select'],['delete','Delete','trash'],['command','Command','command'],['help','Help','help']];
        this.show('Draw & edit on canvas',`${iconPreferencesMarkup()}<section class="drawing-tool-group"><h3>Quick drawing</h3><div class="operation-grid">${quick.map(k=>`<button type="button" data-tool="${k}" data-tool-search="${k}" aria-label="${k}">${icon(toolIcon(k))}<span>${E(k)}</span></button>`).join('')}</div></section>${drawingToolSections(this.w)}<section class="drawing-tool-group"><h3>Edit & organize</h3><div class="operation-grid">${actions.map(([k,l,g])=>`<button type="button" data-action="${k}" data-tool-search="${E(l.toLowerCase())}">${icon(g)}<span>${E(l)}</span></button>`).join('')}</div></section><div class="planar-search-status" role="status"></div>`);
    }
    filter(query){const terms=query.toLowerCase().trim().split(/\s+/);for(const b of this.root.querySelectorAll('[data-tool-search]'))b.hidden=!terms.every(t=>b.dataset.toolSearch.includes(t));for(const g of this.root.querySelectorAll('.drawing-tool-group'))g.hidden=![...g.querySelectorAll('[data-tool-search]')].some(b=>!b.hidden);const n=[...this.root.querySelectorAll('[data-tool-search]')].filter(b=>!b.hidden).length;this.root.querySelector('.planar-search-status').textContent=n?n+' matching tools':'No matching tools';}
    click(e){
        const target=e.target.closest('button');if(!target)return;if(target.matches('[data-planar-panel-close]')){e.preventDefault();e.stopPropagation();this.close();return;}
        if(target.dataset.tool){e.preventDefault();e.stopPropagation();const tool=target.dataset.tool;this.close();this.w.setTool(tool);if(this.w.drawingSession?.tool.options)this.drawingOptions();return;}
        if(target.dataset.action&&target.dataset.action!=='icon-guide'){e.preventDefault();e.stopPropagation();const action=target.dataset.action;this.close();Promise.resolve(this.w.action(action)).catch(error=>this.w.toast(error.message,true));}
    }
    exactPoint(){
        this.kind='point';this.show('Next drawing point',`<form class="planar-point-form"><label>x,y · @dx,dy · @length&lt;degrees<input name="point" aria-label="Point or expression" autocomplete="off" spellcheck="false" value="${E(this.w.cursor?this.w.cursor.x+','+this.w.cursor.y:'0,0')}"></label><button type="submit">${icon('check')}<span>Add point</span></button></form><p>Tap the canvas to pick points, or use exact expressions here. The current drawing command stays active.</p>`);
        this.submit=()=>{const w=this.w,input=this.root.querySelector('[name=point]'),p=parseDrawingPoint(input.value,w.draft.at(-1),s=>w.eval(s));
            if(w.drawingSession)acceptDrawingPoint(w,p);else if(w.tool==='polyline'){if(w.draft.length&&distance(w.draft.at(-1),p)<1e-8)throw new Error('Choose a distinct point');w.draft.push(p);w.updateTools();w.renderer.invalidate();}else throw new Error('Choose a point-driven drawing tool first');this.error();input.select();};
        this.root.querySelector('input').focus({preventScroll:true});this.root.querySelector('input').select();
    }
    drawingOptions(){
        const w=this.w,s=w.drawingSession;if(!s?.tool.options)return;this.kind='options';this.tool=w.tool;
        const v=s.options;let body='';
        if(w.tool==='polygon')body=`<label>Sides<input data-draw-setting="sides" value="${v.sides}"></label><label>Construction<select data-draw-setting="circumscribed"><option value="false" ${!v.circumscribed?'selected':''}>Inscribed</option><option value="true" ${v.circumscribed?'selected':''}>Circumscribed</option></select></label>`;
        if(w.tool==='hatch')body=`<label>Pattern<select data-draw-setting="pattern">${['solid','lines','cross'].map(k=>`<option ${v.pattern===k?'selected':''}>${k}</option>`).join('')}</select></label><label>Spacing<input data-draw-setting="spacing" value="${E(v.spacing)}"></label><label>Angle<input data-draw-setting="angle" value="${E(v.angle)}"></label>`;
        if(w.tool==='mtext')body=`<label>Text<textarea data-draw-setting="text" rows="4">${E(v.text)}</textarea></label><label>Height<input data-draw-setting="height" value="${E(v.height)}"></label>`;
        this.show(s.tool.label+' options',body+'<p>Changes update the active tool. Pick the next point on the canvas. Close this panel for more drawing space.</p>');
    }
    changeOptions(){
        const w=this.w,s=w.drawingSession;if(!s||w.tool!==this.tool){this.close();return;}
        try{const v={...s.options};for(const n of this.root.querySelectorAll('[data-draw-setting]')){const k=n.dataset.drawSetting;v[k]=k==='text'||k==='pattern'?n.value:k==='circumscribed'?n.value==='true':w.eval(n.value);}
            if(this.tool==='polygon'&&(!Number.isInteger(v.sides)||v.sides<3||v.sides>512))throw new Error('Sides must be an integer between 3 and 512');
            if(this.tool==='hatch'&&(!Number.isFinite(v.spacing)||v.spacing<=0||Math.abs(v.angle)>1e12))throw new Error('Use positive spacing and a finite angle');
            if(this.tool==='mtext'&&(!v.text.trim()||v.text.length>16000||v.height<=0||v.height>1e12))throw new Error('Enter text and a positive height');
            w.drawingOptionsError=null;s.options=v;w.drawingOptions={...w.drawingOptions,[this.tool]:v};w.preview=null;w.renderer.invalidate();this.error();
        }catch(error){w.drawingOptionsError=error.message;this.error(error.message);}
    }
    keyDown(e){if(this.root.hidden)return false;if(e.key==='Escape'){e.preventDefault();this.close();return true;}return false;}
    dispose(){this.root.remove();}
}
