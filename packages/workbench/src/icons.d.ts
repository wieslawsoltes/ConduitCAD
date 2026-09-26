import type { IconName } from '@conduitcad/icons';
export declare function icon(name: string, cls?: string): string;
export declare function escapeHTML(value: unknown): string;
export declare function toolIcon(name: string, fallback?: string): string;
export declare function entityIcon(entity: {type?: string; feature3d?: {kind: string}}): string;
export declare function commandContent(action: string, label: string, glyph?: IconName | string): string;
export declare function commandButton(action: string, label: string, cls?: string, extra?: string, glyph?: IconName | string): string;
export declare function setCommandLabel(button: HTMLButtonElement | null, label: string, glyph?: string): void;
