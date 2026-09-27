import type { CadDocument, CadEntity } from '@conduitcad/model';
import type { Point3, Vec3 } from '@conduitcad/geometry3d';
export interface Pointer2 { x:number; y:number; }
export interface Projection3 {
 width:number; pixelHeight:number; height:number; perspective:boolean;
 near():number;
 project(point:Point3):Pointer2 & {depth:number;visible:boolean};
 ray(x:number,y:number):{origin:Vec3;direction:Vec3};
 basis():{eye:Vec3;right:Vec3;up:Vec3;forward:Vec3;back:Vec3};
}
export interface AxisDrag3 { readonly kind:'axis'; readonly fallback:boolean; }
export interface PlaneDrag3 { readonly kind:'plane'; }
export interface AngleDrag3 { readonly kind:'angle'; accumulated:number; }
export interface VisualField3 { name:string;label:string;value:number;options?:readonly string[]; }
export interface VisualTool3 { id:string; label:string; group:string; fields:readonly VisualField3[]; inputs?:number; multiple?:boolean; }
export interface VisualHandle3 {
 id:string;kind:'axis'|'plane'|'angle';field?:string;fields?:string[];label:string;origin:Vec3;point:Vec3;
 axis?:Vec3;u?:Vec3;v?:Vec3;factor?:number;radius?:number;value?:number;color:string;unit:'length'|'angle'|'scale';
}
export interface VisualSnapshot3 { parameters:Record<string,string|number>; inputs:string[]; name:string; }
export interface VisualHit3 { id:string;face?:number;vertex?:number;point?:Point3; }
export class VisualEditSession {
 constructor(document:CadDocument,kind:string,options?:{id?:string|null;inputs?:string[];parameters?:Record<string,string|number>;name?:string;hit?:VisualHit3|null});
 readonly tool:VisualTool3;readonly kind:string;readonly id:string|null;readonly sourceVersion:number|undefined;
 source:CadDocument|null;base:CadDocument|null;parameters:Record<string,string|number>;inputs:string[];name:string;
 closed:boolean;revision:number;validatedRevision:number;preview:CadDocument|null;resultId:string|null;error:string|null;evaluations:number;
 readonly undoStack:VisualSnapshot3[];readonly redoStack:VisualSnapshot3[];readonly initial:VisualSnapshot3;
 snapshot():VisualSnapshot3;restore(snapshot:VisualSnapshot3):void;checkpoint(snapshot?:VisualSnapshot3):void;undo():boolean;redo():boolean;
 set(name:string,value:string|number):void;value(name:string):number;values():Record<string,number>;invalidate():void;
 inputCount():number;setInput(index:number,id:string,hit?:VisualHit3|null):void;loadVertex(index:number):void;
 dragValue(name:string,delta:number,original:string|number,originalValue:number,step?:number):void;
 assertOpen():void;assertSource(document:CadDocument):void;evaluate():CadDocument;commit(document:CadDocument):CadEntity;cancel():void;
}
export const PROFILE_TYPES:readonly string[];
export const VISUAL_TOOLS:readonly VisualTool3[];
export function visualTool3(kind:string):VisualTool3;
export function inputAccepts3(kind:string,index:number,entity:CadEntity|undefined):boolean;
export function visibleFields3(session:VisualEditSession):VisualField3[];
export function visualHandles3(session:VisualEditSession,camera:Projection3,mode?:'dimensions'|'move'|'rotate'|'scale'):VisualHandle3[];
export function snapValue3(value:number,step?:number):number;
export function rayPlane3(ray:{origin:Vec3;direction:Vec3},origin:Point3,normal:Vec3):Vec3|null;
export function unitsPerPixel3(camera:Projection3,origin:Point3):number;
export function beginAxisDrag3(camera:Projection3,origin:Point3,axis:Vec3,pointer:Pointer2):AxisDrag3;
export function updateAxisDrag3(drag:AxisDrag3,pointer:Pointer2):number;
export function beginPlaneDrag3(camera:Projection3,origin:Point3,u:Vec3,v:Vec3,pointer:Pointer2):PlaneDrag3;
export function updatePlaneDrag3(drag:PlaneDrag3,pointer:Pointer2):{u:number;v:number};
export function beginAngleDrag3(camera:Projection3,origin:Point3,u:Vec3,v:Vec3,pointer:Pointer2):AngleDrag3;
export function updateAngleDrag3(drag:AngleDrag3,pointer:Pointer2):number;
export function expressionDelta3(original:string|number,delta:number,originalValue:number):string|number;
export function perpendicularAxes3(axis:Vec3):{u:Vec3;v:Vec3};

export interface ProjectedHandle3 {id:string;x:number;y:number;hasLabel?:boolean;hideLabel?:boolean;labelWidth?:number;labelHeight?:number;}
export function layoutHandles3(handles:ProjectedHandle3[],bounds:{width:number;height:number;top?:number;bottom?:number;active?:string|null;labels?:boolean}):Array<{id:string;visible:boolean;x?:number;y?:number;label:{x:number;y:number;w:number;h:number}|null}>;

export interface SpatialMeasurement3 {
    a: Vec3; b: Vec3; delta: Vec3; midpoint: Vec3;
    distance: number; horizontal: number; inclination: number;
}
/** World-space Euclidean distance and signed inclination in degrees; no document mutation. */
export function measurePoints3(first: Point3, second: Point3): SpatialMeasurement3;
/** Normalizes n·p = offset and returns an orthonormal finite plane guide. */
export function sectionFrame3(normal: Point3, offset: number, center?: Point3, span?: number): {
    normal: Vec3; offset: number; origin: Vec3; u: Vec3; v: Vec3; corners: Vec3[];
};

export interface PathCoordinate3 { x: string | number; y: string | number; z: string | number; }
export interface SpatialPathState {
    coordinates: PathCoordinate3[];
    /** Original vertex indices preserve native metadata across insertions and removals. Null denotes a new vertex. */
    origins: Array<number | null>;
    closed: boolean;
}
export class SpatialPathSession {
    constructor(document: CadDocument, options?: { id?: string | null; layer?: string });
    readonly source: CadDocument | null; readonly version: number; readonly base: CadDocument | null;
    readonly entity: CadEntity; readonly id: string; readonly creation: boolean; readonly changed: boolean;
    readonly state: SpatialPathState; readonly preview: CadDocument | null;
    readonly undoStack: SpatialPathState[]; readonly redoStack: SpatialPathState[];
    closed: boolean; revision: number; validatedRevision: number; error: string | null; evaluations: number;
    assertOpen(): void; invalidate(): void; validateState(state: SpatialPathState): void;
    snapshot(): SpatialPathState; restore(state: SpatialPathState): void;
    /** Cached immutable display coordinates; use session methods to invalidate. */
    points(): ReadonlyArray<Readonly<Vec3>>; readonly pointEvaluations: number; reverse(): void;
    set(index: number, axis: 'x' | 'y' | 'z', expression: number | string): void;
    insert(index: number, point: PathCoordinate3): void; remove(index: number): void; setClosed(value: boolean): void;
    checkpoint(before: SpatialPathState): void; undo(): boolean; redo(): boolean;
    drag(index: number, delta: Partial<Point3>, before: SpatialPathState): void;
    evaluate(): CadDocument; assertSource(document: CadDocument): void; commit(document: CadDocument): string; cancel(): void;
}
