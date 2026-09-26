# 3D authoring validation — 0.9.0

Validated source and distribution: `8b6917f3b2e0fc1e95b3212cff64bc6e362d0cb4`.
CI: https://github.com/wieslawsoltes/ConduitCAD/actions/runs/36259490036
Build: `c3502f220df1`. Eighteen packages, all version 0.9.0.

## Recorded results

- 591 Node tests passed, zero failures/cancellations/skips. This is 70 more than the 0.8.0 checkpoint: 67 authoring tests plus three additional examples covered by inherited parameterized cases.
- 1,064 integrated browser assertions passed: 247 inherited editing/fidelity assertions, 61 document/recovery assertions, 485 adaptive mobile assertions, 188 inherited 3D assertions and 83 new face/extrusion/hole authoring assertions. The separate smoke and backend suites also passed.
- All 26 example DXFs (13 ASCII and 13 binary) passed 866 independent checks using ezdxf 1.4.4. No audit errors or repairs. Existing DXF, dimension, parametric, drawing-tool, symbol and starter audits also passed.
- Strict TypeScript consumers and empty-cache offline installation/import of all eighteen package archives passed.
- Thirteen editable 3D examples produce 39 committed files: native projects, ASCII DXFs and binary DXFs. Hole workshop, extrusion extents and face-mounted boss are new.

Raw reports, screenshots and logs are committed under `artifacts/`. The new browser suite exercises actual face picking, relevant-field forms, expression-preserving choices, preview invalidation, creation/editing, upstream changes, undo/redo, contextual commands, timeline focus, mode hints and the return to 2D. Its mobile cases cover 320×568, 390×844, 844×390 and 820×1180. The broader mobile suite also covers 1024×768 and desktop.

CI runs the native-origin-capable suites through localhost. Historical suites retain their explicit memory adapters where documented; a successful browser interaction does not imply durable storage. Native IndexedDB/Web Locks recovery has its own separate suite. Local opaque-origin runs use an explicit test storage adapter and are not presented as native-origin evidence.

## Rendering scope

The retained backend suite executed Canvas software depth, WebGL2 and WebGPU without silently substituting a fallback for the requested backend. Chromium 143.0.7499.4 used Google SwiftShader Vulkan with Xvfb, not physical GPU hardware. The 2,798-triangle orthographic primitive fixture achieved filled-mask IoU of 0.965671 (WebGL2) and 0.965186 (WebGPU) against the software reference. Both had 1.0 flat-interior agreement under the documented tolerance. WebGL context restoration, WebGPU device-loss fallback and camera-only upload-count stability passed.

This is fixture-level API/rendering validation, not universal pixel equivalence or a new hole-specific GPU benchmark. `frameMs` is CPU work/submission time, not measured GPU completion. The new authoring interaction suite uses the Canvas software-depth renderer.

Physical iOS/Android hardware, actual OS keyboards/IME, arbitrary screen readers, native AutoCAD/Fusion acceptance, crash/eviction durability and hardware performance remain unqualified.

## Publication notes

The first source checkpoint was pushed at `93857204a7ef757214c8ff6f6b5ff8c353584731`. The first CI run correctly stopped when an inherited catalogue assertion still expected ten instead of thirteen 3D starters. That assertion now checks the generated identities, uniqueness and presence of all new starters, rather than suppressing a failure. Final polish also preserves expression-driven choice values and keeps Orbit/Pan/selection instructions synchronized.

The final publication removes both temporary source-import workflows and adds `tests/browser_authoring3d.py` to the permanent Pages gate. The normal pipeline retains read-only repository permissions and does not author commits. The generated website is deployed only after validation, then checked against reproduced file hashes.

See [authoring behavior and limits](AUTHORING_3D_090.md). This is a faceted mesh feature engine: no curved ACIS/native 3DSOLID, threads/drill tips, To Object extrusion, complete associative face sketching, universal persistent face naming or proprietary Autodesk feature graphs are claimed.
