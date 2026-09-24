/** XY projection of Autodesk's arbitrary-axis OCS basis. */
export function ocsTransform(normal?: {
    x: number;
    y: number;
    z: number;
}, elevation?: number): number[];
export function ellipseEdgePoints(edge: any, tolerance?: number): {
    x: number;
    y: any;
}[];
export function hatchContours(e: any, tolerance?: number): any;
export function inPolygon(p: any, polygon: any): boolean;
export function hatchRegionContours(e: any, tolerance: any): any;
/** Scanline hatch clipping with half-open crossings and parity across islands.
 * Definitions are already transformed by the DXF producer: do not apply scale twice.
 */
export function hatchPatternSegments(e: any, contours: any, { maxLines, maxSegments }?: {
    maxLines?: number;
    maxSegments?: number;
}): {
    segments: any[];
    limited: boolean;
};
/** Variable width arc/polyline ribbons, retaining original analytic model data. */
export function widePolylineContours(e: any, tolerance?: number): {
    x: number;
    y: number;
}[][];
export function signedDashPattern(pattern?: any[]): number[];
/** Bounded, no-eval MTEXT formatting lexer with group-local formatting state. */
export function cadTextRuns(value: any, initial?: {}): {
    scale: number;
    width: number;
    underline: boolean;
    overline: boolean;
    text: string;
}[];
/** Deterministic text layout; canvas may supply measured glyph advances. */
export function layoutCadText(t: any, measure: any): {
    lines: {
        runs: any[];
        width: number;
        height: any;
    }[];
    width: any;
    height: any;
    minX: number;
    minY: number;
    maxX: any;
    maxY: number;
};
