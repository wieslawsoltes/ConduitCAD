import type { VisualEditSession, VisualHandle3, Pointer2 } from '@conduitcad/manipulation3d';
export interface VisualPointer3 extends Pointer2 { shift?: boolean; alt?: boolean; pointerType?: string; }
/** Canvas authoring controller; open tools do not mutate the document until Apply. */
export class VisualEditing3D {
    constructor(modeler: object);
    readonly active: boolean;
    readonly root: HTMLDivElement;
    readonly palette: HTMLElement;
    session: VisualEditSession | null;
    mode: 'dimensions' | 'move' | 'rotate' | 'scale';
    snap: boolean;
    step: number;
    handles: VisualHandle3[];
    picking: number | 'place' | null;
    start(kind: string, id?: string | null): void;
    openPalette(): void;
    closePalette(): void;
    openEntry(name: string): void;
    closeEntry(): void;
    openOptions(focusField?: string | null): void;
    closeOptions(): void;
    pickInput(index: number | 'place'): void;
    requestPreview(options?: {immediate?: boolean}): void;
    updatePositions(): void;
    pointerDown(pointer: VisualPointer3): boolean;
    pointerMove(pointer: VisualPointer3): boolean;
    pointerUp(pointer: VisualPointer3): boolean;
    cancelDrag(): void;
    historyStep(redo?: boolean): void;
    apply(): Promise<void>;
    cancel(message?: string): void;
    dispose(): void;
}
