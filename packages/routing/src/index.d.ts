import type { Point, Bounds } from '@conduitcad/geometry';
import type { CadDocument } from '@conduitcad/model';
export interface RoutingOptions { clearance?: number; bendCost?: number; maxNodes?: number; lead?: number; waypoints?: Point[]; }
export interface RoutingObstacle extends Bounds { id?: string; }
export interface RoutingPort extends Point { dx?: number; dy?: number; entityId?: string; }
export interface RouteResult { points: Point[]; status: string; visited: number; reason?: string; }
/** Bounded orthogonal visibility-grid search. */
export function routeOrthogonal(start: Point, end: Point, obstacles?: RoutingObstacle[], options?: RoutingOptions): RouteResult;
/** Named-normal escape stubs, retaining endpoint envelopes in the obstacle search. */
export function routePorts(from: RoutingPort, to: RoutingPort, obstacles?: RoutingObstacle[], options?: RoutingOptions): RouteResult;
export function routeVia(start: Point, end: Point, waypoints: Point[], obstacles?: RoutingObstacle[], options?: RoutingOptions): RouteResult;
export function graphFromDocument(doc: CadDocument): {
    nodes: {id: string; tag: string; block: string}[];
    edges: {id: string; from: string | null; to: string | null; fromPort: string | null; toPort: string | null; style: string; label: string}[];
    adjacency: Record<string, {edge: string; to: string | null}[]>;
};
