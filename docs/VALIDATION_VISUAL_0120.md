# Planar visual editing and spatial inspection validation — 0.12.0

This is a **local source checkpoint, not a confirmed GitHub/Pages deployment**.
The uploaded 0.11.0 commit `a252d13e15db7106dc66d4ed2670e94887b48608` was restored
without discarding the preceding 0.10.0 rendering commit. The verified published
baseline is still `f4823402d7ba6cb7b7186ee60bf32a5f7e8b1080`. Initial implementation
checkpoints are `d1b9659` and `e608292`; the external delivery verification records
the final commit, tree, bundle and archive hashes without circular commit references.

Build: **`c5ed4b9dfac7`**. All **21 reusable packages** are version **0.12.0**.

## Executed checks

| Area | Result |
|---|---|
| Node tests | 838 passed, zero failures/cancellations/skips; 86 new tests |
| New default 2D/spatial inspection suite | 176 assertions with Canvas software-depth 3D, plus 176 with actual WebGL2 3D |
| Inherited default visual 3D suite | 157 assertions on Canvas, plus 157 on WebGL2 |
| Inherited CAD/document/mobile inventory | 1,202 local assertions |
| Display/material/mobile suite | 93 assertions |
| Rendering/backend suite | 120 assertions; all 16 modes on Canvas and WebGL2 |
| Complete local assertion inventory | **2,081 passing assertions**, excluding separate smoke configurations |
| New native exports | **274 independent checks across 46 DXFs**, zero audit errors/repairs |
| Inherited visual 3D exports | 93 independent checks across 12 actual UI downloads |
| Existing 3D examples | 866 independent checks across 26 DXFs |
| Material study | 348 independent checks across two DXFs |
| Package integration | All 21 archives, empty cache, offline installation/import |
| Typed consumers | Strict TypeScript compilation |

The current browser inventory is in `artifacts/0120-final-summary.json`. Every
selected final run has exit code zero. Source digests confirm the same application
source was used in the final matrix and its historical visual3D reruns. Individual
commands, environment, timings and logs are recorded, not inferred from filenames.
`artifacts/0120-final-audit-runs.json` records the inherited independent audits;
`0120-final-audit_visual_editing.log` and `0120-final-audit_planar_visual.log` record
the real UI-export audits. The package report is `artifacts/package-consumer.json`.

The 1,202 local inherited assertions are workflows 29, fidelity 14, symbols 33,
interoperability 25, CAD editing 24, parametric 39, drawing tools 83, documents 55,
adaptive mobile 485, modeling 186, face authoring 83 and iconography 146.
**Eight native-origin-only inherited checks were not executed** and are not counted
as passes. Previous native-origin reports retained in Git history are not evidence
that these new changes were tested under a native origin.

## What the new tests exercise

`tests/manipulation2d.test.mjs` checks native fields, atomic edits, eligibility and
bounded inputs, weighted spline/control preservation, polyline bulges, triangle and
closed-curve duplicates, all seven managed dimension subtypes, dynamic block
parameters, exact and expression-preserving gestures, copied identities/attributes,
move/rotate/scale/offset/fillet, driver constraints, solver failure isolation,
draft undo/redo, stale source signatures and the new editable sample. Spatial math
tests cover exact WCS distances and normalized finite section-plane frames.

`tests/browser_planar_visual.py` runs the **unchanged default interaction options**,
not a dialog-compatibility override. It drives actual pointer events, touch events,
keyboard focus and form controls against the production standalone application:

- Endpoint/radius/dynamic-parameter drags and inline expression input.
- Draft undo/redo, one-transaction Apply, no-op edits, drawing undo/redo and Cancel.
- Real TEXT/MTEXT preview, weighted spline and polyline/hatch native-control edits.
- Native dimension regeneration, driver constraints and shared block authoring.
- Move/copy, rotate, scale, offset and native ARC fillet creation.
- A non-modal tool catalogue, live creation options, exact Cartesian/polar points.
- Invalid numbers, oversized input and angle-at-center gestures cannot apply an
  earlier successful preview, including via keyboard activation.
- Source-document and identity guards; mode, modal and document transitions.
- Section-plane dragging and exact offsets, real WCS surface picking, distance
  calculations, section/guide LINE output and isolated material previews.
- Material presets, sliders, exact values, invalid-coefficient handling and undo.
- Desktop and emulated touch layouts at 320×568, 390×844, 844×390 and 1024×768.
  Controls stay bounded with 44-pixel targets and 16-pixel exact-entry text.
- Two-finger takeover restores the gesture-start geometry before navigation; the
  final finger cannot place or apply geometry. A synthetic keyboard-height change
  keeps exact entry and confirmation controls reachable.

Both runs use **Canvas 2D for the planar scene**. The spatial scene is explicitly
asserted to use the requested Canvas software-depth or WebGL2 backend without
silently substituting a fallback. The suite records no uncaught page errors.

The new independent audit uses **ezdxf 1.4.4**. It opens 44 actual browser downloads
(11 fixtures × ASCII/binary × two spatial backend runs) and the two workshop DXFs.
It checks native entity families, coordinates, spline weights, bulges, MTEXT
paragraphs, linked DIMENSION graphics, fillet radius, section elevations and the
3-4-12 measurement's length of 13. It is not native AutoCAD acceptance.

## Rendering and platform boundaries

Chromium **144.0.0.0** executed WebGL2 through **Google SwiftShader Vulkan**, with
Xvfb providing a display. This is software-adapter API execution, not physical GPU
or mobile performance. The retained 2,798-triangle rendering fixture passed the
same per-style comparisons, including worst mean RGB-channel error 1.157/255 and
minimum foreground-mask F1 0.9986 with two-pixel tolerance. No universal pixel
agreement or GPU completion-time benchmark is claimed.

The new WebGPU graph is **not executed** locally. A direct localhost navigation
probe returned `net::ERR_BLOCKED_BY_ADMINISTRATOR`; no origin/security policy was
altered. See `artifacts/0120-native-origin-probe.json`. Opaque standalone-origin
runs use explicitly declared memory storage adapters or historical test stubs.
They do not establish native IndexedDB/Web Locks durability, crash recovery or
storage eviction safety for this checkpoint.

The included Pages workflow retains native-origin WebGPU requirements, adds both
new default-workflow backend runs and the independent export audit, and does not
publish before those checks pass. **No remote workflow or deployment ran here.**
Physical iOS/Android, actual OS keyboards/IME, native screen readers, driver diversity,
full accessibility certification and native Autodesk acceptance are unverified.

## Regression provenance and reproduction

Preflight results remain in `artifacts/`; the final inventory is explicitly
identified by `0120-final-summary.json`. Three historical tests that inspect their
old modal controls now opt into the retained dialog compatibility mode. The new
suite separately validates the real default non-modal paths.

A historical WebGL2 visual test initially assumed its RAF-driven geometry and ARIA
refresh would finish within a fixed 55/120 ms sleep. It now awaits the actual
completed frame and retains the exact numeric, ARIA and single-coalesced-evaluation
assertions. Both Canvas and WebGL2 reruns passed all 157 assertions. Initial logs and
`0120-PROVENANCE.md` disclose those scheduling failures rather than counting them
as successful runs.

Reproduce the local source checks with:

```sh
node scripts/bootstrap.mjs
npm test
npm run samples:visual2d
npm run build
npm run pack:packages
node scripts/verify-packages.mjs
tsc -p tests/tsconfig.json
python tests/browser_planar_visual.py
PLANAR_TEST_BACKEND=webgl2 xvfb-run -a python tests/browser_planar_visual.py
python tests/audit_planar_visual.py
```

Use `CONDUIT_TEST_ORIGIN=localhost` in an environment permitting localhost browser
navigation to exercise native storage and WebGPU. The pure inspection math and
planar session are reusable; whole-document cloning/solving remains synchronous
and bounded as documented. [Workflow and remaining boundaries](VISUAL_EDITING_2D_3D_0120.md)
include XY-only planar eligibility, explicit guards on 3D-feature-owned/consumed
sources, non-associative section/measurement snapshots and retained specialist
forms. This is not a claim that every application dialog or Autodesk workflow has
been replaced.
