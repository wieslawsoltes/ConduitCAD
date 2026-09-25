/** Optional compile-only consumer check: tsc -p tests/tsconfig.json. */
import {createDocument, line, circle, entity, moveEntity, type CadDocument, type HatchEntity, textLayout, objectCoordinateTransform} from '@conduitcad/model';
import {lineIntersection, offsetPolyline} from '@conduitcad/geometry';
import {CadRenderer, Camera, buildScene, updateSceneEntities} from '@conduitcad/renderer';
import {installSymbols, insertSymbol} from '@conduitcad/symbols';
import {parseDXF, writeDXF} from '@conduitcad/dxf';
import {ConstraintSolver, evaluateExpression} from '@conduitcad/constraints';
import {History} from '@conduitcad/history';
import {routePorts} from '@conduitcad/routing';
import {SpatialIndex} from '@conduitcad/spatial';
import {mountWorkbench} from '@conduitcad/workbench';
import {PointerController} from '@conduitcad/input';
import {ProjectStore} from '@conduitcad/storage';
import {writeSVG, writeBOM} from '@conduitcad/exchange';

let documentModel: CadDocument = installSymbols(createDocument('Integration'));
const e = line({x:0,y:0},{x:100,y:0});
documentModel.entities.push(e, circle({x:10,y:10},20), insertSymbol(documentModel,'pump',100,100));
const scene = buildScene(documentModel);
moveEntity(e,2,3);
const changes = updateSceneEntities(scene,documentModel,[e.id]);
if (changes) changes.forEach(range=>console.log(range.offset));
const history = new History({capture:()=>documentModel,restore:(value:CadDocument)=>{documentModel=value;}});
history.run('Sketch',()=>new ConstraintSolver().solve(documentModel.entities,[{type:'horizontal',entityId:e.id}],documentModel.parameters));
const output = writeDXF(documentModel,{version:'AC1032'});
const reread:CadDocument = parseDXF(output);
const svg:string = writeSVG(reread);
const bom:string = writeBOM(reread);
const value:number = evaluateExpression('2+3');
const host = document.createElement('div');
const renderer = new CadRenderer(host,{camera:new Camera(),onStatus:status=>console.log(status.backend)});
renderer.setDocument(documentModel);
renderer.updateEntities([e.id]);
const app = mountWorkbench(host,{document:documentModel,backend:'canvas'});
void [lineIntersection,offsetPolyline,entity,routePorts,SpatialIndex,PointerController,ProjectStore,svg,bom,value,app];

const hatch: HatchEntity = {id: 'h', type: 'HATCH', layer: '0', solid: true, loops: [{flags: 3, closed: true, points: [{x: 0, y: 0}, {x: 10, y: 0}, {x: 10, y: 10}]}]};
const native = parseDXF(output, {encoding: 'utf-8', mtextRotationUnit: 'degrees'});
const layout = textLayout({text: 'TAG\\P101', mtext: true, mtextWidth: 100, attachment: 5, height: 12});
const transform = objectCoordinateTransform({x: 0, y: 0, z: -1}, 8);
const viewScene = buildScene(native, {view: {minX: 0, minY: 0, maxX: 100, maxY: 100}});
const inside: boolean = renderer.containsPoint({x: 40, y: 40});
void [hatch, layout.lines, transform, viewScene.diagnostics, inside, renderer.stats.compositor];

import {CATEGORIES, SYMBOLS, DRAWING_TYPES, STANDARD_REFERENCES, searchSymbols, auditSymbols, symbolUpdates, updateSymbolDefinitions, createDrawing, type SymbolMaster} from '@conduitcad/symbols';
const master: SymbolMaster | undefined = searchSymbols('pump',{category:'Hydraulics',standard:'ISO-1219-1',limit:4})[0];
const templates: string[] = DRAWING_TYPES.map(t=>t.industry);
const auditErrors: string[] = auditSymbols().flatMap(r=>r.errors);
const newer = symbolUpdates(documentModel).map(s=>s.id);
updateSymbolDefinitions(documentModel,newer);
void [master?.ports[0]?.medium, CATEGORIES[0].description, STANDARD_REFERENCES['ISO-1219-1'].scope, SYMBOLS[0].symbol.review, templates, auditErrors, createDrawing('water-treatment')];

import {writeDXFBinary, inspectObjectGraph, type DXFWriteOptions, type DXFPair} from '@conduitcad/dxf';
import type {DimensionEntity, ViewportEntity, MeshEntity, WipeoutEntity} from '@conduitcad/model';
const preservingOptions: DXFWriteOptions = {mode: 'preserve'};
const binary: Uint8Array = writeDXFBinary(native, preservingOptions);
const graphTags: DXFPair[] = inspectObjectGraph(native).nodes.flatMap(node => node.tags);
const mesh: MeshEntity = {id:'mesh',type:'MESH',layer:'0',points:[{x:0,y:0,z:0},{x:1,y:0,z:0},{x:0,y:1,z:0}],faces:[[0,1,2]]};
void [binary, graphTags, mesh];

import {editDimension, dimensionPicture, regenerateDimensions, dimensionGrips, evaluateDynamicBlock, setDynamicParameters, dynamicValues, dynamicGripValue, dynamicParameterGrips, validateDynamicBlock, type Block, type DynamicDefinition, type DimensionEdit} from '@conduitcad/model';
const dimensionPatch: DimensionEdit = {offset: 24, text: '<> mm', style: {dimtxt: 4, dimdec: 2}};
const managed = entity('DIMENSION', {a:{x:0,y:0},b:{x:100,y:0}});
editDimension(managed, documentModel, dimensionPatch);
const picture = dimensionPicture(managed, documentModel);
const behavior: DynamicDefinition = {
    version: 1,
    parameters: [{name:'Length',type:'distance',default:100,min:10,max:1000,grip:{base:{x:0,y:20},direction:{x:1,y:0}}}],
    actions: [{type:'stretch',parameter:'Length',box:{minX:50,minY:-50,maxX:1000,maxY:50}}]
};
const dynamicBlock: Block = {name:'Editable',entities:[line({x:0,y:0},{x:100,y:0})],dynamic:behavior};
validateDynamicBlock(dynamicBlock);
const variant = evaluateDynamicBlock(dynamicBlock,{Length:200},{maxEntities:100});
void [variant.dynamicValues, dynamicValues(dynamicBlock), picture.entities, regenerateDimensions(documentModel), dimensionGrips(managed, documentModel), setDynamicParameters, dynamicGripValue, dynamicParameterGrips];

import {beginBlockEdit, editedBlockDefinition, prepareBlockUpdate, updateBlockDefinition, inspectBlockReferences, type BlockEditSession} from '@conduitcad/model';
import {describeParameters, inferSketchConstraints, evaluateCalculations, type SolveReport, type SketchConstraint} from '@conduitcad/constraints';
const sketchRelations: SketchConstraint[] = [{type:'length',entityId:e.id,value:'Span',name:'measuredSpan'},{type:'fixed-point',entityId:e.id,pointA:'a',target:{x:0,y:0}}];
const solve: SolveReport = new ConstraintSolver({relativeTolerance:1e-10,maxVariables:256}).analyze([e],sketchRelations,{Span:100});
const session: BlockEditSession = beginBlockEdit(documentModel,'Part');
const blockDefinition = editedBlockDefinition(session);
const prepared = prepareBlockUpdate(documentModel,'Part',blockDefinition,{expectedSignature:session.signature,attributes:true});
const constraintBased: import('@conduitcad/model').DynamicDefinition = {version:2,parameters:[{name:'Width',type:'distance',default:100},{name:'HalfWidth',type:'distance',default:50,expression:'Width/2'}],actions:[{type:'polar-array',parameter:'Width',angle:360,base:{x:0,y:0}}],constraints:[{type:'length',entityId:e.id,value:'Width'}]};
void [solve.degreesOfFreedom,solve.conflicts,solve.annotations,prepared.report.updatedInserts,updateBlockDefinition,inspectBlockReferences,describeParameters({Width:100,Diagonal:'hypot(Width,Width)'}),inferSketchConstraints([e]),evaluateCalculations, constraintBased,app.beginBlockEdit,app.saveBlockEdit];
