import type {CadDocument} from '@conduitcad/model';
/** Int64 values use decimal strings to avoid precision loss. */
export type DXFPair = [number, string | number];
export type DXFVersion = 'AC1015' | 'AC1018' | 'AC1021' | 'AC1024' | 'AC1027' | 'AC1032';
export interface DXFParseOptions {
    name?: string;
    maxPairs?: number;
    /** Explicit WHATWG TextDecoder encoding override for legacy source files. */
    encoding?: string;
    mtextRotationUnit?: 'degrees' | 'radians';
}
export interface DXFWriteOptions {
    /** Normalized output supports R2000–R2018; preserve mode requires the input version. */
    version?: DXFVersion | 'AC1009' | 'AC1012' | 'AC1014';
    includeMetadata?: boolean;
    /** Preserve retains source records but rejects structural or dependency-sensitive edits. */
    mode?: 'normalized' | 'preserve';
    /** Fail normalized export when the report contains known data-loss warnings. */
    strict?: boolean;
}
export interface DXFReference {code: number; target: string; index: number}
export interface DXFObjectNode {handle: string; type: string; section: string; references: DXFReference[]; tags: DXFPair[]}
export interface DXFObjectGraph {
    nodes: DXFObjectNode[];
    diagnostics: Array<{severity: 'error' | 'warning'; message: string; code?: number}>;
}
export interface DXFExportReport {
    format: string;
    unsupported: Array<{id: string; type: string}>;
    warnings: string[];
    originalAvailable: boolean;
    preservationAvailable: boolean;
}
export function aciColor(index: number): string;
export function parseAsciiPairs(source: string, options?: {maxPairs?: number}): DXFPair[];
export function parseBinaryPairs(input: Uint8Array | ArrayBuffer, options?: {maxPairs?: number; encoding?: string; r12?: boolean}): DXFPair[];
export function parseDXF(input: string | Uint8Array | ArrayBuffer, options?: DXFParseOptions): CadDocument;
export function writeDXF(doc: CadDocument, options?: DXFWriteOptions): string;
export function writeDXFBinary(doc: CadDocument, options?: DXFWriteOptions): Uint8Array;
/** Source database inspection, not a semantic evaluator for arbitrary vendor classes. */
export function inspectObjectGraph(doc: CadDocument): DXFObjectGraph;
export function exportReport(doc: CadDocument): DXFExportReport;
