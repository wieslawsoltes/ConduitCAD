/** Pointer capture + multi-pointer gesture arbitration, shared by touch, pen, and mouse. */
export class PointerController {
    constructor(element: any, handlers?: {});
    element: any;
    handlers: {};
    pointers: Map<any, any>;
    abort: AbortController;
    gesture: {
        x: number;
        y: number;
        distance: number;
    };
    longTimer: any;
    info(e: any): {
        x: number;
        y: number;
        id: any;
        pointerType: any;
        pressure: any;
        shift: any;
        alt: any;
        ctrl: any;
        button: any;
        buttons: any;
        original: any;
    };
    pinchState(): {
        x: number;
        y: number;
        distance: number;
    };
    down(e: any): void;
    start: {
        time: number;
        x: number;
        y: number;
        id: any;
        pointerType: any;
        pressure: any;
        shift: any;
        alt: any;
        ctrl: any;
        button: any;
        buttons: any;
        original: any;
    };
    move(e: any): void;
    up(e: any, cancelled?: boolean): void;
    clearLong(): void;
    dispose(): void;
}
