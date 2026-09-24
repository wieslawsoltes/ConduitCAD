# @conduitcad/dxf

ASCII/binary DXF reading and normalized ASCII writing. Version **0.1.0**, native ESM JavaScript, MIT license.

R12/modern binary group streams, ASCII parsing, common 2D entity semantics, native blocks, Conduit XDATA and original-source preservation. Edited exports are not universal lossless DXF round trips.

## Use

Install this package and its sibling dependencies from the supplied npm archives,
or run `node scripts/bootstrap.mjs` in the complete workspace. The package name is
prepared for npm distribution; this release does not claim a registry publication.

```js
import { aciColor, parseAsciiPairs, parseBinaryPairs } from '@conduitcad/dxf';
```

`src/index.js` contains the implementation and `src/index.d.ts` the TypeScript
API declarations. Browser-facing components require a browser DOM; the geometry,
model, history, routing, constraints, symbol, DXF and scene compilation engines
can also be used in Node.js. There are no external runtime dependencies beyond
the following sibling packages.

**Dependencies:** `@conduitcad/geometry`, `@conduitcad/model`.

## Public exports

`aciColor`, `parseAsciiPairs`, `parseBinaryPairs`, `parseDXF`, `writeDXF`, `exportReport`.

## Documentation and validation

The full source workspace contains `docs/API.md` with integration examples,
`docs/ARCHITECTURE.md`, `docs/DXF_COMPATIBILITY.md`, and `docs/VALIDATION.md`.
Tests and raw validation reports are included there. These are original reusable
2D engineering components, not a claim of complete AutoCAD/Visio compatibility.

The ACI palette carries the attribution in `THIRD_PARTY_NOTICES.md`.
