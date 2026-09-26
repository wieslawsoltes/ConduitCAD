import type { CadDocument } from '@conduitcad/model';
import type { Point3,Vec3,Mat4,Bounds3 } from '@conduitcad/geometry3d';
export interface CameraState3D { target:Vec3; yaw:number; pitch:number; distance:number; height:number; perspective:boolean; }
export interface SectionPlane { normal:Vec3; offset:number; }
export interface PickResult3D { id:string;sourceId?:string;face?:number;vertex?:number;triangle?:number[];point:Vec3;distance:number;screenDistance?:number; }
export class OrbitCamera {
 constructor(state?:Partial<CameraState3D>);
 target:Vec3;yaw:number;pitch:number;distance:number;height:number;perspective:boolean;width:number;pixelHeight:number;
 basis():{back:Vec3;right:Vec3;up:Vec3;forward:Vec3;eye:Vec3};
 resize(width:number,height:number):void;
 project(point:Point3):{x:number;y:number;depth:number;visible:boolean};
 ray(x:number,y:number):{origin:Vec3;direction:Vec3};
 matrix(origin?:Point3):Mat4;near():number;far():number;
 orbit(dx:number,dy:number):void;pan(dx:number,dy:number):void;zoom(factor:number):void;fit(points:Point3[]):void;
 view(name:'iso'|'top'|'bottom'|'front'|'back'|'right'|'left'):void;snapshot():CameraState3D;
}
export interface Scene3D { items:Array<{id:string;sourceId:string;points:Point3[];controls?:Point3[];faces:number[][];style:unknown}>;triangles:Array<{id:string;sourceId:string;face:number;indices:number[];vertices:Point3[];normal:Vec3;color:string}>;lines:Array<{id:string;a:Point3;b:Point3;color:string;edge?:boolean;coplanar?:boolean}>;labels:Array<{id:string;p:Point3;text:string;color:string;height?:number}>;diagnostics:Array<{id:string;message:string}>;points:Point3[];bounds:Bounds3;origin:Vec3; }
export function buildScene3D(document:CadDocument,options?:{showInputs?:boolean;maxTriangles?:number;maxInstances?:number}):Scene3D;
export function pick3D(scene:Scene3D,camera:OrbitCamera,x:number,y:number,options?:{mode?:'body'|'face'|'vertex';radius?:number;section?:SectionPlane|null}):PickResult3D|null;
export interface BackendStatus3D { backend:string;requested?:string;fallback?:boolean;reasons?:string[]; }
export class SpatialRenderer {
 constructor(host:HTMLElement,options?:{backend?:'auto'|'webgpu'|'webgl2'|'canvas';camera?:OrbitCamera;onStatus?:(status:BackendStatus3D)=>void});
 ready:Promise<void>;camera:OrbitCamera;scene:Scene3D;canvas:HTMLCanvasElement;overlay:HTMLCanvasElement;backend:string;
 section:SectionPlane|null;style:'shaded'|'shaded-edges'|'wireframe';marker:Point3|null;active:boolean;uploads:number;
 stats:{backend:string;triangles:number;segments:number;frameMs:number;uploads:number};
 drawOverlay?:(context:CanvasRenderingContext2D,camera:OrbitCamera)=>void;
 onFrame?:(stats:SpatialRenderer['stats'])=>void;
 setDocument(document:CadDocument,options?:{showInputs?:boolean;maxTriangles?:number;maxInstances?:number}):void;
 setSelection(ids:Set<string>,face?:PickResult3D|null):void;
 resize():void;upload():void;invalidate():void;draw():void;fit():void;dispose():void;
 pick(x:number,y:number,options?:{mode?:'body'|'face'|'vertex';radius?:number}):PickResult3D|null;
}
