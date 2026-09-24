export function colorRGBA(hex: any, alpha?: number): number[];
export function buildScene(doc: any, { tolerance, origin }?: {
    tolerance?: number;
    origin?: any;
}): {
    paths: import("@conduitcad/model").RenderPath[];
    texts: import("@conduitcad/model").RenderText[];
    items: {
        id: any;
        entity: any;
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    }[];
    spans: Map<any, any>;
    entities: Map<any, any>;
    index: SpatialIndex;
    bounds: import("@conduitcad/geometry").Bounds;
    origin: any;
    data: Float32Array;
    count: number;
    buildMs: number;
};
/** Patch equal-topology edits in place. A null result requests a full rebuild. */
export function updateSceneEntities(scene: any, doc: any, ids: any, { tolerance }?: {
    tolerance?: number;
}): {
    offset: any;
    count: any;
}[] | null;
export function drawPath(ctx: any, path: any, camera: any, override?: {}): void;
export function drawText(ctx: any, t: any, camera: any): void;
export class Camera {
    x: number;
    y: number;
    scale: number;
    width: number;
    height: number;
    world(p: any): {
        x: number;
        y: number;
    };
    screen(p: any): {
        x: number;
        y: number;
    };
    zoom(factor: any, anchor?: {
        x: number;
        y: number;
    }): void;
    pan(dx: any, dy: any): void;
    fit(b: any, padding?: number): void;
    get viewport(): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };
}
export const CULL_SHADER: string;
export const LINE_SHADER: string;
/** Retained CAD renderer. Geometry uploads only after document/tessellation changes. */
export class CadRenderer {
    constructor(host: any, { camera, backend, onStatus }?: {
        camera?: Camera;
        backend?: string;
        onStatus?: (status: {
            backend: string;
            message: string;
        }) => void;
    });
    host: any;
    camera: Camera;
    preferred: string;
    onStatus: (status: {
        backend: string;
        message: string;
    }) => void;
    dpr: number;
    grid: boolean;
    rulers: boolean;
    disposed: boolean;
    stats: {
        backend: string;
        frameMs: number;
        buildMs: number;
        segments: number;
        entities: number;
        draws: number;
    };
    background: HTMLCanvasElement;
    canvas: HTMLCanvasElement;
    overlay: HTMLCanvasElement;
    bg: CanvasRenderingContext2D;
    ctx: CanvasRenderingContext2D;
    resizeObserver: ResizeObserver;
    ready: Promise<void>;
    initialize(skipGPU?: boolean, skipGL?: boolean): Promise<void>;
    engine: GPUBackend | GLBackend | CanvasBackend;
    recover(message: any, backend: any): void;
    recovering: boolean;
    resize(): void;
    setDocument(doc: any): void;
    doc: any;
    sceneDirty: boolean;
    updateEntities(ids: any): void;
    invalidate(): void;
    pending: boolean;
    render(): void;
    lod: number;
    scene: {
        paths: import("@conduitcad/model").RenderPath[];
        texts: import("@conduitcad/model").RenderText[];
        items: {
            id: any;
            entity: any;
            minX: number;
            minY: number;
            maxX: number;
            maxY: number;
        }[];
        spans: Map<any, any>;
        entities: Map<any, any>;
        index: SpatialIndex;
        bounds: import("@conduitcad/geometry").Bounds;
        origin: any;
        data: Float32Array;
        count: number;
        buildMs: number;
    };
    drawBackground(): void;
    gridStep: number;
    fit(): void;
    dispose(): void;
}
import { SpatialIndex } from '@conduitcad/spatial';
declare class GPUBackend {
    constructor(canvas: any, onLost: any);
    canvas: any;
    onLost: any;
    batches: any[];
    name: string;
    init(): Promise<this>;
    device: any;
    format: any;
    compute: any;
    render: any;
    context: any;
    upload(scene: any): void;
    scene: any;
    update(scene: any, ranges: any): void;
    draw(camera: any, ratio: any): void;
    clear(): void;
    dispose(): void;
    disposed: boolean;
}
declare class GLBackend {
    constructor(canvas: any, onLost: any);
    canvas: any;
    name: string;
    onLost: any;
    init(): Promise<this>;
    gl: any;
    program: any;
    vao: any;
    buffer: any;
    uniforms: {
        [k: string]: any;
    };
    upload(scene: any): void;
    scene: any;
    update(scene: any, ranges: any): void;
    draw(camera: any): void;
    dispose(): void;
    disposed: boolean;
}
declare class CanvasBackend {
    constructor(canvas: any);
    canvas: any;
    name: string;
    init(): Promise<this>;
    ctx: any;
    upload(scene: any): void;
    scene: any;
    draw(camera: any, ratio: any): void;
    dispose(): void;
}
export {};
