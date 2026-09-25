export type ParameterInput = number | string | {expression?: number | string; value?: number};
export type ParameterMap = Record<string, ParameterInput>;
export interface ParameterValue {name: string; expression: ParameterInput; value: number; dependencies: string[];}
export interface SketchPoint {x: number; y: number; z?: number; bulge?: number;}
export interface SketchEntity {id: string; type: string; a?: SketchPoint; b?: SketchPoint; c?: SketchPoint; p?: SketchPoint; points?: SketchPoint[]; r?: number; [key: string]: any;}
export type ConstraintKind = 'horizontal' | 'vertical' | 'length' | 'radius' | 'diameter' | 'coincident' | 'concentric' | 'parallel' | 'perpendicular' | 'collinear' | 'equal' | 'angle' | 'angle-between' | 'fixed' | 'fixed-point' | 'distance' | 'distance-x' | 'distance-y' | 'point-on-line' | 'point-on-circle' | 'midpoint' | 'tangent' | 'symmetric';
export interface SketchConstraint {
    id?: string; type: ConstraintKind | (string & {}); entityId?: string; entities?: string[];
    value?: string | number; name?: string; reference?: boolean; mode?: 'reference' | 'driving';
    suppressed?: boolean; visible?: boolean; pointA?: string; pointB?: string;
    segmentA?: number; segmentB?: number; target?: SketchEntity | SketchPoint;
    side?: 1 | -1; internal?: boolean; [key: string]: any;
}
export interface SolverOptions {tolerance?: number; relativeTolerance?: number; maxIterations?: number; maxVariables?: number; rankTolerance?: number;}
export interface ConstraintDiagnostic {id: string; type: string; mode: string; suppressed: boolean; residual: number; satisfied: boolean; redundant: boolean;}
export interface ConstraintAnnotation {id: string; entityIds: string[]; position: SketchPoint; text: string; value: number | null; target: number | null; expression: string | number | null; reference: boolean; visible: boolean;}
export interface ComponentReport {
    converged: boolean; iterations: number; singularStartPerturbed: boolean; rejectedSteps: number; residual: number; normalizedResidual: number;
    variables: number; equations: number; rank: number; degreesOfFreedom: number; redundantEquations: number;
    constraints: ConstraintDiagnostic[]; status: string;
}
export interface SolveReport {
    converged: boolean; iterations: number; residual: number; variables: number; unconstrainedVariables: number;
    affectedVariables: number; equations: number; rank: number; degreesOfFreedom: number; redundantEquations: number;
    components: ComponentReport[]; constraints: ConstraintDiagnostic[]; annotations: ConstraintAnnotation[];
    conflicts: string[]; status: string; rolledBack: boolean; analysisOnly: boolean;
    jacobian: 'analytic-forward-mode'; linearSolver: 'column-pivoted-householder-qr';
}
/** Bounded arithmetic/function grammar; never executes JavaScript or property access. Angles in trig functions are radians. */
export function evaluateExpression(source: ParameterInput, parameters?: ParameterMap, stack?: string[]): number;
export function resolveParameters(parameters: ParameterMap): Record<string, number>;
export function describeParameters(parameters: ParameterMap): ParameterValue[];
export function parameterDependencies(source: number | string): string[];
export function reservedParameterNames(): string[];
/** Read-only geometric measurement. Returns null for non-dimensional constraints. */
export function constraintMeasurement(entities: SketchEntity[], constraint: SketchConstraint): number | null;
export function constraintAnnotations(entities: SketchEntity[], constraints: SketchConstraint[], parameters?: ParameterMap): ConstraintAnnotation[];
/** Pure suggestions: caller explicitly commits them in a history transaction. */
export function inferSketchConstraints(entities: SketchEntity[], existing?: SketchConstraint[], options?: {linearTolerance?: number; angularTolerance?: number}): SketchConstraint[];
/** Validates all expressions before mutating any calculated text. */
export function evaluateCalculations(entities: SketchEntity[], constraints: SketchConstraint[], parameters: ParameterMap): Array<{entityId: string; value: number; text: string}>;
/** Planar analytic-Jacobian, component-partitioned Levenberg–Marquardt solver using pivoted QR. */
export class ConstraintSolver {
    constructor(options?: SolverOptions);
    tolerance: number; relativeTolerance: number; maxIterations: number; maxVariables: number; rankTolerance: number;
    solve(entities: SketchEntity[], constraints: SketchConstraint[], parameters?: ParameterMap, options?: {analyzeOnly?: boolean}): SolveReport;
    analyze(entities: SketchEntity[], constraints: SketchConstraint[], parameters?: ParameterMap): SolveReport;
}
