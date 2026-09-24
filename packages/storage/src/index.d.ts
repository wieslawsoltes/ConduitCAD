export function downloadFile(filename: any, contents: any, type?: string): void;
/** Local-only recovery store. No accounts, telemetry, network upload, or cloud persistence. */
export class ProjectStore {
    constructor({ database, onStatus }?: {
        database?: string;
        onStatus?: () => void;
    });
    database: string;
    onStatus: () => void;
    timer: number;
    ready: Promise<any>;
    open(): Promise<any>;
    save(document: any, id?: string): Promise<{
        id: string;
        name: any;
        updatedAt: string;
        document: any;
    }>;
    schedule(document: any, id?: string): void;
    load(id?: string): Promise<any>;
    list(): Promise<any>;
    dispose(): void;
}
