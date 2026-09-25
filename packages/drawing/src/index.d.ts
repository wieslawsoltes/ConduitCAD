import type { Point } from '@conduitcad/geometry';
import type { CadEntity, CadDocument } from '@conduitcad/model';

export type DrawingToolId = 'arc' | 'arc-center' | 'circle-3p' | 'circle-diameter'
    | 'ellipse' | 'ellipse-arc' | 'spline' | 'bezier' | 'polygon' | 'donut'
    | 'solid' | 'face' | 'hatch' | 'wipeout' | 'point' | 'ray' | 'xline'
    | 'mtext' | 'leader' | 'dim-aligned' | 'dim-horizontal' | 'dim-vertical'
    | 'dim-radius' | 'dim-diameter' | 'dim-angular' | 'dim-angular-lines'
    | 'dim-ordinate-x' | 'dim-ordinate-y';
export interface DrawingTool {
    readonly id: DrawingToolId;
    readonly label: string;
    readonly group: string;
    readonly icon: string;
    readonly steps: readonly string[];
    /** null denotes a variable-length path completed explicitly with finish(). */
    readonly count: number | null;
    readonly minPoints: number;
    readonly maxPoints?: number;
    readonly canClose?: boolean;
    readonly drag?: boolean;
    readonly options?: boolean;
}
export interface DrawingOptions {
    sides?: number;
    circumscribed?: boolean;
    closed?: boolean;
    pattern?: 'solid' | 'lines' | 'cross';
    angle?: number;
    spacing?: number;
    height?: number;
    text?: string;
}
export const DRAWING_TOOLS: readonly DrawingTool[];
export function drawingTool(id: string): DrawingTool | null;
export function circumcircle(a: Point, b: Point, c: Point): { c: Point; r: number };
export function interpolatingSpline(points: readonly Point[], closed?: boolean, props?: Partial<CadEntity>): CadEntity;
export function validateBoundary(points: readonly Point[]): Point[];
export function hatchPattern(options?: DrawingOptions): {
    solid: boolean; pattern: 'SOLID' | 'USER'; patternType: number;
    patternAngle: number; patternScale: number; patternDouble: boolean; hatchStyle: number; associative: boolean;
    patternLines: Array<{angle: number; base: Point; offset: Point; dashes: number[]}>;
};
export function hatchFromEntities(entities: readonly CadEntity[], document: CadDocument,
    options?: DrawingOptions, props?: Partial<CadEntity>): CadEntity;
export function createDrawingEntity(tool: DrawingToolId, points: readonly Point[],
    options?: DrawingOptions, props?: Partial<CadEntity>, document?: CadDocument): CadEntity;
export function parseDrawingPoint(text: string, previous?: Point,
    evaluate?: (expression: string) => number): Point;
/** Failed completion does not consume the last point. The host owns commit/undo. */
export class DrawingSession {
    constructor(tool: DrawingToolId, options?: DrawingOptions);
    readonly tool: DrawingTool;
    options: DrawingOptions;
    readonly points: Point[];
    readonly prompt: string;
    readonly canFinish: boolean;
    add(point: Point, props?: Partial<CadEntity>, document?: CadDocument): CadEntity | null;
    finish(closed?: boolean, props?: Partial<CadEntity>, document?: CadDocument): CadEntity;
    undo(): Point | null;
    preview(point: Point, props?: Partial<CadEntity>, document?: CadDocument): CadEntity | null;
}
