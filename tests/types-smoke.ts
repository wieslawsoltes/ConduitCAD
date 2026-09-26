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

import {DRAWING_TOOLS, DrawingSession, createDrawingEntity, hatchPattern, parseDrawingPoint, type DrawingToolId} from '@conduitcad/drawing';
const newTool: DrawingToolId = DRAWING_TOOLS[0].id;
const drawingSession = new DrawingSession(newTool);
const drawingPoint = parseDrawingPoint('@30<45',{x:0,y:0},x=>Number(x));
const drawingResult = drawingSession.add(drawingPoint, {layer:'0'}, documentModel);
const drawingPreview = drawingSession.preview({x:20,y:50},{},documentModel);
const nativeEllipse = createDrawingEntity('ellipse',[{x:0,y:0},{x:50,y:0},{x:0,y:20}],{}, {},documentModel);
void [drawingResult,drawingPreview,nativeEllipse,hatchPattern({pattern:'cross'}).pattern,drawingSession.canFinish,app.drawingSession];

// Multi-document sessions have a reusable generic persistence contract.
import { DocumentWorkspace, type WorkspaceManifest } from '@conduitcad/workspace';
const multiWorkspace = new DocumentWorkspace<{name: string; entities: {id:string}[]}>({
    store: { async saveWorkspace(records, manifest, key) {
        const ordered: string[] = manifest.ids;
        const name: string = records[0].document.name;
        void ordered; void name; void key;
    } }
});
const multiSession = multiWorkspace.add({ name: 'Drawing', entities: [] });
multiWorkspace.activate(multiSession.id);
multiWorkspace.markChanged(multiSession.id);
const multiSaved: Promise<WorkspaceManifest> = multiWorkspace.saveAll();
void multiSaved;

// Recovered 3D public modules: compile the declarations through an independent consumer.
import { V3, boxMesh, extrudeMesh, meshProperties, type Mesh, type Point3 } from '@conduitcad/geometry3d';
import { EXAMPLES_3D, create3DExample, addFeature, editFeature, regenerateFeatures, controlPoints3, setControlPoint3, writeOBJ, type FeatureEntity } from '@conduitcad/modeling';
import { OrbitCamera, SpatialRenderer, buildScene3D, pick3D, type Scene3D } from '@conduitcad/renderer3d';
const spatialMesh: Mesh = boxMesh(10, 20, 30);
const spatialDocument: CadDocument = create3DExample(EXAMPLES_3D[0].id);
const spatialFeature: FeatureEntity = addFeature(spatialDocument, 'box', {width: '20+5', depth: 15, height: 10});
editFeature(spatialDocument, spatialFeature.id, {parameters: {height: 20}});
const spatialScene: Scene3D = buildScene3D(spatialDocument);
const spatialCamera = new OrbitCamera({perspective: true, target: V3(1, 2, 3)});
spatialCamera.resize(800, 600);
const spatialPoints: Point3[] = controlPoints3(spatialFeature);
const spatialRenderer = new SpatialRenderer(host, {backend: 'canvas', camera: spatialCamera});
spatialRenderer.setDocument(spatialDocument);
spatialRenderer.setSelection(new Set([spatialFeature.id]));
void [extrudeMesh, meshProperties(spatialMesh).centroid, writeOBJ(spatialMesh), spatialPoints, setControlPoint3, regenerateFeatures, pick3D(spatialScene, spatialCamera, 400, 300), spatialRenderer.ready];

import { faceFrame3, profileOnFace3, holeTool3, extrudeExtent3, type HoleParameters3 } from '@conduitcad/modeling';
const holeParams:HoleParameters3={face:1,holeType:2,through:1,diameter:8};
void [faceFrame3,profileOnFace3,holeTool3,extrudeExtent3,holeParams];

// Independent icon package and typed workbench presentation preferences.
import { ICON_NAMES, ICON_GROUPS, hasIcon, icon as cadIcon } from '@conduitcad/icons';
import type { IconName } from '@conduitcad/icons';
const glyph: IconName = 'extrude';
const markup: string = cadIcon(glyph, 'command-icon');
const known: boolean = hasIcon(glyph);
const names: readonly IconName[] = ICON_NAMES;
const groups: Readonly<Record<string, readonly IconName[]>> = ICON_GROUPS;
void [markup, known, names, groups];
