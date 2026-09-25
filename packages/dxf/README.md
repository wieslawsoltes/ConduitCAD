# @conduitcad/dxf

Native DXF reader/writer, binary tag transport, conservative record preservation,
and source-object graph inspection. Package version 0.3.0; MIT licensed.

```js
import {parseDXF,writeDXF,writeDXFBinary,inspectObjectGraph,exportReport} from '@conduitcad/dxf';
const drawing=parseDXF(inputBytes);
const report=exportReport(drawing);
const ascii=writeDXF(drawing,{version:'AC1032'});
const binary=writeDXFBinary(drawing,{version:'AC1032'});
const preserved=writeDXF(drawing,{mode:'preserve'});
const objects=inspectObjectGraph(drawing);
```

ASCII and binary R2000–R2018 normalization preserves implemented geometry,
native dimension subtypes/pictures, supported layer/text/line/dimension tables,
model/paper-space layout ownership, viewport references, MESH, HELIX and WIPEOUT.
Input also recognizes the R12 byte-code binary representation. Re-encoding old
versions preserves their source tags in `mode: 'preserve'`.

Preserving mode is not a generic database merge or an associative evaluator.
It rejects changed structural data, dependencies, unknown edits and version
conversion. It retains arbitrary original object/tag records for unchanged or
explicitly supported safe edits. `strict: true` makes normalization reject known
losses reported by `exportReport`. Preserve the native project and original
input when production interoperability matters.

The application has no runtime network/decode service dependency. No font or
proprietary CAD assets are supplied. See the workspace compatibility matrix,
native fixture tests and independent ezdxf audit for exact implementation scope.
