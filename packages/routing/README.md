# @conduitcad/routing

Obstacle-aware orthogonal connector routing. Version **0.7.0**, native ESM JavaScript, MIT license.

Visibility grid routing with directional A*, bend penalties, port leads, waypoints and explicit blocked fallback status.

## Use

Install this package and its sibling dependencies from the supplied npm archives,
or run `node scripts/bootstrap.mjs` in the complete workspace. The package name is
prepared for npm distribution; this release does not claim a registry publication.

```js
import { routeOrthogonal, routePorts, routeVia } from '@conduitcad/routing';
```

`src/index.js` contains the implementation and `src/index.d.ts` the TypeScript
API declarations. Browser-facing components require a browser DOM; the geometry,
model, history, routing, constraints, symbol, DXF and scene compilation engines
can also be used in Node.js. There are no external runtime dependencies beyond
the following sibling packages.

**Dependencies:** `@conduitcad/geometry`, `@conduitcad/spatial`.

## Public exports

`routeOrthogonal`, `routePorts`, `routeVia`, `graphFromDocument`.

## Documentation and validation

The full source workspace contains `docs/API.md` with integration examples,
`docs/ARCHITECTURE.md`, `docs/DXF_COMPATIBILITY.md`, and `docs/VALIDATION.md`.
Tests and raw validation reports are included there. These are original reusable
2D engineering components, not a claim of complete AutoCAD/Visio compatibility.
