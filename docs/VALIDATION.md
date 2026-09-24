# Validation record — Conduit CAD 0.2.0

Implementation, unit tests, browser checks, independent format validation and
hardware certification are separate claims. Raw reports are in `artifacts/`.

## Executed release checks

`npm test`: **124 passing Node tests**. The 38 added fidelity regressions include
native clockwise/counterclockwise hatch edges, rational spline loops, island
styles, patterns, count/density guards, tapered bulge widths, mesh vertices and
indices, OCS projection/edit rollback, text attachments/masks/styles, signed
dash/opacity data, infinite lines, SVG holes and all 64 symbol terminals.
`artifacts/ci-unit-tests.log` records the complete current run.

`python tests/browser_workflows.py`: **29 passing integrated checks** for
selection, drawing, dragging, routing, parameter rollback, history, mobile tap
placement, pinch arbitration, portrait/landscape and export-dialog options.

`python tests/browser_fidelity.py`: **14 passing checks**, including actual File
API/worker import of the independent 37-entity drawing, pixel assertions for
ordered solid hatches/holes/nested islands, filled-area versus hole picking,
actual ruler-strip clipping, ruler input exclusion, native CDP touch dragging
from a library grab handle and mobile overflow/spacing. Both integrated suites
report no uncaught browser errors. This is 43 checks, not 43 devices/browsers.

`python tests/browser_smoke.py`: desktop/mobile layout and requested-backend
checks, screenshots and actual renderer reports. Requested WebGPU/WebGL modes
fell back to Canvas 2D. Screenshot names do not imply successful GPU execution.

`python tests/audit_fidelity.py`: an original **37-entity fixture authored with
ezDXF 1.4.4**, imported and normalized by Conduit, then reopened by ezdxf. The
script compares native edge directions and analytic endpoints, loops/styles,
patterns/gradients, widths/bulges, mesh topology/Z, text alignment/background/style
properties and transparency. The normalized file has **zero audit errors and
zero repairs**. This goes beyond testing Conduit against its own writer but is
not an AutoCAD certification or a representative corpus of all customer files.

`python tests/audit_dxf.py`: the three revised demo drawings pass the independent
audit with zero errors and repairs. `tests/generate_fidelity_fixture.py` is the
separate reproducible fixture author; tests consume the checked-in DXF/manifest.

`tsc -p tests/tsconfig.json`: strict consumer validation of all 13 packages,
including new typed hatch boundaries, OCS/text layout and compositor APIs.
The compiler is not a runtime/build dependency. Package archives are generated
with `npm run pack:packages` and installable together without a registry.

`npm run benchmark` remains a CPU-only synthetic benchmark, not a GPU timestamp,
interactive FPS test or mobile performance guarantee. Older unrelated artifact
reports retain their historical scope; the current CI log and fidelity reports
are the release evidence.

## Explicit environment limitations

The delivery browser loads the bundled standalone app through `set_content`.
Persistence is a test-only memory adapter because the origin is opaque. Real
File/Blob import and its worker are exercised, but IndexedDB durability, quota
recovery, service-worker installation/offline behavior and downloads on physical
phones are not certified. No browser security policy is disabled.

Canvas 2D executes the UI and pixel tests. WebGPU/WebGL2 shader execution, GPU
scissor correctness on actual adapters, device loss, high-density performance
and GPU/Canvas image equivalence need real hardware testing. OCS/math tests are
not proof of complete 3D/UCS editing. Symbol terminal tests are not IEC/ISA/ISO
certification.

## Reproduce

```sh
node scripts/bootstrap.mjs
npm test
npm run build
npm run pack:packages
# Optional compiler, separate from the dependency-free application:
tsc -p tests/tsconfig.json
# Optional independent/browser development tools:
python -m pip install -r tests/requirements.txt
python -m playwright install chromium
python tests/browser_smoke.py
python tests/browser_workflows.py
python tests/browser_fidelity.py
python tests/audit_dxf.py
python tests/audit_fidelity.py
```

Set `CHROMIUM_EXECUTABLE` to an existing browser. The permanent Pages pipeline
also rebuilds and checks live HTTP response hashes; see DEPLOYMENT.md for its
separate delivery contract. A matching hosted file is not a hardware render test.
