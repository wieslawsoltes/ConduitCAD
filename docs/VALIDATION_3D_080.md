# 3D publication validation — 0.8.0

Validation run: https://github.com/wieslawsoltes/ConduitCAD/actions/runs/36244014497
Validated source, distribution and evidence commit: `2d641d9f7b0ccf83a8b7951464ca6f2bfffa3827`.
Build identifier: `e345bb49c59e`. All eighteen packages are version 0.8.0.

## Recorded results

- 521 Node tests passed, with zero failures, cancellations or skips. These include 460 inherited tests, 28 complete cases recovered from the interrupted test file, and 33 explicitly new recovery-time regressions.
- 981 integrated browser assertions passed: 247 inherited editing/fidelity assertions, 61 document/recovery assertions, 485 adaptive mobile assertions and 188 new 3D assertions. The separate smoke and backend suites also passed. Counts are assertions, not device counts.
- All twenty 3D example DXFs (ten ASCII and ten binary) passed 686 independent checks with ezdxf, with zero audit errors or repairs. Existing dimension, parametric, interoperability, drawing-tool, symbol and starter audits also passed.
- Strict TypeScript consumers and empty-cache offline installation/import of all eighteen npm archives passed.
- The thirty generated example files include ten native projects with editable Conduit feature history, ten ASCII DXFs and ten binary DXFs under `samples/3d/`.

## Backend evidence

The backend suite executed Canvas software depth rendering, WebGL2 and WebGPU without substituting fallback for a requested backend. Chromium 143.0.7499.4 used the Google SwiftShader Vulkan software adapter, not physical GPU hardware. Linux execution used Xvfb and explicitly configured Vulkan compositing. Browser version, adapter identities, launch arguments and comparison values are recorded in `artifacts/modeling3d-backends.json`.

For the 2,798-triangle orthographic primitive scene, filled-mask intersection-over-union was 0.965671 for WebGL2 and 0.965186 for WebGPU versus the software reference. Both had 1.0 flat-interior agreement under the four-channel-value tolerance. These AA-tolerant checks apply to this fixture only, not arbitrary drawing equivalence. WebGL context restoration and WebGPU device-loss fallback to WebGL2 passed. Camera-only navigation preserved geometry upload counts.

The `frameMs` field measures CPU submission/rasterization work, not GPU completion time. Software-adapter execution is not a hardware performance benchmark. Physical iOS/Android, actual OS keyboards, screen readers, driver diversity and native AutoCAD/Fusion acceptance are not qualified by these results.

## Publication and provenance

The source checkpoint was pushed before validation at `2e247f366165e0467491fb143351d7a274e5d947`. The original 56 complete file patches matched their original target Git hashes; the truncated test tail was not invented. See [publication provenance](PUBLICATION_3D_080.md) and the recovered-file ledger. Later repairs remove stale feature metadata after direct vertex edits and preserve explicitly opened mobile sheets across queued breakpoint updates.

The final publication installs the permanent Pages gates and removes temporary recovery/import workflows and payload files from the current tree. Original payloads remain in Git history. Normal CI retains read-only repository permissions and does not author commits.

Reproduce with `node scripts/bootstrap.mjs`, `npm test`, `npm run samples:3d`, `npm run build`, the browser scripts, and the audit scripts. On Linux, run the GPU comparison with `xvfb-run -a python tests/browser_modeling_backends.py`. Use `CONDUIT_TEST_ORIGIN=localhost` for native-origin suites; explicitly stubbed historical suites retain their documented test-adapter behavior.

This publication contains a mesh-based editor with Conduit feature history. It does not claim full AutoCAD/Fusion, curved ACIS B-rep, native 3DSOLID authoring, or proprietary feature-graph parity. See [3D capabilities and boundaries](MODELING_3D.md).
