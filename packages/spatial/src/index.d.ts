/** Packed bounding-volume hierarchy with a bounded incremental-update overlay. */
export class SpatialIndex {
    constructor(items?: any[], leafSize?: number);
    leafSize: number;
    load(items: any): this;
    size: any;
    root: any;
    items: any;
    positions: Map<any, any>;
    overrides: Map<any, any>;
    build(items: any, depth: any): any;
    update(items: any): this;
    search(box: any): any[];
}
