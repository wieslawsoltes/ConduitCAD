# @conduitcad/renderer3d

Retained, double-precision spatial scene compilation with relative-coordinate GPU
uploads, sixteen CAD visual styles, material lighting, optional AO/shadows, section
caps, transparency, antialiased feature/hidden edges and depth-aware picking.

The browser adapter uses WebGPU or WebGL2 with an explicit Canvas software-depth
fallback. Scene preparation, settings, lighting and the reference rasterizer are
independent modules. No external shader, image, icon or material CDN is used.

```js
import { SpatialRenderer, createRenderingStudy } from '@conduitcad/renderer3d';
const view = new SpatialRenderer(document.querySelector('#viewport'));
await view.ready;
view.setDocument(createRenderingStudy());
view.setDisplaySettings({style:'realistic',ground:true,shadows:true});
view.fit();
// Later: view.dispose();
```

Read `docs/RENDERING_3D.md` in the source workspace for the complete API, render graph,
limits, metadata interchange and quality budgets. This is a real-time faceted CAD
viewport, not an offline ray/path tracer, native ACIS renderer or full font system.
The 0.10.0 checkpoint's new WebGPU graph awaits executable native-origin validation;
Canvas and WebGL2 have actual image/lifecycle tests. Do not infer a physical-device
performance guarantee from software-adapter test timings.
