import type {CadDocument} from '@conduitcad/model';
export type DXFPair = [number, string | number];
export type DXFVersion = 'AC1015' | 'AC1018' | 'AC1021' | 'AC1024' | 'AC1027' | 'AC1032';
export interface DXFParseOptions {
    name?: string;
    maxPairs?: number;
    /** Explicit browser TextDecoder encoding override for legacy source files. */
    encoding?: string;
    /** Wire DXF angles default to degrees. Opt in only for a known APP-radians producer. */
    mtextRotationUnit?: 'degrees' | 'radians';
}
export function aciColor(index: number): string;
export function parseAsciiPairs(source: string, options?: {maxPairs?: number}): DXFPair[];
export function parseBinaryPairs(input: Uint8Array | ArrayBuffer, options?: {maxPairs?: number}): DXFPair[];
export function parseDXF(input: string | Uint8Array | ArrayBuffer, options?: DXFParseOptions): CadDocument;
/** Normalized ASCII R2000-R2018 DXF, not a lossless rewrite of arbitrary source objects. */
export function writeDXF(doc: CadDocument, options?: {version?: DXFVersion; includeMetadata?: boolean}): string;
export function exportReport(doc: CadDocument): {format: string; unsupported: string[]; warnings: string[]; originalAvailable: boolean};
