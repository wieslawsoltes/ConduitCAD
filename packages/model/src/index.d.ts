import type { Point, Bounds, Matrix2D } from '@conduitcad/geometry';
export type Parameters = Record<string, number | string>;
export interface Layer {
    name: string;
    color: string;
    visible: boolean;
    locked: boolean;
    dash?: number[];
    linetype?: string;
}
export interface Port extends Point {
    name: string;
    dx: number;
    dy: number;
    entityId?: string;
}
export interface PortReference {
    entityId: string;
    port: string;
}
export interface Connector {
    from: PortReference | null;
    to: PortReference | null;
    style: string;
    arrow?: string;
    waypoints?: Point[];
    status?: string;
}
/** Extension fields hold supported entity-specific geometry and retained DXF data. */
export interface CadEntity {
    id: string;
    type: string;
    layer: string;
    layout?: string;
    color?: string;
    linetype?: string;
    width?: number;
    lineweight?: number;
    dash?: number[];
    hidden?: boolean;
    locked?: boolean;
    dirty?: boolean;
    connector?: Connector;
    parametric?: Record<string, string | number>;
    [key: string]: any;
}
export interface LineEntity extends CadEntity {
    type: 'LINE';
    a: Point;
    b: Point;
}
export interface PolylineEntity extends CadEntity {
    type: 'LWPOLYLINE';
    points: Point[];
    closed: boolean;
}
export interface CircleEntity extends CadEntity {
    type: 'CIRCLE';
    c: Point;
    r: number;
}
export interface TextEntity extends CadEntity {
    type: 'TEXT';
    p: Point;
    text: string;
    height: number;
    rotation: number;
}
export interface Block {
    name: string;
    base?: Point;
    entities: CadEntity[];
    ports?: Port[];
    symbol?: {
        name: string;
        category: string;
        labelOffset?: number;
        [key: string]: any;
    };
}
export interface Constraint {
    id?: string;
    type: string;
    entityId?: string;
    entities?: string[];
    value?: string | number;
    [key: string]: any;
}
export interface Diagnostic {
    severity: 'info' | 'warning' | 'error';
    message: string;
    type?: string;
    entityId?: string;
}
export interface CadDocument {
    schema: 'conduitcad/1';
    name: string;
    units: string;
    version: number;
    entities: CadEntity[];
    blocks: Record<string, Block>;
    layers: Layer[];
    linetypes: Record<string, number[]>;
    parameters: Parameters;
    constraints: Constraint[];
    metadata: Record<string, any>;
    activeLayout: string;
    layouts: string[];
    importDiagnostics: Diagnostic[];
    source?: {
        format: 'ascii' | 'binary';
        text?: string;
        base64?: string;
    };
    rawSections?: Record<string, Array<[
        number,
        string | number
    ]>>;
    importVersion?: string;
}
export interface RenderStyle {
    color: string;
    width: number;
    dash: number[];
    opacity: number;
}
export interface RenderPath extends RenderStyle {
    points: Point[];
    closed: boolean;
    fill?: string | null;
    entityId: string;
}
export interface RenderText {
    p: Point;
    text: string;
    height: number;
    rotation: number;
    align: string;
    color: string;
    entityId: string;
    font: string;
    widthFactor: number;
}
export interface EntityGeometry {
    paths: RenderPath[];
    texts: RenderText[];
}
export interface GeometryOptions {
    tolerance?: number;
    depth?: number;
    matrix?: Matrix2D;
    parentStyle?: RenderStyle;
    parentLayer?: Layer;
}
export function uid(prefix?: string): string;
/** JSON-safe deep copy; functions, prototype identity and undefined are not retained. */
export function clone<T>(value: T): T;
export function createDocument(name?: string): CadDocument;
export function validateDocument(document: unknown): CadDocument;
export function entity(type: string, props?: Record<string, any>): CadEntity;
export function line(a: Point, b: Point, props?: Record<string, any>): LineEntity;
export function polyline(points: Point[], closed?: boolean, props?: Record<string, any>): PolylineEntity;
export function circle(c: Point, r: number, props?: Record<string, any>): CircleEntity;
export function text(p: Point, value: string, height?: number, props?: Record<string, any>): TextEntity;
export function rect(x: number, y: number, w: number, h: number, props?: Record<string, any>): PolylineEntity;
export function layerFor(e: CadEntity, doc: CadDocument): Layer | undefined;
export function isVisible(e: CadEntity, doc: CadDocument): boolean;
export function isLocked(e: CadEntity, doc: CadDocument): boolean;
export function cleanText(value?: string): string;
export function resolveStyle(e: CadEntity, doc: CadDocument, parentStyle?: RenderStyle | null, parentLayer?: Layer | null): RenderStyle;
export function entityGeometry(e: CadEntity, doc: CadDocument, options?: GeometryOptions): EntityGeometry;
export function entityBounds(e: CadEntity, doc: CadDocument): Bounds;
export function documentBounds(doc: CadDocument): Bounds;
export function ports(e: CadEntity, doc: CadDocument): Port[];
export function moveEntity(e: CadEntity, dx: number, dy: number): void;
export function transformEntity(e: CadEntity, m: Matrix2D): void;
export function explodeEntity(e: CadEntity, doc: CadDocument): CadEntity[];
export function detachReferences(doc: CadDocument, deleted: Set<string>): void;
