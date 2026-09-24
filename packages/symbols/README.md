# @conduitcad/symbols

Original engineering symbol and line libraries. Version **0.1.0**, native ESM JavaScript, MIT license.

56 illustrative P&ID, electrical and flowchart masters, ten line styles, native block insertion and three complete example drawings. Symbols are not standards-certified.

## Use

Install this package and its sibling dependencies from the supplied npm archives,
or run `node scripts/bootstrap.mjs` in the complete workspace. The package name is
prepared for npm distribution; this release does not claim a registry publication.

```js
import { SYMBOLS, LINE_STYLES, installSymbols } from '@conduitcad/symbols';
```

`src/index.js` contains the implementation and `src/index.d.ts` the TypeScript
API declarations. Browser-facing components require a browser DOM; the geometry,
model, history, routing, constraints, symbol, DXF and scene compilation engines
can also be used in Node.js. There are no external runtime dependencies beyond
the following sibling packages.

**Dependencies:** `@conduitcad/geometry`, `@conduitcad/model`.

## Public exports

`SYMBOLS`, `LINE_STYLES`, `installSymbols`, `insertSymbol`, `createDemo`.

## Documentation and validation

The full source workspace contains `docs/API.md` with integration examples,
`docs/ARCHITECTURE.md`, `docs/DXF_COMPATIBILITY.md`, and `docs/VALIDATION.md`.
Tests and raw validation reports are included there. These are original reusable
2D engineering components, not a claim of complete AutoCAD/Visio compatibility.
