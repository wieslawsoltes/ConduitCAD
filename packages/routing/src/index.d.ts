/** Adaptive orthogonal visibility-grid A*. Bend cost is part of directional state. */
export function routeOrthogonal(start: any, end: any, obstacles?: any[], options?: {}): {
    points: import("@conduitcad/geometry").Point[];
    status: string;
    visited: number;
    reason?: undefined;
} | {
    points: import("@conduitcad/geometry").Point[];
    status: string;
    reason: string;
    visited: number;
};
export function routePorts(from: any, to: any, obstacles?: any[], options?: {}): {
    points: import("@conduitcad/geometry").Point[];
    status: string;
    visited: number;
    reason?: undefined;
} | {
    points: import("@conduitcad/geometry").Point[];
    status: string;
    reason: string;
    visited: number;
};
export function routeVia(start: any, end: any, waypoints: any, obstacles?: any[], options?: {}): {
    points: import("@conduitcad/geometry").Point[];
    status: string;
    visited: number;
};
export function graphFromDocument(doc: any): {
    nodes: any;
    edges: any;
    adjacency: {};
};
