/** Right-handed double-precision planar geometry; angles are radians unless noted. */
export interface Point {
    x: number;
    y: number;
    z?: number;
    bulge?: number;
}
export interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
export type Matrix2D = [
    number,
    number,
    number,
    number,
    number,
    number
];
export interface TransformOptions {
    x?: number;
    y?: number;
    rotation?: number;
    sx?: number;
    sy?: number;
}
export interface SplineGeometry {
    degree?: number;
    controlPoints: Point[];
    knots?: number[];
    weights?: number[];
    closed?: boolean;
}
export interface ArcGeometry {
    c: Point;
    r: number;
    start: number;
    sweep: number;
    clockwise: boolean;
}
export interface SnapPoint extends Point {
    kind: 'endpoint' | 'midpoint' | 'center' | 'quadrant' | 'insertion';
}
export const EPS: number;
export const TAU: number;
export function clamp(v: number, a: number, b: number): number;
export function point(x?: number, y?: number): Point;
export function add(a: Point, b: Point): Point;
export function sub(a: Point, b: Point): Point;
export function mul(a: Point, s: number): Point;
export function dot(a: Point, b: Point): number;
export function cross(a: Point, b: Point): number;
export function length(a: Point): number;
export function distance(a: Point, b: Point): number;
export function normalize(a: Point): Point;
export function lerp(a: Point, b: Point, t: number): Point;
export function almost(a: number, b: number, tolerance?: number): boolean;
export function equalPoint(a: Point, b: Point, tolerance?: number): boolean;
export function identity(): Matrix2D;
export function transform(p: Point, m: Matrix2D): Point;
/** Rotation is measured in degrees. */
export function matrix(options?: TransformOptions): Matrix2D;
export function compose(a: Matrix2D, b: Matrix2D): Matrix2D;
export function inverse(m: Matrix2D): Matrix2D;
export function bounds(points: Iterable<Point>): Bounds;
export function emptyBounds(): Bounds;
export function validBounds(b: Bounds): boolean;
export function inflate(b: Bounds, n: number): Bounds;
export function intersects(a: Bounds, b: Bounds): boolean;
export function contains(b: Bounds, p: Point): boolean;
export function union(a: Bounds, b: Bounds): Bounds;
export function center(b: Bounds): Point;
export function projectPoint(p: Point, a: Point, b: Point, segment?: boolean): Point;
export function distanceToSegment(p: Point, a: Point, b: Point): number;
export function lineIntersection(a: Point, b: Point, c: Point, d: Point, segments?: boolean): (Point & {
    t: number;
    u: number;
}) | null;
export function segmentIntersectsBox(a: Point, b: Point, box: Bounds): boolean;
export function polygonContains(p: Point, points: Point[]): boolean;
export function polygonArea(points: Point[]): number;
export function polylineLength(points: Point[], closed?: boolean): number;
export function simplifyOrthogonal(points: Point[]): Point[];
export function arcPoints(c: Point, r: number, start?: number, end?: number, tolerance?: number, clockwise?: boolean): Point[];
export function bulgeArc(a: Point, b: Point, bulge: number): ArcGeometry | null;
export function tessellatePolyline(points: Point[], closed?: boolean, tolerance?: number): Point[];
export function nurbsPoint(control: Point[], degree: number, knots: number[], t: number, weights?: number[]): Point;
export function splinePoints(e: SplineGeometry, tolerance?: number): Point[];
export function offsetPolyline(points: Point[], amount: number, closed?: boolean, miterLimit?: number): Point[];
export function filletLines(a: Point, b: Point, c: Point, d: Point, radius: number): {
    p: Point;
    q: Point;
    c: Point;
    r: number;
    start: number;
    end: number;
    clockwise: boolean;
};
export function snapCandidates(entity: {
    type: string;
    [key: string]: any;
}): SnapPoint[];
