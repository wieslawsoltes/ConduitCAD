import { beginBlockEdit, editedBlockDefinition, updateBlockDefinition, inspectBlockReferences, duplicateBlockDefinition, renameBlockDefinition, evaluateDynamicBlock, clone, entity, uid, entityBounds, isLocked, regenerateDimensions, createBlockDefinition, deleteBlockDefinition, syncInsertAttributes } from '@conduitcad/model';
import { ConstraintSolver, resolveParameters, describeParameters, reservedParameterNames, constraintAnnotations, constraintMeasurement, evaluateExpression, inferSketchConstraints, evaluateCalculations } from '@conduitcad/constraints';
import { History } from '@conduitcad/history';
import { bounds } from '@conduitcad/geometry';
import { escapeHTML as E, commandButton } from './icons.js';
const B=(action,label)=>commandButton(action,label,'btn');
const number=n=>Number.isFinite(n)?Number(n.toPrecision(8)).toString():'—';
const field=(name,label,value,type='input')=>`<label class="field">${E(label)}<${type} data-block-field="${name}" ${type==='input'?`value="${E(value)}"`:''}>${type==='textarea'?E(value):''}</${type}></label>`;
const readFields=w=>Object.fromEntries([...w.modal.querySelectorAll('[data-block-field]')].map(e=>[e.dataset.blockField,e.value]));
function cameraState(w){return {x:w.camera.x,y:w.camera.y,scale:w.camera.scale};}
export function restoreHistory(w){return new History({capture:()=>w.doc,restore:d=>{w.doc=d;w.selection=new Set([...w.selection].filter(id=>d.entities.some(e=>e.id===id)));w.renderer.setDocument(d);w.updateUI();},onChange:()=>{w.updateHistory();w.updateUI();w.documentChanged?.();}});}
export function startBlockEditor(w,name){
    if(w.blockSession)throw new Error('Save or close the current block editor first');
    const session=beginBlockEdit(w.doc,name);
    session.parentDocument=w.doc;session.parentHistory=w.history;session.parentSelection=[...w.selection];session.parentCamera=cameraState(w);session.parentLayer=w.currentLayer;session.parentCategory=w.category;
    w.closeModal();w.setTool('select');w.closePanels();w.blockSession=session;w.doc=session.draft;w.selection.clear();w.lastSolve=null;w.currentLayer='0';w.category='Custom';
    w.history=restoreHistory(w);w.renderer.setDocument(w.doc);w.updateUI();w.renderer.fit();renderBlockBar(w);w.openPanel('inspector');w.scheduleRecovery?.();
}
export function finishBlockEditor(w,save=false,stay=false,newName=null){
    const s=w.blockSession;if(!s)throw new Error('The block editor is not open');
    if(s.testing){endBlockTest(w);if(!save)return;}
    s.draft=w.doc;let report=null;
    if(save){
        const replacement=editedBlockDefinition(s),parent=s.parentDocument;
        const temporary=clone(parent);
        for(const [key,definition]of Object.entries(s.draft.blocks))if(!Object.hasOwn(temporary.blocks,key))temporary.blocks[key]=clone(definition);
        for(const layer of s.draft.layers)if(!temporary.layers.some(l=>l.name===layer.name))temporary.layers.push(clone(layer));
        let name=s.name,options={expectedSignature:s.signature};
        if(newName){duplicateBlockDefinition(temporary,name,newName);name=newName;options={};}
        report=updateBlockDefinition(temporary,name,replacement,options);
        // Re-evaluate complete nested geometry before publishing a shared definition.
        for(const id of report.inserts){const insert=temporary.entities.find(e=>e.id===id);entityBounds(insert,temporary);}
        const scratch=w.doc;w.doc=parent;
        try{
            s.parentHistory.run(newName?'Save block as '+newName:'Update block '+s.name,()=>{
                w.doc=temporary;w.reroute(new Set(report.inserts));regenerateDimensions(w.doc);
            });
            s.parentDocument=w.doc;
        }catch(error){s.parentDocument=w.doc;w.doc=scratch;throw error;}
        w.doc=scratch;
        if(stay&&!newName){const again=beginBlockEdit(s.parentDocument,s.name);s.signature=again.signature;w.toast(`Saved block; ${report.updatedInserts} inserts updated`);renderBlockBar(w);return report;}
    }
    w.setTool('select');w.doc=s.parentDocument;w.history=s.parentHistory;w.selection=new Set(s.parentSelection);w.currentLayer=s.parentLayer;w.category=s.parentCategory;Object.assign(w.camera,s.parentCamera);w.blockSession=null;w.lastSolve=null;
    w.$('.block-editor-bar')?.remove();for(const button of w.root.querySelectorAll('.appbar button:disabled'))button.disabled=false;w.renderer.setDocument(w.doc);w.updateUI();w.renderer.resize();w.renderer.invalidate();w.scheduleRecovery?.();
    if(save)w.toast(`Block saved; ${report.updatedInserts} direct/nested inserts updated`);else w.toast('Block edit cancelled; drawing unchanged');
    return report;
}
export function renderBlockBar(w){
    w.$('.block-editor-bar')?.remove();if(!w.blockSession)return;
    for(const button of w.root.querySelectorAll('.appbar [data-action="export"]')){button.disabled=true;button.title='Save or close the block editor first';}
    const bar=document.createElement('nav');bar.className='block-editor-bar';bar.setAttribute('aria-label','Block editor');
    bar.innerHTML=`<strong>${w.blockSession.testing?'TEST BLOCK':'BLOCK EDITOR'} · ${E(w.blockSession.name)}</strong><div>${w.blockSession.testing?B('block-test-close','Return to editor'):`${B('block-save','Save block')}${B('block-save-close','Save & close')}${B('block-test','Test block')}${B('block-settings','Base / ports / attributes')}${B('block-author','Parameters & actions')}${B('block-close','Discard & close')}`}</div>`;
    w.$('.workbar').after(bar);w.renderer.resize();
}
function testBlock(w){
    const s=w.blockSession;if(!s||s.testing)throw new Error('Open a block for editing first');s.draft=w.doc;
    const definition=editedBlockDefinition(s);if(definition.dynamic)evaluateDynamicBlock(definition,{});
    s.testDraft=w.doc;s.testHistory=w.history;s.testSelection=[...w.selection];s.testCamera=cameraState(w);s.testing=true;
    w.doc={...clone(w.doc),entities:[entity('INSERT',{block:s.name,x:0,y:0,sx:1,sy:1,layer:'0'})],constraints:[],blockEditing:undefined};w.doc.blocks[s.name]=definition;syncInsertAttributes(w.doc.entities[0],w.doc);w.selection=new Set([w.doc.entities[0].id]);w.history=restoreHistory(w);w.renderer.setDocument(w.doc);w.updateUI();w.renderer.fit();renderBlockBar(w);
}
function endBlockTest(w){const s=w.blockSession;if(!s?.testing)return;w.doc=s.testDraft;w.history=s.testHistory;w.selection=new Set(s.testSelection);Object.assign(w.camera,s.testCamera);delete s.testing;w.renderer.setDocument(w.doc);w.updateUI();renderBlockBar(w);}
export function renderParametricInspector(w,host){
    if(w.inspectorTab!=='properties')return;
    const selected=w.selected(),section=document.createElement('section');section.className='inspector-section parametric-tools';
    if(w.blockSession&&!w.blockSession.testing){
        section.innerHTML=`<h3>Block authoring</h3><p>Editing shared definition <strong>${E(w.blockSession.name)}</strong>. Save updates all direct and nested inserts atomically.</p><div class="operation-grid">${B('block-author','Parameters & actions')}${B('block-attribute','Add attribute')}${B('block-port','Add anchored port')}${B('constraint','Constrain selection')}${B('auto-constrain','Auto constrain selection')}${B('solver-report','Solve status')}${B('block-save-as','Save block as')}</div>`;
    }else if(selected.length===1&&selected[0].type==='INSERT'){
        const info=inspectBlockReferences(w.doc,selected[0].block);
        section.innerHTML=`<h3>Shared block definition</h3><p>${info.direct.length} direct inserts · ${info.nested.length} nested references.</p><div class="operation-grid">${B('block-edit','Edit block geometry')}${B('block-copy','Make unique')}${B('block-rename','Rename definition')}${B('block-sync-attributes','Synchronize attributes')}</div>`;
    }else section.innerHTML=`<h3>Parametric sketch</h3><div class="operation-grid">${B('solver-report','Solve status')}${B('constraint','Add constraint')}${B('auto-constrain','Auto constrain')}${B('calculated-text','Calculated annotation')}${B('constraint-display','Show / hide constraints')}${B('blocks','Block manager')}${B('parametric-demo','Constrained bracket')}</div>`;
    if(selected.length===1&&selected[0].calculation)section.innerHTML+=`<p>Calculated value: <strong>${E(selected[0].text)}</strong></p>${B('calculation-bake','Convert to static text')}`;
    const card=host.querySelector('.object-card');if(card)card.after(section);else host.prepend(section);
    if(w.doc.constraints?.length){const report=w.lastSolve,diagnostic=document.createElement('div');diagnostic.className='solve-summary';diagnostic.setAttribute('role','status');diagnostic.innerHTML=report?`<strong>${E(report.status)}</strong> · ${report.degreesOfFreedom} free variables<br>${report.equations} equations · rank ${report.rank} · residual ${number(report.residual)}`:`${w.doc.constraints.length} constraints · ${B('solver-report','Analyze sketch')}`;section.append(diagnostic);}
}
function settings(w){
    const info=w.doc.blockEditing;if(!info)throw new Error('Open the block editor first');
    w.openModal('Block base and connection ports',`${field('x','Base X',info.base.x)}${field('y','Base Y',info.base.y)}${field('ports','Ports · name, x, y, dx, dy; optional anchor {entityId, point}',JSON.stringify(info.ports,null,2),'textarea')}<p>Insert anchors remain unchanged. Changing the base moves the geometry relative to every insertion point. Connected terminals may not be deleted.</p><div class="error-text"></div>`,{confirm:'Apply',onConfirm:()=>{const v=readFields(w),ports=JSON.parse(v.ports);if(!Array.isArray(ports))throw new Error('Ports must be an array');w.edit('Edit block base and ports',()=>{info.base={x:w.eval(v.x),y:w.eval(v.y)};info.ports=ports;});w.closeModal();}});
}
function addPort(w){
    const e=w.selected()[0];if(!w.doc.blockEditing)throw new Error('Open the block editor first');
    const p=e?.b||e?.c||e?.p||e?.points?.[0]||{x:0,y:0},key=e?.b?'b':e?.c?'c':e?.p?'p':'points.0';
    w.ask('Add block connection port',[{name:'name',label:'Unique port name',value:'port'+(w.doc.blockEditing.ports.length+1)},{name:'x',label:'X',value:p.x},{name:'y',label:'Y',value:p.y},{name:'angle',label:'Outward direction · degrees',value:0}],v=>w.edit('Add connection port',()=>{
        if(w.doc.blockEditing.ports.some(p=>p.name===v.name))throw new Error('Duplicate port name');const a=w.eval(v.angle)*Math.PI/180;
        w.doc.blockEditing.ports.push({name:v.name,x:w.eval(v.x),y:w.eval(v.y),dx:Math.cos(a),dy:Math.sin(a),...(e?{anchor:{entityId:e.id,point:key}}:{})});
    }));
}
function addAttribute(w){
    if(!w.doc.blockEditing)throw new Error('Open the block editor first');
    w.ask('Add attribute definition',[{name:'tag',label:'Unique tag',value:'TAG'},{name:'text',label:'Default text',value:'Value'},{name:'x',label:'X',value:w.camera.x},{name:'y',label:'Y',value:w.camera.y},{name:'height',label:'Text height',value:12}],v=>w.edit('Add attribute definition',()=>{
        if(!v.tag.trim()||w.doc.entities.some(e=>e.type==='ATTDEF'&&e.tag.toUpperCase()===v.tag.toUpperCase()))throw new Error('Duplicate or empty attribute tag');
        const height=w.eval(v.height);if(height<=0)throw new Error('Text height must be positive');w.doc.entities.push(entity('ATTDEF',{attributeTag:v.tag,tag:v.tag,text:v.text,p:{x:w.eval(v.x),y:w.eval(v.y)},height,layer:'0'}));
    }));
}
function blockAuthor(w){
    if(!w.doc.blockEditing)throw new Error('Open the block editor first');const spec=w.doc.blockEditing.dynamic||{version:2,parameters:[],actions:[],constraints:[]};
    w.openModal('Block parameters & actions',`<p>Selection becomes the action selection set. Add a parameter, then attach an action. Sketch constraints may reference numeric parameter names.</p><div class="author-grid">${field('name','Parameter name','Length')}<label class="field">Type<select data-block-field="type">${['distance','angle','number','integer','boolean','enum'].map(t=>`<option>${t}</option>`).join('')}</select></label>${field('default','Default value','100')}${field('min','Minimum (optional)','')}${field('max','Maximum (optional)','')}${field('expression','Derived expression (optional)','')}${field('values','Enum / discrete values · JSON','')}</div><button class="btn" id="author-add-parameter">Add parameter</button><hr><div class="author-grid"><label class="field">Parameter<select id="author-parameter">${spec.parameters.map(p=>`<option>${E(p.name)}</option>`).join('')}</select></label><label class="field">Action<select id="author-action">${['stretch','move','rotate','scale','flip','array','polar','polar-array','visibility','lookup'].map(t=>`<option>${t}</option>`).join('')}</select></label>${field('dx','Direction / array step X','1')}${field('dy','Direction / array step Y','0')}${field('states','Visibility states / lookup rows (JSON)', '{}','textarea')}</div><button class="btn" id="author-add-action">Add action using selection (${w.selection.size})</button><div id="author-message" role="status"></div><h3>Definition</h3><textarea id="author-schema" aria-label="Complete block behavior schema">${E(JSON.stringify(spec,null,2))}</textarea><p class="muted-note">The full schema remains editable for selection sets, crossing windows, polar angles and ordered actions. Unsupported transformations are rejected. This authors Conduit behavior, not proprietary Autodesk action graphs.</p><div class="error-text"></div>`,{wide:true,confirm:'Apply behavior',onConfirm:()=>{
        const dynamic=JSON.parse(w.modal.querySelector('#author-schema').value);w.edit('Update block behavior',()=>{const candidate=editedBlockDefinition({...w.blockSession,draft:w.doc});candidate.dynamic={...dynamic,constraints:w.doc.constraints};evaluateDynamicBlock(candidate,{});w.doc.blockEditing.dynamic=dynamic;for(const p of dynamic.parameters)if(['number','distance','angle','integer'].includes(p.type))w.doc.parameters[p.name]=p.expression??p.default;});w.closeModal();
    }});
    const save=(modify)=>{try{const d=JSON.parse(w.modal.querySelector('#author-schema').value);modify(d);w.modal.querySelector('#author-schema').value=JSON.stringify(d,null,2);w.modal.querySelector('#author-parameter').innerHTML=d.parameters.map(p=>`<option>${E(p.name)}</option>`).join('');w.modal.querySelector('#author-message').textContent='Staged in definition. Apply to validate.';}catch(e){w.modal.querySelector('.error-text').textContent=e.message;}};
    w.modal.querySelector('#author-add-parameter').onclick=()=>save(d=>{
        const v=readFields(w),p={name:v.name,type:v.type,default:v.type==='enum'?v.default:v.type==='boolean'?v.default==='true':w.eval(v.default)};
        if(v.type==='boolean'&&!['true','false'].includes(v.default))throw new Error('Boolean default must be true or false');
        if(d.parameters.some(p=>p.name===v.name))throw new Error('Duplicate parameter');if(v.values)p.values=JSON.parse(v.values);if(v.expression)p.expression=v.expression;if(v.min)p.min=w.eval(v.min);if(v.max)p.max=w.eval(v.max);
        if(['distance','angle'].includes(p.type))p.grip={base:{x:0,y:0},direction:{x:1,y:0},radius:40};d.version=2;d.parameters.push(p);
    });
    w.modal.querySelector('#author-add-action').onclick=()=>save(d=>{
        const v=readFields(w),type=w.modal.querySelector('#author-action').value,parameter=w.modal.querySelector('#author-parameter').value;
        if(!parameter)throw new Error('Add a parameter first');if(!w.selection.size&&type!=='lookup')throw new Error('Select the geometry affected by this action before opening authoring');
        const a={type,parameter,entities:[...w.selection],direction:{x:w.eval(v.dx),y:w.eval(v.dy)},base:clone(w.doc.blockEditing.base)};
        if(type==='stretch'){let points=[];for(const e of w.selected()){const b=entityBounds(e,w.doc);points.push({x:b.minX,y:b.minY},{x:b.maxX,y:b.maxY});}const b=bounds(points);a.box={minX:(b.minX+b.maxX)/2,minY:b.minY-1,maxX:b.maxX+1,maxY:b.maxY+1};}
        if(type==='array')a.step={x:w.eval(v.dx),y:w.eval(v.dy)};if(type==='visibility')a.states=JSON.parse(v.states);if(type==='lookup'){a.rows=JSON.parse(v.states);delete a.entities;}d.actions.push(a);
    });
}
function blockManager(w){
    if(w.blockSession)throw new Error('Save or close the active block editor first');
    const names=Object.keys(w.doc.blocks).filter(n=>!w.doc.blocks[n].dimensionPicture&&!w.doc.blocks[n].dynamicInstance).sort();
    w.openModal('Block definitions',`<label class="field">Definition<select id="block-name">${names.map(n=>`<option>${E(n)}</option>`).join('')}</select></label><div class="operation-grid"><button class="btn" id="manager-insert">Insert at view center</button><button class="btn" id="manager-delete">Delete unused definition</button></div><hr><label class="field">New block name<input id="manager-name" value="NewBlock"></label><button class="btn" id="manager-create">Create and edit block</button><p>Edit geometry, constrain sketches, define ports and attributes. Save refreshes every placement. Referenced definitions cannot be deleted; all operations are undoable.</p><div class="error-text"></div>`,{confirm:'Edit definition',onConfirm:()=>startBlockEditor(w,w.modal.querySelector('#block-name').value)});
    const guarded=action=>{try{action();}catch(e){w.modal.querySelector('.error-text').textContent=e.message;}};
    w.modal.querySelector('#manager-create').onclick=()=>guarded(()=>{const name=w.modal.querySelector('#manager-name').value.trim();w.edit('Create block '+name,()=>createBlockDefinition(w.doc,name));startBlockEditor(w,name);});
    w.modal.querySelector('#manager-insert').onclick=()=>guarded(()=>{const name=w.modal.querySelector('#block-name').value;w.edit('Insert block '+name,()=>{const e=entity('INSERT',{block:name,x:w.camera.x,y:w.camera.y,sx:1,sy:1,layer:w.currentLayer,layout:w.doc.activeLayout});syncInsertAttributes(e,w.doc);w.doc.entities.push(e);w.selection=new Set([e.id]);});w.closeModal();});
    w.modal.querySelector('#manager-delete').onclick=()=>guarded(()=>{const name=w.modal.querySelector('#block-name').value;w.edit('Delete unused block',()=>deleteBlockDefinition(w.doc,name));blockManager(w);});
}
const constraintTypes=['horizontal','vertical','length','radius','diameter','angle','angle-between','coincident','concentric','parallel','perpendicular','collinear','equal','distance','distance-x','distance-y','point-on-line','point-on-circle','midpoint','tangent','symmetric','fixed','fixed-point'];
const unaryTypes=new Set(['horizontal','vertical','length','radius','diameter','angle','fixed','fixed-point']);
const numericTypes=new Set(['length','radius','diameter','angle','angle-between','distance','distance-x','distance-y']);
export function constraintAuthor(w){
    const selected=[...w.selection].map(id=>w.doc.entities.find(e=>e.id===id)).filter(Boolean);if(!selected.length)throw new Error('Select sketch geometry first');
    const options=e=>['a','b','c','p'].filter(k=>e?.[k]).concat((e?.points||[]).map((_,i)=>`points.${i}`)).map(k=>`<option>${k}</option>`).join('');
    w.openModal('Constrain sketch',`<p>${selected.length} objects in selection order. Dimensions are driving unless marked Reference. Angular expressions use degrees.</p><label class="field">Constraint<select id="constraint-type">${constraintTypes.map(t=>`<option>${t}</option>`).join('')}</select></label><div class="author-grid"><label class="field">First point<select id="constraint-point-a">${options(selected[0])}</select></label><label class="field">Second point<select id="constraint-point-b">${options(selected[1])}</select></label></div><div class="author-grid"><label class="field">First polyline segment (0-based)<input id="constraint-segment-a" value="0"></label><label class="field">Second polyline segment<input id="constraint-segment-b" value="0"></label></div><label class="field">Value or parameter expression<input id="constraint-value" value="100"></label><label class="field">Name (optional)<input id="constraint-name" placeholder="d1"></label><label><input id="constraint-reference" type="checkbox"> Reference measurement (does not constrain geometry)</label><div class="error-text"></div>`,{confirm:'Apply constraint',onConfirm:()=>{
        const type=w.modal.querySelector('#constraint-type').value,reference=w.modal.querySelector('#constraint-reference').checked,name=w.modal.querySelector('#constraint-name').value.trim(),value=w.modal.querySelector('#constraint-value').value;
        if(name&&(!/^[A-Za-z_]\w*$/.test(name)||reservedParameterNames().includes(name)||w.doc.constraints.some(c=>c.name===name)||Object.hasOwn(w.doc.parameters,name)))throw new Error('Constraint name must be unique and not shadow parameters');
        if(reference&&!numericTypes.has(type))throw new Error('Reference mode requires a measurable dimensional constraint');
        const count=unaryTypes.has(type)?1:type==='symmetric'?3:2;if(!unaryTypes.has(type)&&selected.length!==count)throw new Error(`This constraint requires ${count} objects`);
        const pa=w.modal.querySelector('#constraint-point-a').value,pb=w.modal.querySelector('#constraint-point-b').value,segmentA=Number(w.modal.querySelector('#constraint-segment-a').value),segmentB=Number(w.modal.querySelector('#constraint-segment-b').value);
        w.edit('Add '+type+' constraint',()=>{
            const groups=unaryTypes.has(type)?selected.map(e=>[e]):[selected];
            for(const [index,es]of groups.entries())w.doc.constraints.push({id:uid('constraint'),type,entities:es.map(e=>e.id),...(name?{name:groups.length>1?`${name}_${index+1}`:name}:{}),...(numericTypes.has(type)?{value}:{}),reference,segmentA,segmentB,pointA:pa||undefined,pointB:pb||undefined,...(type==='fixed'?{target:clone(es[0])}:{}),...(type==='fixed-point'?{target:clone(es[0][pa]||es[0].points?.[Number(pa.slice(7))])}:{})});
            w.solveConstraints();w.showConstraintAnnotations=true;
        });w.closeModal();w.toast('Constraint applied');
    }});
    const a=w.modal.querySelector('#constraint-point-a');if([...a.options].some(o=>o.value==='b'))a.value='b';
}
export function parameterManager(w){
    const descriptors=describeParameters(w.doc.parameters);
    const row=(name,expression,value)=>`<div class="param-row"><input class="param-name" aria-label="Parameter name" value="${E(name)}"><input class="param-expression" aria-label="Expression for ${E(name)}" value="${E(typeof expression==='object'?expression.expression:expression)}"><output class="param-result">${number(value)}</output><button class="remove-param" aria-label="Remove parameter">×</button></div>`;
    w.openModal('Parameters & solved calculations',`<p>Dependency-aware expressions. Functions include sqrt, hypot, sin, cos, atan2, min/max, clamp, rad and deg. Trigonometry uses radians; dimensional angle constraints use degrees.</p><div class="param-head"><span>Name</span><span>Expression</span><span>Calculated</span></div><div id="parameter-rows">${descriptors.map(p=>row(p.name,p.expression,p.value)).join('')}</div><button class="btn" id="add-parameter">Add parameter</button><div class="error-text" role="status"></div><h3>Constraint measurements</h3><div class="calculation-table">${constraintAnnotations(w.doc.entities,w.doc.constraints,w.doc.parameters).map(a=>`<div><b>${E(a.text)}</b><small>${a.reference?'Reference only':`Expression: ${E(a.expression??'geometric')}`}</small></div>`).join('')||'No constrained measurements.'}</div>`,{wide:true,confirm:'Apply parameters',onConfirm:()=>{
        const values=read();resolveParameters(values);w.edit('Apply parametric calculations',()=>{w.doc.parameters=values;for(const e of w.doc.entities)w.evaluateParametric(e);if(w.doc.blockEditing?.dynamic)for(const p of w.doc.blockEditing.dynamic.parameters){if(!Object.hasOwn(values,p.name))throw new Error('Block parameter must be edited through Parameters & actions');if(p.expression!==undefined)p.expression=values[p.name];else if(typeof p.default==='number')p.default=evaluateExpression(values[p.name],values);}
            w.solveConstraints();w.reroute();});w.closeModal();
    }});
    function read(){const next={};for(const r of w.modal.querySelectorAll('.param-row')){const name=r.querySelector('.param-name').value.trim();if(!/^[A-Za-z_]\w*$/.test(name)||reservedParameterNames().includes(name)||Object.hasOwn(next,name))throw new Error('Invalid, reserved or duplicate parameter: '+name);next[name]=r.querySelector('.param-expression').value;}return next;}
    w.modal.querySelector('#add-parameter').onclick=()=>w.modal.querySelector('#parameter-rows').insertAdjacentHTML('beforeend',row('size'+w.modal.querySelectorAll('.param-row').length,'100',100));
    w.modal.addEventListener('click',event=>event.target.closest('.remove-param')?.closest('.param-row')?.remove());
    w.modal.addEventListener('input',()=>{try{const values=resolveParameters(read());for(const r of w.modal.querySelectorAll('.param-row'))r.querySelector('output').textContent=number(values[r.querySelector('.param-name').value.trim()]);w.modal.querySelector('.error-text').textContent='';}catch(error){w.modal.querySelector('.error-text').textContent=error.message;}});
}
function solverReport(w){
    const report=w.solver.analyze(w.doc.entities,w.constraintsForSolve(),w.doc.parameters);w.lastSolve=report;
    const measured=new Map(report.annotations.map(a=>[a.id,a]));
    w.openModal('Parametric solve diagnostics',`<div class="solve-summary"><strong>${E(report.status)}</strong><p>${report.degreesOfFreedom} free scalar variables · rank ${report.rank} / ${report.variables}<br>${report.equations} equations in ${report.components.length} connected components · ${report.redundantEquations} dependent equations<br>Residual ${number(report.residual)}</p></div><p class="muted-note">Rank describes the supported planar variables at this configuration; it is not a proof of global uniqueness. Highlighted residuals are implicated constraints, not a minimal conflicting set.</p><div class="solver-list">${w.doc.constraints.map(c=>{const d=report.constraints.find(x=>x.id===c.id),a=measured.get(c.id);return `<section data-constraint-row="${E(c.id)}"><strong>${E(c.name||c.type)}</strong><span>${E(a?.text||c.type)}</span><small>${c.suppressed?'Suppressed':c.reference?'Reference':d?.satisfied?d.redundant?'Satisfied · dependent equation':'Satisfied':`Residual ${number(d?.residual)}`}</small><div><button class="btn" data-constraint-operation="edit" data-id="${E(c.id)}">Edit</button><button class="btn" data-constraint-operation="suppress" data-id="${E(c.id)}">${c.suppressed?'Enable':'Suppress'}</button><button class="btn" data-constraint-operation="remove" data-id="${E(c.id)}">Remove</button></div></section>`;}).join('')}</div>${B('solver-run','Solve now')}${B('constraint-display','Show / hide annotations')}${B('calculated-text','Calculated annotation')}`,{wide:true});
    w.modal.addEventListener('click',event=>{const t=event.target.closest('[data-constraint-operation]');if(!t)return;const c=w.doc.constraints.find(c=>c.id===t.dataset.id);if(!c)return;
        try{if(t.dataset.constraintOperation==='edit'){w.ask('Edit constraint',[{name:'name',label:'Name',value:c.name||''},{name:'value',label:'Expression (dimensional constraints)',value:c.value??''},{name:'reference',label:'Reference only · true / false',value:String(!!c.reference)}],v=>w.edit('Edit constraint',()=>{if(v.reference==='true'&&!numericTypes.has(c.type))throw new Error('Only dimensional constraints can be reference measurements');c.name=v.name;if(numericTypes.has(c.type))c.value=v.value;c.reference=v.reference==='true';}));return;}
            w.edit('Edit constraint set',()=>{if(t.dataset.constraintOperation==='remove')w.doc.constraints=w.doc.constraints.filter(x=>x!==c);else c.suppressed=!c.suppressed;});solverReport(w);
        }catch(e){w.toast(e.message,true);}
    });
}
export function refreshCalculations(w){
    const annotations=constraintAnnotations(w.doc.entities,w.doc.constraints||[],w.doc.parameters||{});w.constraintLabels=annotations;
    evaluateCalculations(w.doc.entities,w.doc.constraints||[],w.doc.parameters||{});
}
function calculatedText(w){w.ask('Calculated annotation',[{name:'expression',label:'Expression · user parameters and named measured constraints',value:Object.keys(w.doc.parameters)[0]||'100'},{name:'prefix',label:'Prefix',value:'Size = '},{name:'suffix',label:'Suffix',value:' '+w.doc.units},{name:'precision',label:'Decimal precision',value:3}],v=>w.edit('Create calculated annotation',()=>{const e=entity('TEXT',{p:{x:w.camera.x,y:w.camera.y},height:12,layer:'Annotations',text:'',layout:w.doc.activeLayout,calculation:{version:1,expression:v.expression,prefix:v.prefix,suffix:v.suffix,precision:Number(v.precision)}});w.doc.entities.push(e);w.selection=new Set([e.id]);refreshCalculations(w);}));}
export function drawParametricOverlay(w,ctx,cam){
    if(w.showConstraintAnnotations){const seen=new Map();ctx.save();ctx.font='11px ui-monospace,monospace';ctx.textBaseline='middle';
        for(const a of w.constraintLabels||[]){if(!a.visible||!a.entityIds.some(id=>w.doc.entities.some(e=>e.id===id&&(e.layout||'Model')===(w.doc.activeLayout||'Model'))))continue;const p=cam.screen(a.position),key=a.entityIds[0],offset=seen.get(key)||0;seen.set(key,offset+1);const x=p.x+12,y=p.y-18-offset*20;if(x<24||y<24||x>cam.width-24||y>cam.height-24)continue;const width=ctx.measureText(a.text).width+12;ctx.fillStyle=a.reference?'#f0f3fb':'#e4f3ed';ctx.strokeStyle='#65a48b';ctx.lineWidth=1;ctx.fillRect(x,y-9,width,18);ctx.strokeRect(x,y-9,width,18);ctx.fillStyle='#265547';ctx.fillText(a.text,x+6,y);}
        ctx.restore();
    }
    if(w.doc.blockEditing){ctx.save();const base=cam.screen(w.doc.blockEditing.base);ctx.strokeStyle='#9252b8';ctx.beginPath();ctx.moveTo(base.x-10,base.y);ctx.lineTo(base.x+10,base.y);ctx.moveTo(base.x,base.y-10);ctx.lineTo(base.x,base.y+10);ctx.stroke();ctx.font='11px sans-serif';
        for(const port of w.doc.blockEditing.ports){const p=cam.screen(port);ctx.beginPath();ctx.arc(p.x,p.y,6,0,Math.PI*2);ctx.fillStyle='#f9f3ff';ctx.fill();ctx.stroke();ctx.fillStyle='#674280';ctx.fillText(port.name,p.x+9,p.y-7);}ctx.restore();
    }
}
function parametricDemo(w){w.edit('Create constrained bracket',()=>{
    const base={x:w.camera.x,y:w.camera.y},a=entity('LINE',{a:base,b:{x:base.x+120,y:base.y},layer:'0'}),b=entity('LINE',{a:{x:base.x+120,y:base.y},b:{x:base.x+120,y:base.y+70},layer:'0'}),hole=entity('CIRCLE',{c:{x:base.x+60,y:base.y+35},r:12,layer:'0'});
    w.doc.entities.push(a,b,hole);Object.assign(w.doc.parameters,{bracketWidth:120,bracketHeight:70,holeDiameter:'bracketHeight/3'});
    const cs=[{type:'fixed-point',entities:[a.id],pointA:'a',target:base},{type:'horizontal',entities:[a.id]},{type:'length',entities:[a.id],value:'bracketWidth',name:'widthMeasured'},{type:'coincident',entities:[a.id,b.id]},{type:'vertical',entities:[b.id]},{type:'length',entities:[b.id],value:'bracketHeight'},{type:'diameter',entities:[hole.id],value:'holeDiameter'},{type:'length',entities:[a.id],reference:true,name:'spanReference'}];
    w.doc.constraints.push(...cs.map(c=>({id:uid('constraint'),...c})));w.selection=new Set([a.id,b.id,hole.id]);w.showConstraintAnnotations=true;
});w.closeModal();w.renderer.fit();}
export function parametricAction(w,action){
    if(w.blockSession&&['new','open','export','save-project','rename','library-guide'].includes(action))throw new Error('Save or close the block editor before changing or exporting the drawing');
    if(action==='block-edit'){const e=w.selected()[0];if(!e||e.type!=='INSERT'||isLocked(e,w.doc))throw new Error('Select an unlocked block insert');startBlockEditor(w,e.block);return true;}
    if(action==='blocks'){blockManager(w);return true;}
    if(action==='block-save'||action==='block-save-close'){finishBlockEditor(w,true,action==='block-save');return true;}
    if(action==='block-close'){w.openModal('Discard block edits?','<p>The drawing and its inserts keep the last saved definition.</p>',{confirm:'Discard edits',onConfirm:()=>{w.closeModal();finishBlockEditor(w,false);}});return true;}
    if(action==='block-test'){testBlock(w);return true;}if(action==='block-test-close'){endBlockTest(w);return true;}
    if(action==='block-settings'){settings(w);return true;}if(action==='block-port'){addPort(w);return true;}if(action==='block-attribute'){addAttribute(w);return true;}if(action==='block-author'){blockAuthor(w);return true;}
    if(action==='block-save-as'){w.ask('Save block as',[{name:'name',label:'New block name',value:w.blockSession.name+'_copy'}],v=>finishBlockEditor(w,true,false,v.name));return true;}
    if(action==='block-sync-attributes'){const e=w.selected()[0];if(e?.type!=='INSERT')throw new Error('Select a block insert');w.edit('Synchronize block attributes',()=>{const report=updateBlockDefinition(w.doc,e.block,w.doc.blocks[e.block]);w.reroute(new Set(report.inserts));});return true;}
    if(action==='block-copy'||action==='block-rename'){const e=w.selected()[0];if(e?.type!=='INSERT')throw new Error('Select a block insert');w.ask(action==='block-copy'?'Make insert unique':'Rename shared block',[{name:'name',label:'New definition name',value:e.block+'_copy'}],v=>w.edit('Change block identity',()=>{if(action==='block-copy'){duplicateBlockDefinition(w.doc,e.block,v.name);w.doc.entities.find(x=>x.id===e.id).block=v.name;}else renameBlockDefinition(w.doc,e.block,v.name);}));return true;}
    if(action==='auto-constrain'){const selected=w.selected();if(!selected.length)throw new Error('Select sketch geometry first');w.edit('Auto constrain sketch',()=>{w.doc.constraints.push(...inferSketchConstraints(selected,w.doc.constraints));w.showConstraintAnnotations=true;});return true;}
    if(action==='constraint'){constraintAuthor(w);return true;}if(action==='parameters'){parameterManager(w);return true;}if(action==='solver-report'){solverReport(w);return true;}
    if(action==='solver-run'){w.edit('Solve parametric sketch',()=>w.solveConstraints());solverReport(w);return true;}
    if(action==='constraint-display'){w.showConstraintAnnotations=!w.showConstraintAnnotations;refreshCalculations(w);w.renderer.invalidate();return true;}
    if(action==='calculation-bake'){const e=w.selected()[0];if(!e?.calculation)throw new Error('Select calculated text');w.edit('Convert calculation to static text',()=>{delete e.calculation;});return true;}
    if(action==='calculated-text'){calculatedText(w);return true;}if(action==='parametric-demo'){parametricDemo(w);return true;}
    return false;
}
