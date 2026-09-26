import type { CadDocument, CadEntity } from '@conduitcad/model';
import type { Mesh, Point3 } from '@conduitcad/geometry3d';
export type FeatureKind = 'box'|'cylinder'|'cone'|'sphere'|'torus'|'wedge'|'extrude'|'hole'|'revolve'|'loft'|'sweep'|'transform'|'offset-face'|'union'|'subtract'|'intersect'|'linear-pattern'|'circular-pattern'|'mirror';
export interface FeatureDefinition { version:1; kind:FeatureKind; parameters:Record<string,number|string>; inputs:string[]; suppressed:boolean; attachment?:FaceReference3; }
export type FeatureEntity=CadEntity & Mesh & {feature3d:FeatureDefinition;model3dConsumed?:boolean;label?:string};
export interface ModelingTool { id:FeatureKind;label:string;group:string;inputs?:number;multiple?:boolean;maxInputs?:number;fields:Array<{name:string;label:string;value:number;options?:string[]}>; }
export interface Example3D { id:string;name:string;industry:string;description:string;operations:string[]; }
export const MODELING_TOOLS:ModelingTool[];
export const EXAMPLES_3D:Example3D[];
export function create3DExample(id:string):CadDocument;
export function curvePoints3(entity:CadEntity,options?:{closed?:boolean;samples?:number}):{points:Point3[];closed:boolean};
export function regenerateFeatures(document:CadDocument):{features:number;updated:string[];order?:string[]};
export function addFeature(document:CadDocument,kind:FeatureKind,parameters?:Record<string,number|string>,inputs?:string[],options?:{layer?:string;name?:string;color?:string}):FeatureEntity;
export function editFeature(document:CadDocument,id:string,patch:{parameters?:Record<string,number|string>;inputs?:string[];suppressed?:boolean;name?:string;reattach?:boolean}):FeatureEntity;
export function removeFeature(document:CadDocument,id:string,options?:{cascade?:boolean}):string[];
export function bakeFeature(document:CadDocument,id:string):CadEntity & Mesh;
export function offsetPlanarFace(mesh:Mesh,index:number,distance:number):Mesh;
export function sectionEntities(mesh:Mesh,axis?:'x'|'y'|'z',offset?:number):CadEntity[];
export function writeOBJ(mesh:Mesh):string;
export function writeSTL(mesh:Mesh,name?:string):string;

export function controlPoints3(entity:CadEntity):Point3[];
export function setControlPoint3<T extends CadEntity>(entity:T,index:number,point:Point3):T;

export interface FaceReference3 { face:number; vertices:number[]; vertexCount:number; faceCount:number; }
export interface FaceFrame3 { origin:Point3;u:Point3;v:Point3;normal:Point3;tolerance:number;reference:FaceReference3; }
export interface ExtrusionParameters3 { height?:number;extent?:0|1|2;distance2?:number;startOffset?:number;useNormal?:0|1;profileNormal?:Point3;nx?:number;ny?:number;nz?:number;taper?:number; }
export interface HoleParameters3 { face?:number;u?:number;v?:number;diameter?:number;depth?:number;through?:0|1;holeType?:0|1|2;counterDiameter?:number;counterDepth?:number;sinkAngle?:number;segments?:number; }
export function faceFrame3(mesh:Mesh,index:number,reference?:FaceReference3|null):FaceFrame3;
export function faceCoordinates3(frame:FaceFrame3,point:Point3):{u:number;v:number;offset:number};
export function facePoint3(frame:FaceFrame3,u?:number,v?:number,offset?:number):Point3;
export function profileOnFace3(mesh:Mesh,face:number,options?:{shape?:'rectangle'|'circle';width?:number;height?:number;radius?:number;u?:number;v?:number;offset?:number}):CadEntity;
export function extrudeExtent3(profile:Point3[],parameters:ExtrusionParameters3):Mesh;
export function combineExtrusion3(tool:Mesh,target?: (CadEntity & Mesh)|null,operation?:0|1|2|3):Mesh;
export function holeTool3(target:Mesh,parameters?:HoleParameters3,reference?:FaceReference3|null):{mesh:Mesh;frame:FaceFrame3;center:Point3;depth:number};
export function drillHole3(target:Mesh,parameters?:HoleParameters3,reference?:FaceReference3|null):Mesh;
