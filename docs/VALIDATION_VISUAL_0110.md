# Visual 3D editing validation — 0.11.0

This is a **local source checkpoint, not a confirmed GitHub/Pages deployment**.
It descends from the retained 0.10.0 rendering commit
`fac5b114ffc811989136e908978fcd6cf3574397`; the published GitHub baseline remains
`f4823402d7ba6cb7b7186ee60bf32a5f7e8b1080`. The visual source checkpoint is
`90b82b7`. The external delivery verification identifies the final commit/tree and
exact archive hashes without introducing a circular commit reference in this file.

Build: **`fd7319607de6`**. Twenty reusable packages, all **0.11.0**.
Raw final command logs and exit codes are in `artifacts/visual-validation/`.
All **41 recorded final commands** completed with exit zero, including a production
build, package contracts, browser suites, independent audits and actual UI captures.
The aggregate is `artifacts/visual-validation/summary.json`.

## Executed checks

| Area | Result |
|---|---|
| Node tests | 752 passed, zero failures/skips; 81 new manipulation tests |
| Inherited CAD browser inventory | 1,202 passing assertions in the local origin configuration |
| Display/material/mobile suite | 93 passing assertions |
| Existing rendering/backend suite | 120 passing assertions; Canvas and WebGL2 executed |
| New default visual editor, Canvas | 157 passing assertions, no uncaught page errors |
| New default visual editor, WebGL2 | 157 passing assertions, no uncaught page errors |
| Integrated local assertion inventory | 1,729; excluding separate smoke configurations |
| New UI-produced native DXFs | 93 independent checks across 12 real browser downloads |
| Existing 3D examples | 866 independent checks across 26 DXFs |
| Retained material study | 348 independent checks across two DXFs |
| Package installation/import | 20 archives, empty cache, offline, no registry access |
| Typed consumers | Strict TypeScript 5.8.3 compilation |

The 1,202 inherited assertion inventory is workflows 29, fidelity 14, symbols 33,
interoperability 25, CAD editing 24, parametric 39, drawing tools 83, documents 55,
adaptive mobile 485, modeling 186, face authoring 83 and iconography 146.
**Eight native-origin-only inherited checks were not executed** and are not included
as passes. This is not the 1,210 native-origin count of the published 0.9.1 release.
Older reports retained from earlier releases are historical, not fresh WebGPU or
storage qualification for this checkpoint.

## What the new editor tests actually exercise

`tests/manipulation3d.test.mjs` verifies isolated source/preview identity, revision
caching, expression-preserving movement, stale-source rejection, local undo/redo,
fixed/multiple input arity, wrong/locked/duplicate sources, atomic failure,
near-parallel axis fallback, invalid rays/planes, orthographic and perspective
movement, frozen camera state, large coordinate origins and multi-turn angular
unwrapping. It also checks arbitrary face directions, OCS-normal and two-sided
extrusion factors, hole diameter factors, ground-plane profiles, pivoted transforms,
rotated scale axes, feature-vertex detachment, downstream regeneration and
collision-separated projected control layouts.

`tests/browser_visual_editing.py` runs **the default visual interaction**, not the
legacy dialog opt-in. Both backend runs assert that the requested Canvas/WebGL2
renderer actually executed, then exercise real mouse, keyboard and CDP touch input:

- Non-modal palette, all 22 tool entries, filtering and empty state.
- Actual world-distance size drag, face-local planar drag, rotation ring drag,
  exact expressions and keyboard slider increments.
- Correctable invalid geometry/expressions; no stale preview or unintended Apply.
- One accepted feature/history transaction, normal undo/redo, draft-local history,
  no-op existing-feature acceptance, canceled drafts and external-change rejection.
- Native canvas face/source selection, counterbore controls, vertex detachment,
  new-body center pivots, rotated scale and native sketch/two-sided extrusion.
- Explicit Advanced handoff preserving parameters rather than silently resetting them.
- Active visual editing under all sixteen retained rendering styles.
- Canceling on 2D/document switching without altering the live document.
- Five touch sizes: 320×568, 390×844, 844×390, 820×1180 and 1024×768, plus desktop.
- 44-pixel controls, 16-pixel exact/options fields, viewport bounds, no autofocus
  keyboard on palette open, and fixed Apply/Cancel under explicit text-label mode.
- Collision checks proving dimension badges do not cover handle hit targets.
- A **synthetic** reduced visual-viewport event, active input bounds and focus return.
- Actual two-finger takeover: the partial handle draft rolls back before navigation;
  trailing touch release cannot place or accept geometry.

Three inherited suites (`browser_modeling3d`, `browser_authoring3d` and
`browser_iconography`) explicitly opt into `modelingInteraction='dialog'` to retain
coverage of the optional Advanced workflows. That opt-in is commented in those
files. Their continued passing does not substitute for the new default editor suite.
Geometry, evaluator, history and exports in the new suite are not mocked.

## Independent DXF readback

`tests/audit_visual_editing.py` reads the twelve actual UI downloads with **ezdxf
1.4.4**. Each backend exports a counterbored plate, a centered rotated/scaled body
and a two-sided extrusion, each as ASCII and binary. The audit verifies successful
native reopening, zero audit errors/repairs, expected native mesh counts, finite
XYZ coordinates, preserved native profile geometry and the absence of fabricated
`3DSOLID` entities. Independent triangulated-volume and bounding-box calculations
check the accepted hole recess, rotated pivot/scale and signed extrusion extents.

Both execution paths retain editable Conduit feature metadata. The audit is not a
native AutoCAD/Fusion application test or proprietary feature-graph certification.
Old symbol, dimension, parametric, drawing-tool and interoperability audits passed
again; they retain their individual declared scope.

The clean offline package consumer now creates a VisualEditSession from the
**installed archive**, retains a Width expression through a drag, confirms the source
is unchanged during preview, commits and reopens native DXF, and packs an accessible
handle layout. Merely importing the package is not the sole integration check.

## Rendering, input and storage limits

The new editor ran on Canvas software depth and WebGL2 through **Chromium 144 /
ANGLE / Google SwiftShader Vulkan under Xvfb**. This is a software GPU adapter, not
physical hardware. The inherited sixteen-style comparison, context restoration,
simulated resource-allocation failure, transparency and rendering lifecycle checks
passed again. The visual editor test verifies active controls and source isolation
under each style; it does not add a new universal pixel-equivalence claim.

The updated **WebGPU rendering graph remains unexecuted locally**, as in 0.10.0.
The managed browser blocks localhost navigation. The allowed standalone/set_content
harness declares an explicit in-memory storage adapter and does not change browser
origin policy. Its WebGPU fallback is recorded as **executed: false**, not a WebGPU
success. No physical iOS/Android device, real OS keyboard/IME, native screen reader,
service-worker lifecycle, durable IndexedDB/Web Locks recovery or crash/eviction
behavior is certified by these local results.

CI retains the native-origin gates. It now requires the default visual suite on
Canvas, WebGL2 **and actual WebGPU**, along with `REQUIRE_WEBGPU=1` rendering tests,
native recovery and all existing audits before deployment. **That updated workflow
has not run remotely.** Do not describe this as a published GPU-qualified release.

## Reproduction

```sh
node scripts/bootstrap.mjs
npm test
npm run build
npm run pack:packages
node scripts/verify-packages.mjs
tsc -p tests/tsconfig.json
python tests/browser_visual_editing.py
VISUAL_TEST_BACKEND=webgl2 xvfb-run -a python tests/browser_visual_editing.py
python tests/audit_visual_editing.py
```

On an ordinary allowed localhost/HTTPS test host, set
`CONDUIT_TEST_ORIGIN=localhost`; add `VISUAL_TEST_BACKEND=webgpu` for the genuine
WebGPU run. Do not count fallback as success. Linux GPU comparisons need the Xvfb
configuration provided in the workflow. `tests/capture_visual_editing.py` captures
actual production UI; it does not composite illustrative overlays.

The complete source ZIP and Git bundle include **both unpublished 0.10 and 0.11
work**, all twenty package archives and the built standalone application. The
external verification records clean extraction, exact tree contents and deterministic
application rebuilding. It separately records the attempted Git transport and
publication status. No external font files or remote assets are required.

See [the interaction/architecture guide](VISUAL_EDITING_3D.md) for the synchronous
preview cost, cancellation contract, retained specialist dialogs and faceted-kernel
boundaries. This is not complete Fusion/AutoCAD, associative sketch or ACIS parity.
