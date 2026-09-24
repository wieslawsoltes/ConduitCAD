# @conduitcad/renderer

Retained CAD strokes with GPU fallbacks. Version **0.1.0**, native ESM JavaScript, MIT license.

Scene-relative coordinates, adaptive curve tessellation, batched strokes, WebGPU compute culling/indirect draws, WebGL2 instancing and Canvas fallback. Text and fills use a Canvas overlay. Equal-topology edits patch buffer ranges. Hardware GPU execution was not validated in the delivery runner.

## Use

Install this package and its sibling dependencies from the supplied npm archives,
or run `node scripts/bootstrap.mjs` in the complete workspace. The package name is
prepared for npm distribution; this release does not claim a registry publication.

```js
import { Camera, colorRGBA, buildScene } from '@conduitcad/renderer';
```

`src/index.js` contains the implementation and `src/index.d.ts` the TypeScript
API declarations. Browser-facing components require a browser DOM; the geometry,
model, history, routing, constraints, symbol, DXF and scene compilation engines
can also be used in Node.js. There are no external runtime dependencies beyond
the following sibling packages.

**Dependencies:** `@conduitcad/geometry`, `@conduitcad/spatial`, `@conduitcad/model`.

## Public exports

`Camera`, `colorRGBA`, `buildScene`, `updateSceneEntities`, `CULL_SHADER`, `LINE_SHADER`, `drawPath`, `drawText`, `CadRenderer`.

## Documentation and validation

The full source workspace contains `docs/API.md` with integration examples,
`docs/ARCHITECTURE.md`, `docs/DXF_COMPATIBILITY.md`, and `docs/VALIDATION.md`.
Tests and raw validation reports are included there. These are original reusable
2D engineering components, not a claim of complete AutoCAD/Visio compatibility.
