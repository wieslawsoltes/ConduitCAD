export function writeSVG(doc: any, { padding, background }?: {
    padding?: number;
    background?: string;
}): string;
export function renderPNG(doc: any, { width, padding, background }?: {
    width?: number;
    padding?: number;
    background?: string;
}): Promise<any>;
export function writeBOM(doc: any): string;
