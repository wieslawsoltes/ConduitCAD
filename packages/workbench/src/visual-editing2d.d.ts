import type { Workbench } from './index.js';
import type { CadEntity } from '@conduitcad/model';
import type { PlanarOperation, PlanarEditSession, Point2 } from '@conduitcad/manipulation2d';
export class VisualEditing2D {
    constructor(workbench: Workbench);
    readonly active: boolean; readonly enabled: boolean;
    session: PlanarEditSession | null; readonly root: HTMLElement; readonly context: HTMLElement;
    snap: boolean; step: number;
    start(operation?: PlanarOperation, options?: {create?: CadEntity | null; field?: string | null}): PlanarEditSession;
    beginText(point: Point2): PlanarEditSession;
    openEntry(name: string): void; acceptEntry(): boolean; abortEntry(): void;
    requestPreview(immediate?: boolean): void; apply(): void; cancel(reason?: string): void;
    cancelDrag(): void; sync(): void; updatePositions(): void; dispose(): void;
    panel: { palette(): void; exactPoint(): void; drawingOptions(): void; close(): void; readonly root: HTMLElement };
}
