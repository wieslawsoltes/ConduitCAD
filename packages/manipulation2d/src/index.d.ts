import type { CadDocument, CadEntity } from '@conduitcad/model';
export interface Point2 { x: number; y: number; }
export type PlanarOperation = 'geometry' | 'move' | 'rotate' | 'scale' | 'offset' | 'fillet';
export type PlanarValue = string | number | boolean;
export interface PlanarField {
    name: string; label: string; value: PlanarValue;
    type?: 'text' | 'choice' | 'number'; options?: readonly PlanarValue[];
    min?: number; max?: number; positive?: boolean; nonzero?: boolean; integer?: boolean;
    unit?: string; vertex?: number; definition?: string; readOnly?: boolean; driving?: boolean;
}
export interface PlanarHandle {
    id: string; label: string; point: Point2; fields: string[];
    kind: 'point' | 'axis' | 'angle' | 'line-start' | 'line-end' | 'dynamic';
    origin?: Point2; direction?: Point2; value?: number; radius?: number; factor?: number;
}
export interface PlanarEditOptions {
    operation?: PlanarOperation;
    create?: CadEntity | null;
    /** Solve, reroute and regenerate only the supplied preview, without modifying the source. */
    process?: ((preview: CadDocument, changedIds: ReadonlySet<string>) => void) | null;
}
export const PLANAR_TYPES: readonly string[];
export const PLANAR_OPERATIONS: readonly PlanarOperation[];
export function planarEditable(entity: CadEntity | undefined, document: CadDocument): string | null;
export function anchor2(entity: CadEntity): Point2;
export function fields2(entity: CadEntity, document: CadDocument): PlanarField[];
/** Applies all fields atomically to one eligible native entity. */
export function editFields2(entity: CadEntity, document: CadDocument, changes: Record<string, PlanarValue>): CadEntity;
export function sourceField2(entity: CadEntity, field: PlanarField): PlanarValue;
export function number2(source: string | number, document: CadDocument, field?: Partial<PlanarField>): number;
export function expressionDelta2(source: string | number, delta: number, originalValue: number): string | number;
export class PlanarEditSession {
    constructor(document: CadDocument, ids: string[], options?: PlanarEditOptions);
    source: CadDocument | null; base: CadDocument | null; preview: CadDocument | null;
    readonly operation: PlanarOperation; readonly version: number | undefined;
    readonly ids: string[]; resultIds: string[]; readonly creation: boolean;
    readonly pivot: Point2; readonly extent: number;
    parameters: Record<string, PlanarValue>; readonly initial: Record<string, PlanarValue>;
    readonly definitions: PlanarField[]; readonly changed: boolean;
    readonly undoStack: Array<Record<string, PlanarValue>>; readonly redoStack: Array<Record<string, PlanarValue>>;
    closed: boolean; revision: number; validatedRevision: number; error: string | null; evaluations: number;
    assertOpen(): void; field(name: string): PlanarField; value(name: string): PlanarValue;
    set(name: string, value: PlanarValue): void; invalidate(): void;
    snapshot(): Record<string, PlanarValue>; restore(state: Record<string, PlanarValue>): void;
    checkpoint(before?: Record<string, PlanarValue>): void; undo(): boolean; redo(): boolean;
    dragValue(name: string, targetValue: number, before: Record<string, PlanarValue>): void;
    evaluate(): CadDocument; commit(document: CadDocument): string[]; cancel(): void;
}
export function handles2(session: PlanarEditSession, pixelsPerUnit?: number): PlanarHandle[];
export function dragHandle2(session: PlanarEditSession, handle: PlanarHandle, delta: Point2, before: Record<string, PlanarValue>, options?: { step?: number; angleStep?: number }): void;

export interface ParameterDraftRow { id: string; name: string; expression: string; }
/** Isolated whole-design parameter draft. Regeneration belongs to the host process callback. */
export class ParameterEditSession {
    constructor(document: CadDocument, options?: { process?: ((draft: CadDocument) => void) | null });
    readonly source: CadDocument | null; readonly version: number; readonly base: CadDocument | null;
    readonly rows: ParameterDraftRow[]; readonly values: Record<string, number> | null;
    readonly preview: CadDocument | null; readonly changed: boolean;
    readonly undoStack: ParameterDraftRow[][]; readonly redoStack: ParameterDraftRow[][];
    closed: boolean; revision: number; validatedRevision: number; error: string | null; evaluations: number;
    assertOpen(): void; row(id: string): ParameterDraftRow;
    snapshot(): ParameterDraftRow[]; restore(rows: ParameterDraftRow[]): void;
    set(id: string, changes: Partial<Pick<ParameterDraftRow, 'name' | 'expression'>>): void;
    add(name?: string, expression?: number | string): string; remove(id: string): void;
    invalidate(): void; checkpoint(before: ParameterDraftRow[]): void; undo(): boolean; redo(): boolean;
    scrub(id: string, delta: number, originalValue: number, before: ParameterDraftRow[]): void;
    dependencies(id: string): string[]; parameterMap(): CadDocument['parameters'];
    evaluate(): CadDocument; assertSource(document: CadDocument): void; commit(document: CadDocument): void; cancel(): void;
}
