# 3D visual styles and display graph — 0.10.0

This is a real-time CAD viewport renderer for ConduitCAD's supported native spatial
geometry. It is not an offline Fusion/AutoCAD renderer, an ACIS kernel, or an exact
implementation of Autodesk's proprietary material and visual-style databases.

## Display modes

Open **3D → Display styles** in the camera toolbar, or **Properties → Display styles**.
Each card changes the actual renderer immediately. **Keep display** accepts the view;
**Cancel**, Escape, and closing/replacing the dialog restore the previous display.
The style does not change CAD geometry or consume an undo transaction. Optional saved
presets and drawing defaults are explicit, undoable metadata edits.

| Identifier | Mode | Surface and edge behavior |
|---|---|---|
| `shaded-edges` | Shaded with visible edges | Smooth lighting, visible feature edges and camera-dependent silhouettes |
| `shaded` | Shaded | Smooth lighting without mesh edge strokes |
| `shaded-hidden` | Shaded with hidden edges | Smooth surfaces, visible strokes and dashed obscured edges |
| `wireframe` | Wireframe | Polygon edges both in front and behind surfaces |
| `hidden` | Wireframe · visible edges only | Background-colored surface depth pass removes hidden edges |
| `wireframe-hidden` | Wireframe with hidden edges | Solid visible edges and dashed hidden edges |
| `realistic` | Realistic | Metal/roughness material shading without mesh edge strokes |
| `realistic-edges` | Realistic with edges | Material shading plus readable outlines |
| `conceptual` | Conceptual | Cool-to-warm Gooch shading with outlines |
| `gray` | Shades of gray | Monochrome surface lighting, without modifying native colors |
| `sketchy` | Sketchy | Hidden-line removal, stable screen-space jitter and line extensions |
| `xray` | X-ray | Weighted order-independent transparency and internal edges |
| `flat` | Flat shaded | Original polygon normals rather than smoothed vertex normals |
| `flat-edges` | Flat shaded with edges | Facets and non-coplanar polygon edges |
| `clay` | Clay | Neutral surface material and shape outlines |
| `normals` | Surface normals | World-space face-normal components encoded as RGB |

The **2D Draw** command still uses the original 2D renderer, tools and independent
camera. `VSCURRENT`, `VISUALSTYLE`, and `SHADEMODE` accept the above identifiers;
`VSCURRENT 2d`/`2dwireframe` returns to planar drafting. Text labels and native curves
remain visible according to the supported spatial display-list contract.

### Desktop and touch

Desktop uses a right-hand display panel without blurring the working view. Phones
use a bounded bottom sheet; short landscape uses a side panel. **Preview model**
reduces the sheet to a live style selector and confirmation controls, temporarily
fitting the actual model into the unobscured area. **Show options**, Keep and Cancel
restore the exact working camera. This comparison framing never edits geometry or
stores a replacement camera. Styles remain labeled; search, numeric fields, quality
presets and section controls retain keyboard and touch targets.

Advanced sections provide studio environment/exposure, shadows, ambient occlusion,
X-ray opacity, smoothing/crease angle, feature/all-edge visibility, visible/hidden
colors, pixel widths, silhouette emphasis, dash period, sketch jitter/extensions,
background colors, ground/grid, and section-cap appearance. Quality is Draft,
Balanced or High. The ground and grid are world-space, depth-tested geometry, not
lines indiscriminately painted over foreground solids.

Every document has independent display and section state alongside its existing
camera/history. Optional named presets (maximum 32) and a drawing default are stored
in Conduit project/DXF application metadata. Imported settings are normalized through
a whitelist; malformed fields cannot inject shader code or arbitrary settings.

## Materials, sections and image output

**Appearance / layer** offers Paint, Aluminum, Steel, Copper, Brass, Polymer,
Rubber, Ceramic and Transparent polymer. Native entity color and opacity remain
authoritative; stale material metadata cannot override a later native edit. Metallic,
roughness, opacity and emission accept validated drawing expressions, evaluated on
Apply. Expressions are not stored as associative material constraints. Material edits
are atomic and undoable; roughness is bounded to 0.04–1.

Realistic evaluates a GGX/Schlick metal-roughness BRDF in linear light, procedural
hemisphere/softbox environment lighting, bounded exposure and an ACES-style filmic
fit. Studio, Soft light, Daylight and Dark studio are procedural environments. This
is **not** HDR-image-based lighting, a texture-map system, traced reflections,
refraction, caustics, ray tracing, path tracing or global illumination. Transparency
is weighted blended OIT, not optically correct glass. Translucent bodies do not cast
physically accurate colored shadows.

Section analysis clips both surfaces and edges. Closed manifold contour loops
receive even-odd caps, preserving holes such as a torus's annular section. Cuts exactly
through existing tessellation rings are handled. Open/non-manifold graphs or budget
overruns remain uncapped and emit diagnostics rather than inventing a solid. Cap
color/hatching are display-only: no export mesh, feature or topology is changed.
Caps are not separately selectable CAD faces and currently render opaque.

**Capture PNG** exports the actual current 3D render canvas with annotation/gizmo
overlays. The regular export dialog offers a separate **PNG — current 3D viewport**
entry; its original 2D PNG export remains unchanged. Public `capturePNG` can exclude
overlays. This is a viewport-size image, not a tiled supersampled offline renderer.

**Material study** opens a separate editable drawing: nine material spheres, nine
pedestals and an annular-section torus. All nineteen objects have Conduit feature
history, with named Radius and Spacing parameters. Native project, ASCII DXF and
binary DXF files live under `samples/rendering/`; regenerate with
`npm run samples:rendering`.

## Rendering architecture

`@conduitcad/renderer3d` retains its public camera, scene and picking APIs. New modules
separate presentation settings, render-data preparation, lighting, WGSL/GLSL programs,
WebGPU resources, WebGL2 resources and the software reference rasterizer.

1. Compile the supported spatial DXF scene in double precision. Preserve native
   topology; generate area-weighted normals with a crease threshold and edge adjacency.
   Rebase positions around the scene origin before converting to Float32 uploads.
2. Optionally render a normal/linear-depth prepass for 12-tap screen-space occlusion.
   Reconstruct sample positions consistently for orthographic and perspective views.
3. Optionally build a cached directional shadow map with 3×3 PCF. Geometry, section
   and environment changes invalidate it; camera-only changes reuse it.
4. Render opaque surfaces and background with a shared multisample depth attachment.
5. When transparency is present, accumulate weighted premultiplied colors and
   multiplicative revealage in separate floating-point targets, then composite.
6. Draw instanced edge quads with near/far/section clipping, depth-tested visible and
   hidden passes, analytic antialiasing, pixel widths, dash masks and silhouette tests.
   Jitter is deterministic across frames and does not deform source geometry.

The GPU paths use four-sample MSAA; WebGL2 negotiates one sample if its floating-point
attachment does not support four. WebGL2 requires `EXT_color_buffer_float` for the
full graph and reports a software fallback when unavailable. WebGPU pipeline creation
collects compilation/validation errors; device loss or uncaptured errors are reported
before fallback. WebGL context restoration recreates the graph instead of attempting
to delete handles from the lost context. No GPU readback is needed for normal draws;
PNG capture is an explicit user operation. Its WebGPU path copies the presentation
texture to a row-aligned buffer before presentation, maps it asynchronously, and
converts BGRA output when needed; it does not assume a preserved swapchain.

The frame UBO is 116 floats / 464 bytes, identically laid out in std140 and WGSL.
Surface vertices have a 68-byte stride; instanced edges have an 84-byte stride. Most
style, lighting, width, background and alpha switches update uniforms only. Crease
smoothing, section topology and document/selection changes rebuild/upload their
required data. This is not a claim that every possible change is upload-free.

Framebuffer budgets are conservative: 96 MiB on coarse-pointer layouts and 256 MiB
on desktop, with per-axis texture/renderbuffer limits. AO, shadow and OIT targets are
allocated at useful resolution only when enabled. Draft/Balanced/High also cap pixel
counts. Budgets exclude CAD vertex data, JavaScript scene objects and browser-owned
swapchain/overlay allocations; total application memory may be higher.

The Canvas fallback performs depth rasterization, clipping, perspective-correct
interpolation, the same surface styles, weighted transparency, AO, shadow sampling
and width/dash-aware edges. It has smaller 240k/600k/1.2M software pixel caps and scales
to the output canvas. Edge iteration is a major-axis strip scan rather than scanning
a diagonal edge's entire bounding rectangle. Software shading is still CPU work and
is not a promise of mobile 60 fps. `frameMs` measures CPU processing/submission time,
not completed GPU execution; `passes` reports GPU render passes actually scheduled
(or the software stage inventory).

## Public API

```js
import {
  SpatialRenderer, VISUAL_STYLES, normalizeDisplaySettings, createRenderingStudy
} from '@conduitcad/renderer3d';

const renderer = new SpatialRenderer(document.querySelector('#viewport'), {
  backend: 'auto',
  onStatus: status => console.log(status.backend, status.reasons ?? [])
});
await renderer.ready;
renderer.setDocument(createRenderingStudy());
renderer.setDisplaySettings(normalizeDisplaySettings({
  style: 'realistic-edges',
  environment: 'studio',
  shadows: true,
  ambientOcclusion: true,
  ground: true,
  quality: 'balanced'
}));
renderer.section = { normal: { x: 0, y: 0, z: 1 }, offset: 12 };
renderer.fit();
const image = await renderer.capturePNG({ annotations: false });
console.log(VISUAL_STYLES.map(style => style.id), image.size);
// Dispose when the owning view is removed.
renderer.dispose();
```

## Interchange and boundaries

Material coefficients, named presets and drawing defaults use Conduit application
metadata. Native DXF color, transparency and MESH geometry remain native. This release
does not parse/evaluate or author Autodesk `MATERIAL`/`VISUALSTYLE` object semantics,
texture assets, render lights or a proprietary rendering database. Record-preserving
DXF retains original unknown records under its existing safe-edit contract.

Supported mesh/face/curve display is not universal entity coverage. Existing spatial
HATCH, external texture/XREF/underlay resolution, full font/Bigfont/MTEXT fidelity,
annotative plotting and ACIS surface interpretation are not completed here. Labels
are existing screen-space overlays rather than depth-tested 3D font geometry. Geometry
budgets, faceted curves, ambiguous/non-manifold caps and weighted transparency have
explicit limits. Large-world rebasing reduces Float32 cancellation, but geometry whose
own extents span extreme scales can still exceed useful GPU precision.

### Primary design references

- Autodesk, About Using Visual Styles:
  https://help.autodesk.com/cloudhelp/2021/ENU/AutoCAD-Core/files/GUID-F9113233-6798-4F5C-9A9F-7BA41CFA2533.htm
- Autodesk Fusion, drawing visual styles:
  https://help.autodesk.com/cloudhelp/ENU/Fusion-Drawing/files/GUID-563C4B88-4312-4909-812F-DCFD73505086.htm
- W3C, WebGPU Shading Language / arithmetic expressions:
  https://www.w3.org/TR/WGSL/#arithmetic-expr

These references inform the UI semantics and shader-language contract, not a claim
of Autodesk implementation or visual/pixel parity. See the separate
[validation record](VALIDATION_RENDERING_0100.md) for exactly which backends executed.
