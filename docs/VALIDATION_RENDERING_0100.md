# Rendering checkpoint validation — 0.10.0

**This is a local implementation checkpoint, not a published release.** The remote
baseline is `f4823402d7ba6cb7b7186ee60bf32a5f7e8b1080`, whose tree
`944301b9c15dcc0993e6d6f3126b3f5839981d6b` was verified against the supplied 0.9.1
source archive. The baseline commit object was also reproduced and hash-verified
from its GitHub metadata so the new local commit is a genuine descendant. No remote
branch, pull request, GitHub Actions run or Pages deployment was created in this pass.

Build: **`f628438ce42b`**. All nineteen package manifests and package archives are
version **0.10.0**. Raw final evidence is in `artifacts/rendering-validation/` and the
JSON reports named below. The external delivery verification identifies the exact
local commit, Git tree, bundle prerequisite and artifact checksums.

## Executed validation

| Check | Recorded result |
|---|---|
| Node unit tests | 671 passed, zero failures, cancellations or skips; 69 new rendering tests |
| Inherited integrated browser assertions | 1,202 passed in this local origin configuration |
| New display/material/mobile assertions | 93 passed, zero uncaught page errors |
| New rendering/backend assertions | 120 passed, zero uncaught page errors |
| Integrated local browser assertion inventory | 1,415; excludes the separate smoke configurations |
| New material-study DXF audit | 348 independent checks across ASCII and binary DXFs; zero errors or repairs |
| Existing 3D example DXF audit | 866 independent checks across 26 files; zero errors or repairs |
| Package integration | All 19 archives installed/imported with an empty cache and no registry access |
| TypeScript consumers | Strict compilation passed with TypeScript 5.8.3 |

The inherited browser inventory is workflows 29, fidelity 14, symbols 33,
interoperability 25, CAD editing 24, parametric 39, drawing tools 83, documents 55,
adaptive mobile 485, modeling 186, face authoring 83 and iconography 146. This is
**not** the 1,210 native-origin inventory of the preceding release: eight native-origin
checks are unavailable in the local opaque-origin setup and are not counted as passes.
The new backend inventory includes one explicit assertion that unavailable WebGPU
is reported honestly; it is not a successful WebGPU rendering assertion.

The smoke configurations and previous DXF/fidelity/symbol/dimension/parametric/drawing
example audits also passed. Their individual reports retain their own scope. Older
release reports and images retained from 0.9.1 are historical; no prior WebGPU or Pages
verification is evidence for this new graph.

### Canvas and WebGL2: executed, not substituted

`artifacts/render-backends.json` records actual backend identities, driver details,
style image hashes, diagnostics and pixel-comparison measurements. Canvas/software
depth and WebGL2 both produced sixteen distinct nonempty style frames. WebGL2 executed
through Chromium 144 / ANGLE / Google SwiftShader Vulkan, with four-sample MSAA.
This is a software GPU adapter, not a physical-device benchmark.

The 16-style orthographic comparison fixture contains 2,798 triangles. All images
have matching dimensions. The declared limits are mean absolute RGB-channel error
below 5 on the 0–255 scale and foreground-mask F1 above 0.94 with two-pixel edge
slack. The observed worst mean channel error is **1.156980** and the lowest mask F1
is **0.998616**. These are fixture-level, AA-tolerant comparisons, not universal
pixel equivalence. Per-style comparison disables shadows and AO; separate checks
verify that each effect changes real pixels, rather than asserting cross-backend
shadow/AO pixel equality.

The suite also exercises cap visibility, weighted transparency under reversed
submission order, perspective near-plane crossings, camera-only upload stability,
WebGL context loss/restoration and a **simulated** attachment-allocation failure
that must fall back to a working Canvas renderer without changing the document or
style. The failure injection is labeled simulated in the report. The old native-only
backend report is explicitly marked `not_executed_for_0.10.0` and points to this
newly executed suite instead of retaining misleading current-release GPU claims.

### WebGPU: implemented, execution outstanding

The WGSL programs, four-sample render graph, optional depth/AO/shadow/OIT targets,
error reporting, device-loss fallback and asynchronous row-aligned PNG readback are
included. **They have not been compiled or executed by a WebGPU implementation in
this environment.** Static unit contracts and source review do not establish shader
compilation or backend correctness.

The managed browser blocks localhost navigation and the permitted standalone
`set_content` context is not a secure WebGPU origin. No browser policy was changed.
The backend report explicitly shows the WebGPU request falling back to WebGL2 with
`executed: false` and `gpuAvailable: false`; this fallback is not counted as WebGPU
success. CI now requires `REQUIRE_WEBGPU=1` in the new native-origin backend suite,
in addition to the existing native backend suite. **That updated CI has not run.**
Do not deploy as a GPU-qualified release until the native-origin gate passes.

### UI, storage and interchange scope

`artifacts/render-styles-browser.json` covers real button/field input, search,
preview/cancel/keep, camera restoration, independent document styles and section
planes, named presets/defaults, native appearance updates, material undo/redo,
invalid-value atomicity, commands, the editable nineteen-object material study and
an actual viewport PNG download. Desktop/touch layouts are 1440×980, 320×568,
390×844, 844×390 and 1024×768. Small-screen comparisons exercise the compact
Preview model/Show options controls and exact restoration of the working camera.

Tests use an explicitly declared memory Web Storage adapter in an opaque origin.
They do not establish native IndexedDB/Web Locks isolation, service-worker updates,
crash/eviction durability or secure-origin behavior. The full native-origin suites
remain in CI. All UI screenshots are browser-emulated, not physical iOS/Android
or OS keyboard/screen-reader acceptance. CPU `frameMs` is not GPU completion time.
Framebuffer estimates exclude geometry, JavaScript state and browser-owned buffers.

`artifacts/rendering-dxf-audit.json` records ezdxf 1.4.4 checks of both material-study
DXFs: native vertex/face values, topology, closed oriented incidence, positive volume,
true color, native 8-bit transparency and application-data presence. The native
project has nineteen editable Conduit mesh features. Material coefficients and
drawing display defaults use Conduit metadata; native Autodesk MATERIAL/VISUALSTYLE
objects and native AutoCAD/Fusion application acceptance were **not** validated.

## Reproduction and delivery

```sh
node scripts/bootstrap.mjs
npm test
npm run samples:rendering
npm run build
npm run pack:packages
node scripts/verify-packages.mjs
npx --yes --package typescript@5.8.3 tsc -p tests/tsconfig.json
python tests/browser_render_styles.py
python tests/browser_render_backends.py
python tests/audit_rendering.py
npm run gallery:rendering
```

Native CI sets `CONDUIT_TEST_ORIGIN=localhost` and runs the GPU test using Xvfb with
`REQUIRE_WEBGPU=1`. The offline gallery embeds actual Canvas/WebGL2 captures; its
style cards are not presented as screenshots from an unexecuted backend.

GitHub write actions were not exposed in this turn. A direct Git transport probe
also failed to resolve `github.com`. The delivery includes a real descendant commit
in an incremental Git bundle, the complete source ZIP, standalone HTML and a patch.
Use a clone containing the stated prerequisite commit to fetch the bundle and push
its feature branch without a force update. The external verification record reports
the exact attempted push and clean-check results.

See [rendering behavior and limits](RENDERING_3D.md). These are real-time viewport
styles with faceted geometry, procedural environments and weighted transparency,
not a complete AutoCAD/Fusion offline renderer, curved ACIS pipeline, texture/HDR
system, traced reflection/refraction, global illumination or full plotting engine.
