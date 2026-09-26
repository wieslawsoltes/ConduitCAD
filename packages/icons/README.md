# @conduitcad/icons

Original Conduit CAD line icons, MIT licensed. No icon fonts, external CDN, DOM or network dependency.
The 24-unit rounded-stroke family includes drafting, modeling, file, parameter and navigation glyphs. The brand mark retains its 32-unit view box.

```js
import { icon, hasIcon, ICON_NAMES, ICON_GROUPS } from '@conduitcad/icons';
const markup = `<button aria-label="Extrude">${icon('extrude')}</button>`;
```

`icon(name, className?)` returns a decorative inline SVG using `currentColor`, `aria-hidden="true"` and `focusable="false"`. Classes are escaped. Unknown names return the question-mark glyph; `hasIcon` permits strict consumer validation. Control naming, tooltips, pressed state and interaction belong to the host UI. Inline geometry has no document-global IDs and works in multiple mounted consumers, offline and under non-root base URLs. `ICON_NAMES` and `ICON_GROUPS` are immutable discovery data. No external symbol assets are copied.
