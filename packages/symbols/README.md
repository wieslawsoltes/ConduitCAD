# @conduitcad/symbols

Original engineering symbol, line and drawing-starter libraries. Version **0.2.1**,
native ESM JavaScript with TypeScript declarations, MIT license.

223 native CAD block masters in 11 categories; 21 connection styles; 20 genuinely
editable industry starters. No raster stencils or external runtime downloads.
Reference families and project conventions are explicit; these are **not
standards-certified** symbols. See the workspace `docs/SYMBOLS.md` and generated
`docs/SYMBOL_REVIEW.md` for the per-master review and exact approval boundary.

```js
import {createDrawing, searchSymbols, insertSymbol, auditSymbols} from '@conduitcad/symbols';
const document = createDrawing('hydraulic-actuator');
const choices = searchSymbols('cylinder', {category: 'Hydraulics'});
document.entities.push(insertSymbol(document, choices[0].id, 900, 450, {tag: 'A-2'}));
if (auditSymbols().some(r => r.errors.length)) throw new Error('Catalogue geometry regression');
```

Public exports: `SYMBOLS`, `CATEGORIES`, `STANDARD_REFERENCES`, `LINE_STYLES`,
`DRAWING_TYPES`, `searchSymbols`, `installSymbols`, `insertSymbol`, `createDemo`,
`createDrawing`, `auditSymbol`, `auditSymbols`, `symbolUpdates`,
`updateSymbolDefinitions`.

All original 64 IDs/block names/terminal names are preserved. Installing or
browsing a library never replaces existing saved definitions. Explicit migration
validates every selected master before mutation; wrap it in your application's
history transaction and reroute dependent connections afterwards.

Dependencies: `@conduitcad/geometry`, `@conduitcad/model`, `@conduitcad/routing`.
Install the supplied sibling tarballs together, or run the workspace bootstrap.
Registry publication is separate from producing/installing npm archives.
