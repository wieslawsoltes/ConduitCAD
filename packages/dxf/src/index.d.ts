export function aciColor(index: any): string;
export function parseAsciiPairs(source: any, { maxPairs }?: {
    maxPairs?: number;
}): any[][];
export function parseBinaryPairs(input: any, { maxPairs }?: {
    maxPairs?: number;
}): (string | number)[][];
export function parseDXF(input: any, options?: {}): import("@conduitcad/model").CadDocument;
/** Normalized AC1024 / R2010 ASCII DXF. The project format preserves full app semantics. */
export function writeDXF(doc: any, { version, includeMetadata }?: {
    version?: string;
    includeMetadata?: boolean;
}): string;
export function exportReport(doc: any): {
    format: string;
    unsupported: any;
    warnings: string[];
    originalAvailable: boolean;
};
