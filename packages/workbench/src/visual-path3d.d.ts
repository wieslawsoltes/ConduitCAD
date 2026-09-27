import type { Workbench } from './index.js';
import type { SpatialPathSession } from '@conduitcad/manipulation3d';
export class VisualPath3D {
    constructor(modeler: Workbench['model3d']);
    readonly active: boolean; readonly session: SpatialPathSession | null;
    readonly root: HTMLElement; readonly frame: number; selected: number;
    start(id?: string | null): SpatialPathSession; preview(immediate?: boolean): void;
    apply(): void; cancel(): void; cancelDrag(): void; beforeEdit(): void;
    externalChange(): void; keyDown(event: KeyboardEvent): boolean; dispose(): void;
}
