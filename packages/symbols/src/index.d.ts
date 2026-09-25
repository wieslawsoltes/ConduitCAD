import type { CadDocument, CadEntity, Port } from '@conduitcad/model';
import type { Point, Bounds } from '@conduitcad/geometry';
export interface StandardReference { title: string; url: string; scope: string; }
export interface SymbolCategory { id: string; name: string; layer: string; medium: string; refs: string[]; description: string; }
export interface SymbolPort extends Port { medium: string; role: string; }
export interface SymbolProvenance {
    name: string; category: string; group: string; aliases: string[];
    standardRefs: string[]; geometryRevision: number; labelOffset: number;
    defaultLayer: string; convention: string; conformity: string; normativeEntry: string | null;
    review: { level: string; dimensionalConformance: string; note: string };
    normalState?: string; functionCode?: string; [key: string]: unknown;
}
export interface SymbolMaster { id: string; name: string; category: string; block: string; base: Point; entities: CadEntity[]; ports: SymbolPort[]; symbol: SymbolProvenance; }
export interface LineStyle { id: string; name: string; layer: string; color: string; width: number; dash: number[]; arrow: string; }
export interface TemplateNode { id: string; symbol: string; x: number; y: number; tag: string; rotation?: number; }
export interface TemplateConnection { from: string; to: string; style: string; label: string; waypoints: Point[]; }
export interface DrawingType {
    id: string; name: string; industry: string; drawingType: string; categories: string[];
    standardRefs: string[]; description: string; nodes: TemplateNode[];
    connections: TemplateConnection[]; defaultLineStyle: string;
}
export interface SymbolAudit {
    id: string; category: string; geometryRevision: number; primitives: Record<string, number>;
    bounds: Bounds; terminals: Record<string, number>; errors: string[]; warnings: string[];
}
export const SYMBOLS: SymbolMaster[];
export const CATEGORIES: SymbolCategory[];
export const STANDARD_REFERENCES: Record<string, StandardReference>;
export const DRAWING_TYPES: DrawingType[];
export const LINE_STYLES: LineStyle[];
/** Adds missing masters/layers without replacing existing saved or user-edited definitions. */
export function installSymbols<T extends CadDocument>(doc: T): T;
export function insertSymbol(doc: CadDocument, id: string, x: number, y: number, options?: Partial<CadEntity>): CadEntity;
export function createDemo(kind?: string): CadDocument;
export function createDrawing(type?: string): CadDocument;
export function searchSymbols(query?: string, options?: {category?: string; standard?: string; limit?: number}): SymbolMaster[];
export function auditSymbols(): SymbolAudit[];
export function auditSymbol(master: SymbolMaster, tolerance?: number): SymbolAudit;
export function symbolUpdates(doc: CadDocument): SymbolMaster[];
/** Explicit replacement; wrap in document history to make the migration undoable. Validates all IDs/terminal contracts before mutation. */
export function updateSymbolDefinitions(doc: CadDocument, ids: Iterable<string>): string[];
