export function parseHatchData(raw: any): {
    loops: any[];
    patternLines: any[];
    hatchStyle?: undefined;
    patternType?: undefined;
    patternAngle?: undefined;
    patternScale?: undefined;
    patternDouble?: undefined;
    elevation?: undefined;
    associative?: undefined;
    gradient?: undefined;
} | {
    loops: {
        flags: number;
        closed: boolean;
        points: any[];
        edges: any[];
    }[];
    hatchStyle: number;
    patternType: number;
    patternAngle: number;
    patternScale: number;
    patternDouble: boolean;
    elevation: number;
    associative: boolean;
    patternLines: {
        angle: number;
        base: {
            x: number;
            y: number;
        };
        offset: {
            x: number;
            y: number;
        };
        dashes: number[];
    }[];
    gradient: any;
};
export function readEntityFidelity(e: any, raw: any, diagnostics: any, options?: {}): void;
export function writeHatchData(e: any, pair: any): void;
