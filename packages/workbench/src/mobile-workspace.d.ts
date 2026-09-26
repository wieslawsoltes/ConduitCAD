export const MOBILE_MEDIA: string;
export function mobileViewportMetrics(input: { width: number; height: number; visualHeight?: number; visualTop?: number; scale?: number; focused?: boolean; baselineHeight?: number }): { width: number; height: number; top: number; keyboard: boolean };
export function bindMobileWorkspace(w: any): void;
export function updateMobilePanels(w: any, focusName?: string | null): void;
export function prepareMobileDialog(w: any, backdrop: HTMLElement): () => void;
