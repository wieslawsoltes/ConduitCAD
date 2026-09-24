/** Atomic serializable transactions with bounded undo memory and redo invalidation. */
export class History {
    constructor({ capture, restore, onChange, limit, maxBytes }: {
        capture: any;
        restore: any;
        onChange?: () => void;
        limit?: number;
        maxBytes?: number;
    });
    capture: any;
    restore: any;
    onChange: () => void;
    limit: number;
    maxBytes: number;
    undoStack: any[];
    redoStack: any[];
    pending: {
        label: string;
        before: string;
    };
    begin(label?: string): void;
    commit(): boolean;
    cancel(): void;
    run(label: any, action: any): any;
    undo(): boolean;
    redo(): boolean;
    clear(): void;
    get canUndo(): boolean;
    get canRedo(): boolean;
}
