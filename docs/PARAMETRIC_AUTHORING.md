# Shared block editing and parametric authoring — 0.5.0

## Graphical block workflow

Select an INSERT and choose **Edit block geometry** in Properties, double-click
an insert, or use **More → Block definitions**. `BEDIT name` also opens a definition.
The editor switches to an isolated native-entity canvas with its own undo history.
Drawing tools, selection, grips, numeric properties, copy/delete, layers,
constraints, calculated text and nested symbol placement work in that canvas.
The drawing is not exploded, and no parent insertion is changed before Save.

The authoring bar provides **Save block**, **Save & close**, **Test block**,
**Base / ports / attributes**, **Parameters & actions** and **Discard & close**.
`BSAVE`, `BCLOSE`, `BSAVEAS`, `BTEST`/`BTESTBLOCK`, `PARAMETERS` and `SOLVE` have
corresponding command entry points. `Ctrl/Cmd+S` saves the block while editing.
Open/New/Export are guarded until the authoring session is closed. A test block
has separate instance parameters/history; returning restores the authoring draft.

Save validates the candidate, every affected parameter variant, nesting,
attributes and connected ports before committing the parent drawing as one history
transaction. All direct and transitive nested INSERTs refresh, with their IDs,
placements and instance parameter values retained. Named ports update and connected
routes are refreshed. Removing a connected terminal or introducing a nesting cycle
fails without changing the parent drawing. A definition signature prevents a stale
authoring session from overwriting a newer definition.

**Make unique** creates a private definition for one insert. **Rename definition**
updates root and nested references. **Save block as** creates a new independent
definition. The block manager can create, insert, edit or delete unused definitions;
it refuses deletion of a referenced definition. Creating a new empty definition
is itself undoable; discarding its editor leaves that empty definition until undone.
Changing a base point leaves insertion anchors fixed, deliberately changing the
relative placement of the block geometry.

## Attributes and connection points

Add a native ATTDEF using **Add attribute**. Its tag, prompt, default, text height,
rotation and flags can be edited in Properties. Flags are native DXF flags:
1 invisible, 2 constant, 4 verify, 8 preset. Verify/preset flags are retained, not
an assertion of all AutoCAD interactive attribute-prompt workflows.

Save / **Synchronize attributes** (`ATTSYNC` on a selected insert) updates attribute
definitions across references while keeping per-instance user text and identities
for unchanged case-insensitive tags. Renaming a tag creates a new default value;
removed tags are removed. Constant ATTDEFs render from the block and are not
incorrectly duplicated as ATTRIBs. DXF `attributeTag`, prompts and flags round-trip.
Attribute values can be edited in an INSERT's Properties. Calculated attributes
are read-only instance outputs and regenerate from the master expression.

Attribute placement decomposes the complete affine text frame, including rotated
nonuniform scales and reflected inserts. Default OCS is required; singular or
non-default-OCS attribute frames are refused. Parameter actions affecting ATTDEFs
also update their instance ATTRIB placements. Geometry constraints do not solve
arbitrary text layout or font metrics.

Ports can be added at a selected point or edited in the base/ports form. Optional
anchors `{entityId, point, followDirection, reverse}` bind them to solved geometry.
`point` supports `a`, `b`, `c`, `p`, or `points.N`. Anchors, base-point markers and
port names appear in the authoring overlay. Advanced port lists are edited as JSON.

## Constraint-based and action-based blocks

The existing Conduit dynamic schema v1 remains readable. Schema **v2** adds numeric
parameter expressions, constraint-based geometry, anchored solved ports, polar
movement and polar arrays. Numeric, distance, angle, integer, Boolean and enum
parameters are supported. Ranges and explicit value sets are validated before any
instance is changed. Derived numeric parameters are read-only outputs.

Actions are move, stretch, rotate, scale, flip, linear array, polar move, polar
array, visibility and lookup. The graphical authoring form attaches actions to the
current selection and adds parameter values/ranges/expressions. It stages a schema
for validation. Precise selection sets, crossing windows, visibility-state maps,
lookup tables and polar-angle bindings remain available in the schema editor;
this is not a complete drag-and-drop replacement of every Autodesk authoring palette.
A polar array uses `sweep * cell / count`, with the original cell at zero angle;
the end angle is not duplicated. Array terminals currently identify the original
cell, not automatically synthesized ports for every copy.

Evaluation starts from pristine master geometry on every parameter change. Lookup
and derived-expression dependencies are resolved topologically; cycles and
conflicting writers fail. Actions run in declared order, then the native planar
sketch constraints solve. Associated dimension pictures, calculated text/attributes
and anchored ports regenerate after solving. Variant cache signatures include local
parameters/constraints and are bounded to 64 variants per master.

Example (the public APIs run without the workbench):

```js
import {
  createDocument, createBlockDefinition, entity, line,
  setDynamicParameters, beginBlockEdit, editedBlockDefinition,
  updateBlockDefinition
} from '@conduitcad/model';

const doc = createDocument('Constrained component');
createBlockDefinition(doc, 'VariableBeam', {
  entities: [line({x: 0, y: 0}, {x: 100, y: 0}, {id: 'axis'})],
  ports: [{name: 'out', x: 100, y: 0, dx: 1, dy: 0,
    anchor: {entityId: 'axis', point: 'b', followDirection: true}}],
  dynamic: {
    version: 2,
    parameters: [
      {name: 'Length', type: 'distance', default: 100, min: 10, max: 500},
      {name: 'HalfLength', type: 'number', default: 50, expression: 'Length / 2'}
    ],
    actions: [],
    constraints: [
      {id: 'anchor', type: 'fixed-point', entityId: 'axis', pointA: 'a',
        target: {x: 0, y: 0}},
      {id: 'horizontal', type: 'horizontal', entityId: 'axis'},
      {id: 'length', type: 'length', entityId: 'axis', value: 'Length'}
    ]
  }
});
const insert = entity('INSERT', {block: 'VariableBeam', x: 0, y: 0, sx: 1, sy: 1});
doc.entities.push(insert);
setDynamicParameters(insert, doc, {Length: 180});
const session = beginBlockEdit(doc, 'VariableBeam');
session.draft.entities.push(line({x: 0, y: -10}, {x: 0, y: 10}));
const report = updateBlockDefinition(doc, session.name, editedBlockDefinition(session),
  {expectedSignature: session.signature});
console.log(report.updatedInserts);
```

`prepareBlockUpdate` returns a fully validated replacement database without
mutating its argument. `updateBlockDefinition` commits it. A host using these
headless APIs supplies history, routing, persistence and renderer invalidation;
the bundled workbench performs those integrations.

## Geometric and dimensional constraints

Select geometry and use **Add constraint**. The dialog provides point selectors,
0-based polyline segment selectors, expressions, optional constraint names and
reference-only mode. **Auto constrain** explicitly infers horizontal/vertical
segments and endpoint coincidence on selected planar geometry; it does not infer
every possible tangency, symmetry or design intent.

Relations: horizontal, vertical, length, radius, diameter, angle, signed angle
between lines, coincidence, concentricity, parallelism, perpendicularity,
collinearity, equal lengths/radii, distance, signed X/Y distance, point-on-line,
point-on-circle, midpoint, line-circle/circle-circle tangency, point symmetry about
a line, fixed geometry and fixed point. Angular constraint targets are degrees.
Tangency/incidence refer to supporting lines/circles; ARC endpoint/sweep parameters
are not solver variables and finite-arc contact containment is not enforced.

LINE, POINT, CIRCLE, ARC center/radius and straight planar polyline coordinates
are supported. Bulged polylines, mesh topology, arbitrary spline/ellipse constraints,
non-default OCS and nonzero elevation are rejected rather than silently flattened.
Locked entities are fixed; workbench layer locks contribute fixed equations.

Dimensional constraints are driving by default. Names can participate in other
**driving** expressions, for example `d2 = d1 * 2`; dependency cycles fail before
geometry mutation. Reference measurements have no equations and cannot silently
be sampled to drive other geometry. They are available to calculated annotations.
A native line/radius dimension's **Drive source by expression** action connects a
constraint to its source geometry; its witnesses and picture then regenerate.

**Solve status** shows equation count, numerical rank, degrees of freedom,
residuals, redundant equations and the implicated unsatisfied constraints. Its
constraint rows can be edited, suppressed or removed. **Show / hide constraints**
provides authoring labels for solved values and reference measurements. Those
screen-space labels are UI overlays, not automatically exported dimension objects.
Use native associated dimensions or calculated text for portable annotations.

## Numerical solver

The new solver uses analytic forward-mode derivatives rather than finite
coordinate differences. Connected constraint components solve independently.
Each component is translated/scaled near the origin before residual evaluation.
Levenberg–Marquardt steps solve the augmented system

```
[J             ] delta = [-r]
[sqrt(lambda) D]         [ 0]
```

using column-pivoted Householder QR, avoiding the squared condition number of
normal equations. Invalid trials are rejected. A nondifferentiable zero-distance
initial state receives a deterministic private perturbation only if it lowers the
original residual. All source coordinates remain unchanged unless every component
converges. A failed workbench edit also restores the source, annotations and
associated dimension pictures through its history transaction.

Default absolute tolerance is 1e-7 drawing units, relative tolerance 1e-10,
100 iterations and 256 scalar variables per connected component. Up to 512 per
component is configurable; a sketch is bounded to 4096 constrained scalar variables
and 4096 supplied constraints. This is component partitioning with dense QR inside
each component, not a claim of a production million-variable sparse solver.

Rank/DOF are local numerical diagnostics in the supported parameterization, not
proof of a globally unique assembly or a minimal conflicting subset. For an ARC,
DOF includes center/radius, not unimplemented endpoint-angle variables. Residual
norms combine normalized linear/angular equations and are not per-feature physical
angle error tolerances. AutoCAD-equivalent robustness/performance has not been
established by comparative testing; the implementation is Conduit's own solver.

## Calculations and annotations

Parameters show name, expression and evaluated value. The parser supports bounded
arithmetic, powers, pi/tau/e and abs, sqrt, trigonometric/inverse functions, atan2,
hypot, min/max, floor/ceil/round, exp, ln, log10, pow, rad, deg and clamp. Trig
functions use radians; `rad(30)` converts degrees. Units are drawing-unit values,
not a dimensional-analysis or engineering-unit inference engine. Inputs are never
executed as JavaScript; property access, unknown functions, nonfinite results and
cycles are rejected. Dependency results are memoized within each evaluation.

**Calculated annotation** creates native TEXT from user parameters and named
measured constraints. Formula, precision, prefix and suffix are editable in
Properties. Text updates after successful edits and on history restoration;
**Convert to static text** removes the expression explicitly. All calculations
are validated before any calculated text is modified. Calculations within a
constraint-based block use that instance's solved values.

## DXF and remaining compatibility boundary

Shared blocks and inserts remain native BLOCK/INSERT records. ATTDEF/ATTRIB tags,
flags, prompts, values and placements are native. Conduit local constraints,
parameters, revisions and calculation expressions use app metadata. Constraint-
based and action-based blocks export evaluated native anonymous blocks, with
metadata allowing Conduit to recover editable masters. Baked export omits that
behavior. Other CAD applications receive displayable native geometry and text,
**not executable Autodesk dynamic-action or dimensional-constraint graphs**.

Record-preserving mode still refuses structural block/behavior changes. Importing
unknown Autodesk/vendor graphs does not activate this evaluator. XREF editing,
complete custom dimension styles/annotative contexts, arbitrary reflected native
entity transforms, all graphical action/visibility/lookup authoring interactions,
3D/B-rep constraints and full font parity remain separate boundaries. The block
editor uses snapshot transactions, so a saved master triggers a full parent scene
rebuild rather than a claim of optimal million-insert invalidation.

Validation counts and reproduction are in VALIDATION.md. Tests use Canvas 2D and
emulated mobile viewports; no physical-phone/GPU or production-storage durability
qualification is asserted.

## Primary workflow references

- Autodesk Block Editor reference: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-LT/files/GUID-B69D58AD-7920-4198-AB2A-0E24B944F6CD.htm
- Autodesk Parameters Manager (historical workflow reference): https://help.autodesk.com/cloudhelp/2016/ENU/AutoCAD-Core/files/GUID-A2AE7503-7EFF-4C67-B283-EC0898BE8C59.htm

These are behavior references, not copied implementation code or compatibility certification.
