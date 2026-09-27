# Live workspace validation — 0.13.0

Validated source and generated deliverables: `f4e2afbd6c556d41f63f8eadda7ace0e3b7b4650`.
Build: `7f9016923076`. Twenty-one reusable packages, all version 0.13.0.

Full qualification: https://github.com/wieslawsoltes/ConduitCAD/actions/runs/36351622769

## Recorded checks

- 893 Node tests passed, zero failures, cancellations or skips. The previous published
  0.12.0 checkpoint had 838: this release adds 55 live-workspace unit tests.
- The 113-assertion live parameter/path suite passed separately on Canvas, WebGL2
  and WebGPU. The inherited 176-assertion planar/spatial-inspection and 157-assertion
  spatial manipulation suites also passed on each requested 3D backend. The planar
  scene itself uses Canvas 2D in these three configurations.
- The 193-check rendering suite executed all sixteen display styles on the three
  APIs, including pixel comparisons, transparency, shadows, section caps, resource
  restoration and required WebGPU execution. Fallback is never counted as successful
  execution of a requested GPU backend.
- The 485-assertion mobile UI suite and the 61-assertion document/recovery suite passed.
  All remaining inherited browser, editing, iconography, authoring and DXF suites passed.
- Fourteen live-workspace DXFs (two generated workshop files and twelve actual browser
  downloads) passed the independent ezdxf audit with zero errors or repairs. Native
  WCS vertices, close flags, expressions and evaluated parameter geometry were checked.
  The inherited planar/spatial-inspection audit passed 408 checks, spatial visual
  authoring 139, material studies 348 and 3D starters 866, alongside all older audits.
- All 21 package archives passed clean, empty-cache offline installation/import.
  Strict TypeScript consumers compiled against the public declarations.

The focused live suite exercises actual parameter scrubbing, exact expressions,
dependency and stale-source errors, draft and document history, native XYZ dragging,
point insertion/removal/closure/reversal, physical-vertex selection through undo,
workplane entry, downstream sweep regeneration and browser DXF downloads. Viewports
include 1440×1000, 320×568, 390×844, 844×390 and 1024×768. Revision-cache tests assert
immutable coordinate reuse under repeated camera-only projection requests.

## Capture regression and execution scope

Qualification caught an intermittent empty WebGPU image in the older backend fixture.
That test awaited queue completion and then read a presentation-owned canvas buffer.
The shared harness now calls the existing production `capturePNG({annotations:false})`
contract: draw and enqueue the texture-to-buffer copy before awaiting its map. The
fixture additionally requires opaque, nonempty pixels and three byte-identical
captures, each following two animation frames. The original image thresholds remain
unchanged; there is no retry-until-nonempty loop or backend substitution.

This follows the automatic-expiry behavior of canvas textures documented by WebGPU:
https://www.w3.org/TR/webgpu/#automatic-expiry-task-source
No renderer geometry or material semantics were relaxed to make a comparison pass.

The GPU adapter is Google SwiftShader on Chromium 143.0.7499.4, not physical GPU
hardware. The newly added suites ran on localhost with native origin. Historical
suites retain their explicit memory adapters where documented; a successful form
interaction alone is not evidence of storage durability. Native IndexedDB/Web Locks
recovery has a separate suite. Local opaque-origin checks remain separately labeled.

Physical iOS/Android, actual OS keyboards/IME, native screen readers, hardware frame
rates and acceptance in Autodesk applications are unqualified. Test assertions and
software raster comparisons do not establish universal DXF, B-rep or pixel parity.

## Evidence and reproduction

- `artifacts/live-workspace-{canvas,webgl2,webgpu}.json`: interaction results and scope.
- `artifacts/live-publication-*.log`: complete qualification logs, including old suites.
- `artifacts/live-publication-unit.log`: all 893 unit results.
- `artifacts/audit-live-workspace.json`: independent native DXF checks.
- `artifacts/render-backends.json` and `artifacts/modeling3d-backends.json`: GPU execution,
  pixel comparisons, adapter information and capture lifecycle checks.
- `artifacts/package-consumer.json`: isolated package consumer validation.
- `samples/live/`: native, ASCII DXF and binary DXF workshop drawings.

Run `node scripts/bootstrap.mjs`, `npm test`, `npm run build`, `npm run samples:live`,
`npm run pack:packages`, and `node scripts/verify-packages.mjs`. Browser/audit commands,
backend variables and required native-origin execution are recorded in the permanent
`.github/workflows/pages.yml` gate. It rebuilds and validates before deploying, then
compares live production bytes against a reproduced build.

## Source publication

The interrupted 0.13.0 import recovered all 59 source paths with their expected Git
identities. Its initial Actions push was correctly refused because it included a
workflow-file change. The authorized GitHub connection attached that source commit
(`5466a546a74be0a9e1690d2eb0d8d7faefabb4f4`) without replaying or dropping the source.
Subsequent source refinements add guarded reversal, history selection, coordinate
caching and capture validation. The final publication removes both temporary import/
qualification workflows. The regular pipeline has read-only repository permissions.

Previously pending 0.10–0.12 rendering and visual editing work is already part of the
published ancestor `4b1050ab552d1a26ae961e4a158eca2c4c5625c8`. No manual bundle import
is necessary. Earlier validation documents preserve their original execution scope.
See [workflows, APIs and boundaries](LIVE_PARAMETERS_PATHS_0130.md).
