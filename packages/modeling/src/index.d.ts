import type { CadDocument, CadEntity } from '@conduitcad/model';
import type { Mesh, Point3 } from '@conduitcad/geometry3d';
export type FeatureKind = 'box'|'cylinder'|'cone'|'sphere'|'torus'|'wedge'|'extrude'|'revolve'|'loft'|'sweep'|'transform'|'offset-face'|'union'|'subtract'|'intersect'|'linear-pattern'|'circular-pattern'|'mirror';
export interface FeatureDefinition { version:1; kind:FeatureKind; parameters:Record<string,number|string>; inputs:string[]; suppressed:boolean; }
export type FeatureEntity=CadEntity & Mesh & {feature3d:FeatureDefinition;model3dConsumed?:boolean;label?:string};
export interface ModelingTool { id:FeatureKind;label:string;group:string;inputs?:number;multiple?:boolean;fields:Array<{name:string;label:string;value:number}>; }
export interface Example3D { id:string;name:string;industry:string;description:string;operations:string[]; }
export const MODELING_TOOLS:ModelingTool[];
export const EXAMPLES_3D:Example3D[];
export function create3DExample(id:string):CadDocument;
export function curvePoints3(entity:CadEntity,options?:{closed?:boolean;samples?:number}):{points:Point3[];closed:boolean};
export function regenerateFeatures(document:CadDocument):{features:number;updated:string[];order?:string[]};
export function addFeature(document:CadDocument,kind:FeatureKind,parameters?:Record<string,number|string>,inputs?:string[],options?:{layer?:string;name?:string;color?:string}):FeatureEntity;
export function editFeature(document:CadDocument,id:string,patch:{parameters?:Record<string,number|string>;inputs?:string[];suppressed?:boolean;name?:string}):FeatureEntity;
export function removeFeature(document:CadDocument,id:string,options?:{cascade?:boolean}):string[];
export function bakeFeature(document:CadDocument,id:string):CadEntity & Mesh;
export function offsetPlanarFace(mesh:Mesh,index:number,distance:number):Mesh;
export function sectionEntities(mesh:Mesh,axis?:'x'|'y'|'z',offset?:number):CadEntity[];
export function writeOBJ(mesh:Mesh):string;
export function writeSTL(mesh:Mesh,name?:string):string;

export function controlPoints3(entity:CadEntity):Point3[];
export function setControlPoint3<T extends CadEntity>(entity:T,index:number,point:Point3):T;
