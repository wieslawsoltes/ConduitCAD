# @conduitcad/geometry

Planar CAD geometry kernel. Version **0.2.1**, native ESM JavaScript, MIT license.

Float64 geometry, transforms, intersections, adaptive arc/bulge and NURBS tessellation, snapping, planar offsets and two-line fillets.

## Use

Install this package and its sibling dependencies from the supplied npm archives,
or run `node scripts/bootstrap.mjs` in the complete workspace. The package name is
prepared for npm distribution; this release does not claim a registry publication.

```js
import { EPS, TAU, clamp } from '@conduitcad/geometry';
```

`src/index.js` contains the implementation and `src/index.d.ts` the TypeScript
API declarations. Browser-facing components require a browser DOM; the geometry,
model, history, routing, constraints, symbol, DXF and scene compilation engines
can also be used in Node.js. There are no external runtime dependencies beyond
the following sibling packages.

**Dependencies:** None.

## Public exports

`EPS`, `TAU`, `clamp`, `point`, `add`, `sub`, `mul`, `dot`, `cross`, `length`, `distance`, `normalize`, `lerp`, `almost`, `equalPoint`, `identity`, `transform`, `matrix`, `compose`, `inverse`, `bounds`, `emptyBounds`, `validBounds`, `inflate`, `intersects`, `contains`, `union`, `center`, `projectPoint`, `distanceToSegment`, `lineIntersection`, `segmentIntersectsBox`, `polygonContains`, `polygonArea`, `polylineLength`, `simplifyOrthogonal`, `arcPoints`, `bulgeArc`, `tessellatePolyline`, `nurbsPoint`, `splinePoints`, `offsetPolyline`, `filletLines`, `snapCandidates`.

## Documentation and validation

The full source workspace contains `docs/API.md` with integration examples,
`docs/ARCHITECTURE.md`, `docs/DXF_COMPATIBILITY.md`, and `docs/VALIDATION.md`.
Tests and raw validation reports are included there. These are original reusable
2D engineering components, not a claim of complete AutoCAD/Visio compatibility.
