export interface WorkspaceDocument { name?: string; entities: unknown[]; }
export interface WorkspaceSnapshot<T extends WorkspaceDocument = WorkspaceDocument> { document: T; state?: unknown; }
export interface WorkspaceRecord<T extends WorkspaceDocument = WorkspaceDocument> extends WorkspaceSnapshot<T> { id: string; }
export interface WorkspaceManifest { version: 1; activeId: string | null; ids: string[]; }
export interface WorkspaceStore<T extends WorkspaceDocument = WorkspaceDocument> {
    saveWorkspace(records: WorkspaceRecord<T>[], manifest: WorkspaceManifest, key?: string): Promise<void>;
}
export interface DocumentSession<T extends WorkspaceDocument = WorkspaceDocument> {
    id: string;
    document: T;
    context: Record<string, any>;
    revision: number;
    savedRevision: number;
    saving: boolean;
    savedAt: string | null;
    error: Error | null;
}
export interface WorkspaceEvent<T extends WorkspaceDocument = WorkspaceDocument> {
    type: 'open' | 'activate' | 'change' | 'close' | 'reorder' | 'saving' | 'saved' | 'error';
    session?: DocumentSession<T>;
    error?: Error | null;
}
export class DocumentWorkspace<T extends WorkspaceDocument = WorkspaceDocument> {
    constructor(options?: {
        store?: WorkspaceStore<T>;
        key?: string;
        capture?: (session: DocumentSession<T>) => WorkspaceSnapshot<T>;
        beforeSave?: () => void;
        onChange?: (event: WorkspaceEvent<T>) => void;
        maxDocuments?: number;
        debounce?: number;
    });
    store?: WorkspaceStore<T>;
    key: string;
    capture: (session: DocumentSession<T>) => WorkspaceSnapshot<T>;
    beforeSave: () => void;
    onChange: (event: WorkspaceEvent<T>) => void;
    maxDocuments: number;
    debounce: number;
    sessions: DocumentSession<T>[];
    activeId: string | null;
    queue: Promise<unknown>;
    disposed: boolean;
    error: Error | null;
    readonly active: DocumentSession<T> | null;
    readonly dirty: boolean;
    get(id: string): DocumentSession<T> | null;
    add(document: T, options?: { id?: string; context?: Record<string, any>; saved?: boolean; activate?: boolean }): DocumentSession<T>;
    activate(id: string): DocumentSession<T>;
    markChanged(id?: string | null): void;
    remove(id: string, options?: { discard?: boolean }): boolean;
    move(id: string, index: number): void;
    schedule(): void;
    saveAll(): Promise<WorkspaceManifest>;
    flush(): Promise<WorkspaceManifest>;
    dispose(): void;
}
export function mergeClipboardBlocks<T extends { block?: string }>(destination: Record<string, any>, source: Record<string, any>, entities: T[]): {
    blocks: Record<string, any>;
    entities: T[];
    names: Map<string, string>;
};
