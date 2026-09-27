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
 readonly displaySettings:DisplaySettings3D;
 section:SectionPlane|null;style:VisualStyleId;marker:Point3|null;active:boolean;uploads:number;
 stats:{backend:string;style:VisualStyleId;triangles:number;segments:number;frameMs:number;uploads:number;passes:number;estimatedAttachmentBytes:number;capTriangles:number};
 drawOverlay?:(context:CanvasRenderingContext2D,camera:OrbitCamera)=>void;
 onFrame?:(stats:SpatialRenderer['stats'])=>void;
 setDocument(document:CadDocument,options?:{showInputs?:boolean;maxTriangles?:number;maxInstances?:number}):void;
 setSelection(ids:Set<string>,face?:PickResult3D|null):void;
 setDisplaySettings(settings:Partial<DisplaySettings3D>,options?:{replace?:boolean;tolerant?:boolean}):DisplaySettings3D;
 capturePNG(options?:{annotations?:boolean}):Promise<Blob>;
 resize():void;upload():void;invalidate():void;draw():void;fit():void;dispose():void;
 pick(x:number,y:number,options?:{mode?:'body'|'face'|'vertex';radius?:number}):PickResult3D|null;
}

/** Stable display identifiers; these change presentation, never CAD topology. */
export type VisualStyleId = 'shaded-edges'|'shaded'|'shaded-hidden'|'wireframe'|'hidden'|'wireframe-hidden'|'realistic'|'realistic-edges'|'conceptual'|'gray'|'sketchy'|'xray'|'flat'|'flat-edges'|'clay'|'normals';
export interface VisualStyle3D { readonly id:VisualStyleId;readonly label:string;readonly group:string;readonly faces:'none'|'shaded'|'pbr'|'gooch'|'gray'|'clay'|'normals';readonly visible:boolean;readonly hidden:boolean|'solid';readonly smooth:boolean;readonly description:string; }
export interface DisplaySettings3D {
 style:VisualStyleId;environment:'studio'|'soft'|'outdoor'|'dark';exposure:number;grid:boolean;ground:boolean;
 shadows:boolean;ambientOcclusion:boolean;aoStrength:number;aoRadius:number;
 background:'solid'|'gradient';backgroundColor:string;backgroundTop:string;groundColor:string;
 edgeColor:string;hiddenColor:string;edgeWidth:number;silhouetteWidth:number;creaseAngle:number;edgeDetail:'feature'|'all';
 hiddenDash:number;xrayOpacity:number;jitter:number;overhang:number;quality:'draft'|'balanced'|'high';
 sectionCaps:boolean;capColor:string;capHatch:boolean;
}
export interface Material3D { color:string;metallic:number;roughness:number;opacity:number;emission:number; }
export const VISUAL_STYLES:readonly VisualStyle3D[];
export const DEFAULT_DISPLAY_SETTINGS:Readonly<DisplaySettings3D>;
export const ENVIRONMENTS:readonly {readonly id:DisplaySettings3D['environment'];readonly label:string;readonly light:readonly number[];readonly sky:readonly number[];readonly floor:readonly number[]}[];
export const MATERIAL_PRESETS:readonly Readonly<Omit<Material3D,'emission'> & {id:string;label:string}>[];
export function visualStyle(id:string):VisualStyle3D;
export function normalizeDisplaySettings(input?:Partial<DisplaySettings3D>|unknown,options?:{tolerant?:boolean}):DisplaySettings3D;
export function normalizeMaterial(input?:Partial<Material3D> & {preset?:string},fallbackColor?:string):Material3D;
/** Create an editable sphere/material and annular-section reference drawing. */
export function createRenderingStudy():CadDocument;
