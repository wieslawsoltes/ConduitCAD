import type { Workbench } from './index.js';
export type IconLabelMode = 'auto' | 'labels' | 'compact';
export interface IconographyController {
    readonly mode: IconLabelMode;
    prepare(host: Element | null): void;
    setMode(mode: IconLabelMode): void;
    guide(): void;
    hide(): void;
    dispose(): void;
}
export declare function decorateIconography(host: Element | null): void;
export declare function iconPreferencesMarkup(): string;
export declare function bindIconography(workbench: Workbench): IconographyController;
