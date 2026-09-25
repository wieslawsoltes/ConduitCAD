export function beginDrawing(w: any, id: any): void;
export function commitDrawing(w: any, e: any): any;
export function acceptDrawingPoint(w: any, p: any): any;
export function drawingPointerUp(w: any, drag: any, end: any, moved: any): void;
export function drawingPreview(w: any, a: any, b: any): any;
export function updateDrawingControls(w: any): void;
export function finishDrawing(w: any, closed?: boolean): boolean;
export function drawingToolSections(w: any): string;
export function bindDrawingSearch(w: any): void;
export function drawingOptionsDialog(w: any, selected?: boolean): void;
export function drawingAction(w: any, id: any): boolean;
/** Commands with no arguments arm their point-driven tool; arguments use the same factories. */
export function drawingCommand(w: any, command: any, rest: any): boolean;
export function nativeGrips(e: any): any;
export function changeNativeGrip(e: any, g: any, q: any): boolean;
export function renderDrawingInspector(w: any, e: any, host: any): void;
export function nativePropertyChange(w: any, target: any): boolean;
