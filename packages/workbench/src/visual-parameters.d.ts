import type { Workbench } from './index.js';
import type { ParameterEditSession } from '@conduitcad/manipulation2d';
export class VisualParameters {
    constructor(workbench: Workbench);
    readonly active: boolean; readonly session: ParameterEditSession | null;
    readonly root: HTMLElement; readonly frame: number;
    start(): ParameterEditSession; requestPreview(immediate?: boolean): void;
    apply(): void; cancel(): void; cancelDrag(): void; beforeEdit(): void;
    externalChange(): void; keyDown(event: KeyboardEvent): boolean; dispose(): void;
}
