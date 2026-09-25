import type { Point, Bounds, Matrix2D } from '@conduitcad/geometry';
export type Parameters = Record<string, number | string>;
export interface Layer {
    name: string;
    color: string;
    visible: boolean;
    locked: boolean;
    dash?: number[];
    linetype?: string;
    lineweight?: number;
    colorIndex?: number;
    colorMode?: string;
}
export interface Port extends Point {
    name: string;
    dx: number;
    dy: number;
    entityId?: string;
    /** Semantic medium/function; diagrams do not imply simulation or sizing. */
    medium?: string;
    role?: string;
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
    linetypeScale?: number;
    opacity?: number;
    transparency?: number | null;
    extrusion?: Point3D;
    colorIndex?: number;
    colorMode?: string;
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
    signedLinetypes?: boolean;
    linetypeScale?: number;
    textStyles?: Record<string, {font?: string; widthFactor?: number; oblique?: number; [key: string]: unknown}>;
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
    insunits?: number;
    dimstyles?: Record<string, Record<string, number | string>>;
    layoutSettings?: Record<string, {tabOrder?: number; paperWidth?: number; paperHeight?: number; paperUnits?: number; rotation?: number}>;
    _dxfPreservation?: unknown;
}
export interface RenderStyle {
    color: string;
    width: number;
    dash: number[];
    opacity: number;
}
export interface RenderPath extends RenderStyle {
    clips?: Point[][];
    points: Point[];
    closed: boolean;
    fill?: string | null;
    contours?: Point[][];
    fillRule?: CanvasFillRule;
    stroke?: boolean;
    dashPhase?: number;
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
    frame?: [number, number, number, number];
    rawText?: string;
    nominalHeight?: number;
    mtext?: boolean;
    mtextWidth?: number;
    attachment?: number;
    valign?: number;
    lineSpacing?: number;
    lineSpacingStyle?: number;
    backgroundFill?: number;
    backgroundScale?: number;
    backgroundColor?: string;
    opacity?: number;
}
export interface EntityGeometry {
    paths: RenderPath[];
    texts: RenderText[];
    warnings?: Array<{entityId?: string; message: string}>;
}
export interface GeometryOptions {
    view?: Bounds;
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

/** Native DXF coordinate values; viewing projects into the document XY plane. */
export interface Point3D extends Point { z: number; }
export interface HatchVertex extends Point { bulge?: number; }
export type HatchEdge =
    | {type: 1; a: Point; b: Point}
    | {type: 2; c: Point; r: number; start: number; end: number; ccw: boolean}
    | {type: 3; c: Point; major: Point; ratio: number; start: number; end: number; ccw: boolean}
    | {type: 4; degree: number; rational?: boolean; periodic?: boolean; knots: number[]; controlPoints: Point[]; weights?: number[]; fitPoints?: Point[]; startTangent?: Point; endTangent?: Point};
export interface HatchBoundary {flags?: number; closed?: boolean; points?: HatchVertex[]; edges?: HatchEdge[]; sourceHandles?: string[];}
export interface HatchPatternLine {angle: number; base: Point; offset: Point; dashes: number[];}
/** Edge angles and pattern-line angles use radians; patternAngle uses DXF degrees. */
export interface HatchEntity extends CadEntity {
    type: 'HATCH'; solid: boolean; loops: HatchBoundary[]; hatchStyle?: 0 | 1 | 2;
    pattern?: string; patternType?: number; patternAngle?: number; patternScale?: number;
    patternDouble?: boolean; patternLines?: HatchPatternLine[]; elevation?: number; associative?: boolean;
    gradient?: Array<[number, number | string]> | null;
}
export interface TextRunStyle {scale: number; width: number; font?: string; color?: string; bold?: boolean; italic?: boolean; underline?: boolean; overline?: boolean; strike?: boolean; oblique?: number;}
export interface TextLayoutRun extends TextRunStyle {text: string; x: number; y: number; height: number;}
export interface CadTextLayout extends Bounds {width: number; height: number; lines: Array<{runs: TextLayoutRun[]; width: number; height: number; y: number}>;}
export type TextLayoutInput = Partial<RenderText> & {text: string};
/** Advances returned by measure exclude run width scaling; the layout applies it. */
export function textLayout(text: TextLayoutInput, measure?: (text: string, height: number, style: TextRunStyle) => number): CadTextLayout;
export function objectCoordinateTransform(normal?: Point3D, elevation?: number): Matrix2D;

export interface DimensionEntity extends CadEntity {
    type: 'DIMENSION'; dimtype?: number; dimstyle?: string; block?: string;
    definitionPoint?: Point3D; textMidpoint?: Point3D; dimensionInsert?: Point3D;
    a?: Point3D; b?: Point3D; defpoint4?: Point3D; defpoint5?: Point3D;
    dimensionAngle?: number; measurement?: number;
}
export interface ViewportEntity extends CadEntity {
    type: 'VIEWPORT'; c: Point3D; viewportWidth: number; viewportHeight: number; viewHeight: number;
    viewportId?: number; viewportStatus?: number; viewportFlags?: number;
    viewCenter?: Point3D; viewTarget?: Point3D; viewDirection?: Point3D; viewTwist?: number;
    frozenLayers?: string[]; clipHandle?: string;
}
export interface MeshEntity extends CadEntity {
    type: 'MESH'; points: Point3D[]; faces: number[][]; edges?: [number, number][]; creases?: number[]; subdivision?: number;
}
export interface WipeoutEntity extends CadEntity {
    type: 'WIPEOUT'; p: Point3D; uPixel: Point3D; vPixel: Point3D; imageSize: Point;
    boundary: Point[]; boundaryType?: 1 | 2; clipping?: boolean;
}

/** Declarative, versioned Conduit behaviors; not Autodesk evaluation-graph execution. */
export type DynamicValue = number | string | boolean;
export interface DynamicGrip { base?: Point; direction?: Point; radius?: number; }
export type DynamicParameter =
    | {name: string; label?: string; type: 'number' | 'distance' | 'angle' | 'integer'; default: number; min?: number; max?: number; values?: number[]; grip?: DynamicGrip}
    | {name: string; label?: string; type: 'boolean'; default: boolean}
    | {name: string; label?: string; type: 'enum'; default: string | number; values: Array<string | number>};
export type DynamicAction = {parameter: string; entities?: string[]; ports?: string[]} & (
    | {type: 'move'; direction?: Point}
    | {type: 'stretch'; box: Bounds; direction?: Point}
    | {type: 'rotate' | 'scale'; base?: Point}
    | {type: 'flip'; base?: Point; direction?: Point}
    | {type: 'array'; step?: Point}
    | {type: 'visibility'; states: Record<string, string[]>}
    | {type: 'lookup'; rows: Record<string, Record<string, DynamicValue>>}
);
export interface DynamicDefinition {version: 1; parameters: DynamicParameter[]; actions: DynamicAction[];}
export interface Block {dynamic?: DynamicDefinition; dynamicInstance?: {master: string; values: Record<string, DynamicValue>};}
export interface EvaluatedBlock extends Block {dynamicValues: Record<string, DynamicValue>;}
export interface CadEntity {dynamicParameters?: Record<string, DynamicValue>; dynamicSource?: string; dimension?: DimensionState;}
export function validateDynamicBlock(block: Block): Block;
export function dynamicValues(block: Block, values?: Record<string, DynamicValue>): Record<string, DynamicValue>;
/** Starts from the pristine master. Throws before mutation on invalid actions or budgets. */
export function evaluateDynamicBlock(block: Block, values?: Record<string, DynamicValue>, options?: {maxEntities?: number}): EvaluatedBlock;
export function setDynamicParameters(instance: CadEntity, document: CadDocument, values: Record<string, DynamicValue>): EvaluatedBlock;
export function dynamicParameterGrips(instance: CadEntity, document: CadDocument): Array<Point & {key: string}>;
export function dynamicGripValue(instance: CadEntity, document: CadDocument, parameter: string, world: Point): number;

export interface DimensionStyle {
    dimtxt?: number; dimasz?: number; dimexe?: number; dimexo?: number; dimgap?: number;
    dimscale?: number; dimlfac?: number; dimdec?: number; dimrnd?: number;
    dimpost?: string; dimzin?: number; dimdsep?: number;
}
export type DimensionPointKey = 'a' | 'b' | 'definitionPoint' | 'defpoint4' | 'defpoint5' | 'textMidpoint';
export type DimensionPointReference = {entityId: string} & (
    | {point: 'a' | 'b' | 'c' | 'p'}
    | {point: 'vertex'; index: number}
    | {point: 'circle'; angle?: number}
);
export interface DimensionState {
    version: 1; manualText?: boolean; style?: DimensionStyle; resolvedScale?: number;
    references?: Partial<Record<DimensionPointKey, DimensionPointReference>>;
}
export type DimensionEdit = Partial<Record<DimensionPointKey, Point>> & {
    style?: DimensionStyle; offset?: number; text?: string; textRotation?: number;
    dimensionAngle?: number; leaderLength?: number; dimstyle?: string; dimtype?: number; manualText?: boolean;
};
export interface DimensionPicture {
    entities: CadEntity[]; measurement: number; definitionPoint?: Point; textMidpoint: Point;
    style: Required<Omit<DimensionStyle, 'dimdsep'>> & {dimdsep?: number};
}
/** Planar decimal evaluator for native subtypes 0–6; angles are DXF degrees. */
export function dimensionPicture(dimension: CadEntity, document: Pick<CadDocument, 'dimstyles'>): DimensionPicture;
/** Atomic explicit opt-in: removes a stale picture only after the new picture validates. */
export function editDimension<T extends CadEntity>(dimension: T, document: Pick<CadDocument, 'dimstyles'>, patch?: DimensionEdit): T;
export function dimensionGrips(dimension: CadEntity, document: Pick<CadDocument, 'dimstyles'>): Array<Point & {key: string}>;
/** Resolve authored witness-point associations atomically. Returns changed dimension IDs. */
export function regenerateDimensions(document: CadDocument): string[];
export interface LinearGradientPaint {kind: 'linear'; start: Point; end: Point; frame: Matrix2D; colors: [string, string];}
export interface RenderPath {gradient?: LinearGradientPaint | null;}
