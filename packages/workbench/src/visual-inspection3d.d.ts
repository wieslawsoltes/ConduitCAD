import type { Workbench } from './index.js';
import type { SpatialMeasurement3 } from '@conduitcad/manipulation3d';
export type InspectionMode3 = 'section' | 'measure' | 'appearance';
export class VisualInspection3D {
    constructor(modelingWorkbench: Workbench['model3d']);
    readonly active: boolean; mode: InspectionMode3 | null;
    readonly root: HTMLElement; valid: boolean; measurement: SpatialMeasurement3 | null;
    start(mode: InspectionMode3): void; update(immediate?: boolean): void;
    apply(): void; cancel(): void; cancelDrag(): void;
    createSection(): void; createGuide(): void; dispose(): void;
}
