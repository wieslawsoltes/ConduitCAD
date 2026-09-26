# Iconography validation — 0.9.1

Source checkpoint: `578b42c1d63dc0e573fd9a2be72ca9dd88881d3b`.
Final source, distribution and touch evidence: `a8846683c5d0aead438c1e37a444e7f012d42d1e`.
Build: `d8e4c887c7bd`. Nineteen reusable packages, all version 0.9.1.

Full regression run: https://github.com/wieslawsoltes/ConduitCAD/actions/runs/36266594146
Final touch typography run: https://github.com/wieslawsoltes/ConduitCAD/actions/runs/36266884229

## Recorded results

- 602 Node tests passed, zero failures/cancellations/skips. Eleven new icon tests supplement the 591 inherited tests.
- The inherited 1,064 integrated browser assertions passed in the full run. The final icon suite has 146 passing assertions; the 485-assertion mobile suite also passed again after the last typography refinement. The complete suite inventory is 1,210 assertions, excluding the separate smoke and rendering-backend suites. The permanent Pages pipeline reruns this complete inventory on the publication commit.
- The icon suite ran through localhost with actual browser input at 1728×1000, 320×568, 390×844, 844×390 and 1024×768. It checks real tool/camera activation, state-specific glyphs, native document names, timeline selection, stable DOM nodes, field and export icons, responsive bounds, 44-pixel touch controls, readable preference text, label persistence, storage-denial handling, guide filtering and keyboard tooltip lifecycle. It records no uncaught page errors.
- All 19 package archives passed empty-cache offline installation/import. Strict TypeScript consumers compiled. The standalone and hosted applications embed the same SVG package.
- The existing native DXF, dimensions, parametric editing, drawing tools, symbol masters, starters and 3D audits passed. In particular, all 26 3D example DXFs passed 866 independent checks using ezdxf, with zero errors or repairs.

The package registry and guide cover 180 original glyphs. `docs/icon-atlas.html` is generated from the registry, not a separate set of placeholder drawings. The 223 engineering symbol masters are unchanged by this UI update.

## Evidence and limits

The final icon interaction report is `artifacts/iconography-browser.json`. Package contracts are recorded in `artifacts/package-consumer.json`; unit results are in `artifacts/ci-unit-tests.log`. Existing reports retain their own test-adapter declarations. Local opaque-origin runs used an explicit memory adapter and are not evidence of native storage durability. The separate native IndexedDB/Web Locks suite remains enabled on localhost.

The rendering regression executed Canvas software depth, WebGL2 and WebGPU on Chromium 143.0.7499.4 using Google SwiftShader Vulkan, not physical GPU hardware. It retained fixture-level mask IoU of 0.965671 for WebGL2 and 0.965186 for WebGPU, context/device-loss recovery and stable geometry uploads during camera-only changes. This is the existing 2,798-triangle fixture, not a new hardware performance claim. See `artifacts/modeling3d-backends.json`.

Screenshots and emulated touch checks do not certify physical iOS/Android, actual OS keyboards/IME, native screen readers or comprehensive WCAG conformance. No CAD geometry kernel or engineering symbol geometry changed in this release.

## Publication and reproduction

The complete source was pushed before validation. The interrupted prefix yielded 36 hash-verified complete file patches; the missing integration and tests were explicitly completed in this continuation. See [behavior and provenance](ICONOGRAPHY.md). Three temporary recovery/import workflows are removed by the final publication; regular CI retains read-only repository permissions and gates Pages on the new icon regression suite in addition to all previous checks.

Reproduce with `node scripts/bootstrap.mjs`, `npm test`, `npm run icons`, `npm run build`, `npm run pack:packages`, `node scripts/verify-packages.mjs`, and the browser/audit scripts. Use `CONDUIT_TEST_ORIGIN=localhost` for native-origin suites. The standalone atlas works offline. The live deployment is checked against reproduced SHA-256 hashes after the Pages action completes.
