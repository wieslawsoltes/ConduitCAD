/** Safe expression parser. No eval, property access, functions or executable code. */
export function evaluateExpression(source: any, parameters?: {}, stack?: any[]): any;
export function resolveParameters(parameters: any): {};
/** Dense damped least-squares planar sketch solver for small selected sketches. */
export class ConstraintSolver {
    constructor({ tolerance, maxIterations }?: {
        tolerance?: number;
        maxIterations?: number;
    });
    tolerance: number;
    maxIterations: number;
    solve(entities: any, constraints: any, parameters?: {}): {
        converged: boolean;
        iterations: number;
        residual: number;
        variables: number;
        equations: number;
        status: string;
        rolledBack: boolean;
    };
}
