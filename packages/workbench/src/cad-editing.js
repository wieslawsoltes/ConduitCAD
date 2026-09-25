import { entity, clone, editDimension, dimensionPicture, setDynamicParameters, dynamicValues, evaluateDynamicBlock, entityGeometry, isLocked, uid } from '@conduitcad/model';
import { bounds } from '@conduitcad/geometry';
import { escapeHTML as E } from './icons.js';
const button=(action,text)=>`<button class="btn" data-action="${action}">${text}</button>`;
const names=['Rotated','Aligned','Two-line angular','Diameter','Radius','Three-point angular','Ordinate'];
const input=(key,label,value,kind='dim')=>`<label class="field"><span>${E(label)}</span><input data-${kind}="${E(key)}" aria-label="${E(label)}" value="${E(value)}" autocomplete="off" inputmode="${key==='text'?'text':'decimal'}"></label>`;
export function renderCadEditing(w,e,host) {
    const section=document.createElement('section');section.className='inspector-section cad-editing';
    if(e.type==='DIMENSION'){
        if(e.dimension?.version!==1){section.innerHTML=`<h3>Native dimension</h3><p>${E(names[(e.dimtype??33)&15]||'Unknown')} · original graphics retained.</p>${button('dimension-manage','Enable dimension editing')}<p class="muted-note">Opt in to decimal-style regeneration. The original graphics remain unchanged until you confirm.</p>`;}
        else {
            const p=dimensionPicture(e,w.doc),s=p.style;
            section.innerHTML=`<h3>${E(names[(e.dimtype??33)&15])} dimension</h3><div class="fields">${input('text','Dimension text',e.text??'<>')}${input('dimtxt','Dimension text height',s.dimtxt)}${input('dimasz','Arrow size',s.dimasz)}${input('dimdec','Decimal precision',s.dimdec)}${input('dimgap','Text gap',s.dimgap)}${input('dimlfac','Measurement factor',s.dimlfac)}${[0,1].includes((e.dimtype??33)&15)?input('offset','Dimension offset',e.offset??dimensionOffset(e)):''}${(e.dimtype&15)===0?input('dimensionAngle','Dimension angle',e.dimensionAngle||0):''}</div>${button('dimension-reset-text','Reset text position')}<p class="muted-note">Drag witness points, the dimension line, or the text grip. “&lt;&gt;” inserts the measurement; one space suppresses text. ${e.dimension.references?'Source points are associated; editing a witness grip detaches that point.':''}</p>`;
        }
    } else if(e.type==='INSERT'){
        const block=w.doc.blocks[e.block];if(!block)return;
        section.innerHTML='<h3>Parameterized block</h3>';
        if(block.dynamic){
            const values=dynamicValues(block,e.dynamicParameters||{});
            section.innerHTML+=`<div class="fields">${block.dynamic.parameters.map(p=>{
                const label=E(p.label||p.name),v=values[p.name];
                if(p.type==='boolean'||p.type==='enum')return `<label class="field"><span>${label}</span><select data-dynamic="${E(p.name)}" aria-label="${label}">${(p.type==='boolean'?[false,true]:p.values).map(x=>`<option value="${E(JSON.stringify(x))}" ${v===x?'selected':''}>${E(String(x))}</option>`).join('')}</select></label>`;
                return input(p.name,p.label||p.name,v,'dynamic');
            }).join('')}</div>${button('dynamic-reset','Reset parameters')}`;
        }
        section.innerHTML+=button('dynamic-author',block.dynamic?'Edit behavior definition':'Add parameterized behavior')+'<p class="muted-note">Conduit actions export evaluated native DXF geometry. Proprietary Autodesk action graphs are not executed.</p>';
    } else if(e.type==='LINE'||e.type==='CIRCLE'||e.type==='ARC'){
        section.innerHTML='<h3>Dimension this object</h3>'+button('dimension-source',e.type==='LINE'?'Add associated dimension':'Add radius dimension');
    } else return;
    const card=host.querySelector('.object-card');
    if(card)card.after(section);else host.prepend(section);
}
function dimensionOffset(e){const a=e.a,b=e.b,u=(e.dimtype&15)===0?{x:Math.cos((e.dimensionAngle||0)*Math.PI/180),y:Math.sin((e.dimensionAngle||0)*Math.PI/180)}:{x:(b.x-a.x)/Math.hypot(b.x-a.x,b.y-a.y),y:(b.y-a.y)/Math.hypot(b.x-a.x,b.y-a.y)};return -(e.definitionPoint.x-a.x)*u.y+(e.definitionPoint.y-a.y)*u.x;}
function editable(w){const e=w.selected()[0];if(!e||w.selection.size!==1||isLocked(e,w.doc))throw new Error('Select one unlocked object');return e;}
export function changeCadEditing(w,t) {
    if(!t.dataset.dim&&!t.dataset.dynamic)return false;
    const e=editable(w);
    w.edit('Edit CAD parameters',()=>{
        if(t.dataset.dim){const key=t.dataset.dim,value=key==='text'?t.value:w.eval(t.value);editDimension(e,w.doc,['text','offset','dimensionAngle'].includes(key)?{[key]:value}:{style:{[key]:value}});}
        else {
            const p=w.doc.blocks[e.block].dynamic.parameters.find(p=>p.name===t.dataset.dynamic);
            const value=['enum','boolean'].includes(p.type)?JSON.parse(t.value):w.eval(t.value);
            setDynamicParameters(e,w.doc,{[p.name]:value});w.reroute(new Set([e.id]));
        }
    });return true;
}
export function cadEditingAction(w,action) {
    if(!['dimension-manage','dimension-reset-text','dimension-source','dynamic-author','dynamic-reset','dynamic-demo'].includes(action))return false;
    if(action==='dynamic-demo'){
        w.edit('Insert parameterized duct',()=>{
            const name='CC_DYNAMIC_DUCT_'+uid('block'),base={x:0,y:0};
            const block={name,base,ports:[{name:'in',x:0,y:0,dx:-1,dy:0},{name:'out',x:100,y:0,dx:1,dy:0}],entities:[entity('LWPOLYLINE',{points:[{x:0,y:-20},{x:100,y:-20},{x:100,y:20},{x:0,y:20}],closed:true}),entity('LINE',{a:{x:0,y:0},b:{x:100,y:0},linetype:'CENTER'})]};
            block.dynamic={version:1,parameters:[{name:'Length',type:'distance',default:100,min:20,max:1000,grip:{base:{x:0,y:35},direction:{x:1,y:0}}},{name:'Centerline',type:'enum',default:'Shown',values:['Shown','Hidden']}],actions:[{type:'stretch',parameter:'Length',box:{minX:50,minY:-100,maxX:1100,maxY:100},direction:{x:1,y:0}},{type:'visibility',parameter:'Centerline',entities:[block.entities[1].id],states:{Shown:[block.entities[1].id],Hidden:[]}}]};
            w.doc.blocks[name]=block;const e=entity('INSERT',{block:name,x:w.camera.x,y:w.camera.y,layer:w.currentLayer,layout:w.doc.activeLayout,sx:1,sy:1});w.doc.entities.push(e);w.selection=new Set([e.id]);
        });w.closeModal();w.setTool('select');return true;
    }
    const e=editable(w);
    if(action==='dimension-manage'){
        w.openModal('Enable native dimension editing','<p>This replaces the imported picture with Conduit’s planar decimal dimension evaluator. Original DXF bytes remain available. Custom arrows, tolerance layouts, annotative contexts and proprietary associations are not evaluated. This change is undoable.</p><div class="error-text"></div>',{confirm:'Enable editing',onConfirm:()=>{w.edit('Enable dimension regeneration',()=>editDimension(e,w.doc));w.closeModal();}});
    } else if(action==='dimension-reset-text')w.edit('Reset dimension text',()=>editDimension(e,w.doc,{manualText:false}));
    else if(action==='dimension-source'){
        w.edit('Dimension selected object',()=>{
            let d;
            if(e.type==='LINE')d=entity('DIMENSION',{a:clone(e.a),b:clone(e.b),offset:30,dimension:{version:1,references:{a:{entityId:e.id,point:'a'},b:{entityId:e.id,point:'b'}}}});
            else {const a=e.type==='ARC'?e.start:0;d=entity('DIMENSION',{dimtype:36,definitionPoint:clone(e.c),defpoint4:{x:e.c.x+e.r*Math.cos(a),y:e.c.y+e.r*Math.sin(a)},leaderLength:15,dimension:{version:1,references:{definitionPoint:{entityId:e.id,point:'c'},defpoint4:{entityId:e.id,point:'circle',angle:a}}}});}
            d.layer='Annotations';d.layout=e.layout||'Model';editDimension(d,w.doc);w.doc.entities.push(d);w.selection=new Set([d.id]);
        });
    } else if(action==='dynamic-reset')w.edit('Reset block parameters',()=>{const block=w.doc.blocks[e.block];setDynamicParameters(e,w.doc,Object.fromEntries(block.dynamic.parameters.map(p=>[p.name,p.default])));w.reroute(new Set([e.id]));});
    else if(action==='dynamic-author'){
        const source=w.doc.blocks[e.block];if(!source)throw new Error('Missing block');
        const d=source.dynamic||{version:1,parameters:[{name:'Size',type:'distance',default:100,min:10,max:1000}],actions:[{type:'scale',parameter:'Size',base:source.base||{x:0,y:0}}]};
        w.ask('Define parameterized behavior',[{name:'definition',label:'Version 1 action schema · move, stretch, rotate, scale, flip, visibility, array, lookup. Editing creates a private master for this instance.',value:JSON.stringify(d,null,2),multiline:true}],v=>{
            if(v.definition.length>12000)throw new Error('Behavior definition exceeds the 12,000-character authoring limit');
            const spec=JSON.parse(v.definition),name=source.name+'_DYN_'+uid('block'),block={...clone(source),name,dynamic:spec};
            for(let i=0;i<block.entities.length;i++)block.entities[i].id??=`child-${i}`;
            evaluateDynamicBlock(block,{});
            w.edit('Author block behavior',()=>{w.doc.blocks[name]=block;e.block=name;delete e.dynamicSource;e.dynamicParameters={};e.dirty=true;w.reroute(new Set([e.id]));});
        });
    }
    return true;
}
