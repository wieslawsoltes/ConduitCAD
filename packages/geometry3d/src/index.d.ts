export interface Vec3 { x: number; y: number; z: number; }
export type Point3 = { x: number; y: number; z?: number };
export type Mat4 = number[];
export interface Mesh { points: Point3[]; faces: number[][]; }
export interface Bounds3 { min: Vec3; max: Vec3; empty: boolean; }
export interface MeshProperties { vertices: number; faces: number; edges: number; triangles: number; area: number; volume: number|null; signedVolume: number; centroid: Vec3|null; bounds: Bounds3; closed: boolean; boundaryEdges: number; nonManifoldEdges: number; }
export function V3(x?:number,y?:number,z?:number): Vec3;
export function add3(a:Point3,b:Point3):Vec3;
export function sub3(a:Point3,b:Point3):Vec3;
export function mul3(a:Point3,s:number):Vec3;
export function dot3(a:Point3,b:Point3):number;
export function cross3(a:Point3,b:Point3):Vec3;
export function length3(a:Point3):number;
export function distance3(a:Point3,b:Point3):number;
export function unit3(a:Point3):Vec3;
export function finite3(a:Point3):Vec3;
export function lerp3(a:Point3,b:Point3,t:number):Vec3;
export function identity4():Mat4;
export function multiply4(a:Mat4,b:Mat4):Mat4;
export function translation3(x?:number,y?:number,z?:number):Mat4;
export function scaling3(x?:number,y?:number,z?:number):Mat4;
export function rotation3(axis:Point3,angle:number):Mat4;
export function transform3(point:Point3,matrix:Mat4):Vec3;
export function ocs3(normal?:Point3):Mat4;
export function bounds3(points:Point3[]):Bounds3;
export function faceNormal(points:Point3[],face:number[]):Vec3;
export function validateMesh<T extends Mesh>(mesh:T,options?:{maxVertices?:number;maxFaces?:number}):T;
export function triangulateFace(points:Point3[],face:number[]):number[][];
export function triangles3(mesh:Mesh):number[][];
export function transformMesh(mesh:Mesh,matrix:Mat4):Mesh;
export function mergeMeshes(meshes:Mesh[]):Mesh;
export function meshProperties(mesh:Mesh):MeshProperties;
export function segments3(count?:number):number;
export function boxMesh(width?:number,depth?:number,height?:number):Mesh;
export function cylinderMesh(radius?:number,height?:number,segments?:number,topRadius?:number):Mesh;
export function sphereMesh(radius?:number,segments?:number):Mesh;
export function torusMesh(major?:number,minor?:number,segments?:number,tubeSegments?:number):Mesh;
export function extrudeMesh(profile:Point3[],height?:number,direction?:Point3,taper?:number):Mesh;
export function revolveMesh(profile:Point3[],angle?:number,segments?:number):Mesh;
export function loftMesh(sections:Point3[][],options?:{closed?:boolean}):Mesh;
export function sweepMesh(profile:Point3[],path:Point3[]):Mesh;
export function booleanMesh(left:Mesh,right:Mesh,operation?:'union'|'subtract'|'intersect'):Mesh;
export function sliceMesh(mesh:Mesh,normal?:Point3,offset?:number):Point3[][];
export function rayTriangle(origin:Point3,direction:Point3,a:Point3,b:Point3,c:Point3):{distance:number;point:Vec3;u:number;v:number}|null;
export function spline3(spline:{controlPoints:Point3[];degree?:number;knots:number[];weights?:number[]},steps?:number):Vec3[];
