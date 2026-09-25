# Validation record — Conduit CAD 0.4.0

## Dimension and parameter-action release

`npm test`: **249 passing tests**, including the prior 206 plus 43 tests for all
seven managed dimension subtypes, atomic failure, text/reset/witness edits,
associations, similarity transforms, native DSTYLE, eight actions, lookup cycles,
port/grip transforms, malformed values, metadata budgets, repeat-export pruning,
native-block preservation and LINEAR gradient angle/descriptor exchange.

`python tests/browser_cad_editing.py`: **24 passing checks**. Real inspector
changes, mouse text/parameter grips, source edits with undo/redo, visibility,
binary downloads reopened by ezdxf, red/blue gradient pixels, a transparent island,
nonuniform rotated block gradient transforms, SVG gradients and mobile controls.
The earlier 29+14+33+25 checks also pass: **125 integrated checks total**. Backend
smoke checks remain separate and report the actual fallback rather than counting
requested GPU backend names as hardware execution.

`python tests/audit_cad_editing.py`: **66 passing independent checks**. ASCII and
binary files contain seven native dimension subtypes with expected geometry,
DSTYLE fields and populated picture blocks, and two distinct evaluated native
block widths. Both files audit with zero errors/repairs. For aligned subtype 1,
the audit computes distance between the native witness points: its DXF definition
does not require code 50, while ezdxf 1.4.4's generic measurement helper projects
using a default angle. Other subtypes use the independent native helper.

Existing 110-field interoperability, 37-entity fidelity, 223-master/20-starter
library and original sample audits are retained. Strict TypeScript consumers and
clean offline package installation/import cover all 13 version-0.4.0 packages.

Run the commands below after bootstrap/catalog/build. Other 0.3.0 validation
commands still apply. Reports and screenshots in `artifacts/` are regenerated.

```sh
npm test
npm run catalog
npm run build
npm run pack:packages
node scripts/verify-packages.mjs
tsc -p tests/tsconfig.json
python tests/browser_cad_editing.py
python tests/audit_cad_editing.py
```

The local browser suite uses the standalone build and a **test-only memory store**;
CI sets `CONDUIT_TEST_ORIGIN=localhost` for HTTP delivery and the existing File/Blob
and binary-download path. The new editing suite intentionally stubs save/schedule
for deterministic history checks in either origin. This does not qualify storage
or PWA durability. Browser pixels use **Canvas 2D**, not physical GPU execution.
Neither these fixtures nor ezdxf audit results certify universal Autodesk behavior.
No font, arbitrary ACIS or proprietary dynamic-block engine is asserted.

---

# Validation record — Conduit CAD 0.3.0

## Native interchange release checks

- **206 passing Node tests** (164 existing plus 42 new interop/codec/regression
  tests). Tests include scalar widths/int64s/overflows, malformed source input,
  legacy/Unicode/binary exchange, all represented native dimension types, inactive
  paper layouts, handle remapping, viewport transformations/clips, wireframe mesh,
  native helix data, masks, preserved opaque records and refusal of unsafe edits.
- **101 integrated browser checks**: 29 existing editing checks, 14 existing
  fidelity checks, 33 library/mobile checks and **25 new interop checks**. The new
  suite opens independent ASCII and binary fixtures via real File/Blob workers,
  switches paper layouts, checks actual pixels inside/outside polygon clips,
  tests WIPEOUT and frozen layers, validates clipped picking and non-mutating imports, and saves actual
  desktop/mobile binary downloads for ezdxf readback.
- **110 independent audit checks** in `tests/audit_interop.py`: native DIMENSION
  subtype/points/picture records, MESH topology/Z, HELIX spline/analytic data,
  WIPEOUT boundaries, model/paper ownership and viewport references/frozen layers.
  Four normalized/preserving × ASCII/binary files plus an authored dimension file
  reopen with zero ezdxf audit errors or repairs. The independent input is also audited.
- Existing 37-entity fidelity audit, all 223 symbol masters and 20 starters, and
  root example audits remain part of CI. Each generated DXF is independently read.
- Strict TypeScript consumers and clean offline installation/import of all 13
  version-0.3.0 npm archives are tested. No font files are distributed.

The native fixture is generated independently using ezdxf 1.4.4, including an
interpolated HELIX spline and unknown dictionary/XRECORD with an exact int64 and
binary chunk. Its generator and ASCII source file are checked in; tests derive binary variants.

```sh
node scripts/bootstrap.mjs
npm test
npm run catalog
npm run build
npm run pack:packages
node scripts/verify-packages.mjs
tsc -p tests/tsconfig.json
python tests/browser_smoke.py
python tests/browser_workflows.py
python tests/browser_fidelity.py
python tests/browser_symbols.py
python tests/browser_interop.py
python tests/audit_dxf.py
python tests/audit_fidelity.py
python tests/audit_symbol_library.py
python tests/audit_interop.py
```

The optional Python validators use `tests/requirements.txt`. Set
`CHROMIUM_EXECUTABLE` to an installed Chromium or install Playwright Chromium.
The interop browser suite defaults to the standalone document with a test-only
memory store; `CONDUIT_TEST_ORIGIN=localhost` serves the production build with
real origin storage. CI runs the localhost mode. Neither is a storage durability
qualification. New results are in `artifacts/interop-audit.json`, `browser-interop.json` and
`ci-unit-tests.log`; old reports keep their historical scope.

These browser tests execute Canvas 2D at desktop and emulated-mobile viewports,
not physical phone hardware. The test-only memory adapter bypasses persistence
at the standalone opaque origin. File input and actual downloads are exercised,
but storage durability, PWA installation and device-specific GPU performance
are not certified. The native backend probe is separate and is not evidence of
this release's cross-backend pixel equivalence. A successful ezdxf audit validates
syntax, fields and ownership for these fixtures, not all AutoCAD/vendor semantics.

---

# Validation record — Conduit CAD 0.2.1

## Executed engineering-library checks

`npm test`: **164 passing Node tests**, including all earlier tests plus catalogue
provenance, all 64 legacy identities/ports, full geometry coverage, coloured
fills, native curves/ellipse axes, safe migration/undo, twenty template DXF
round-trips and endpoint-body routing regressions.

`node scripts/catalog-artifacts.mjs`: **223 masters** in **11 categories**, with
unique identities, valid native geometry and normalized named terminals within
0.15 units of the drawn geometry. The generated per-master ledger and visual
atlas were reviewed by category. These checks do not verify normative dimensions.

`python tests/browser_symbols.py`: **33 passing browser checks** cover every
category, family search, missing-block preview without mutation, lazy insertion,
industry creation, migration/undo, save failure, touch dragging and mobile layout.
Together with the 29 established workflows and 14 fidelity checks, there are
**76 integrated checks**. Independent CDP touch and Playwright tap/layout phases
use separate input sessions. All suites report zero uncaught JavaScript errors.

`python tests/audit_symbol_library.py`: ezdxf independently reads the complete
223-master specimen and all **20** starter DXFs. It verifies block primitive
sequences, native cubic splines, metadata, named ports and revision records.
All **21 files** audit with **zero errors and zero repairs**. The existing
37-entity fidelity fixture and three legacy-root sample audits also pass.

`tsc -p tests/tsconfig.json`: strict typed consumers pass for all 13 packages,
including the new catalogue/migration APIs and typed routing options.
`node scripts/verify-packages.mjs`: clean offline installation/import and DXF
integration pass for all 13 version-0.2.1 npm archives with an empty npm cache.

Run `node scripts/catalog-artifacts.mjs` before the new independent audit.
The committed raw reports are in `artifacts/`. CI regenerates reports from the
checked-out sources, so screenshots and old reports are not substitutes for a
passing current run.

## Environment and approval boundary

Browser execution here uses **Canvas 2D**, not physical-device GPU qualification.
Persistence is a test-only in-memory adapter at an opaque origin. Real mobile
storage/PWA durability and hardware WebGPU/WebGL2 equivalence are not certified.
No font/3D/dynamic-block feature implementation is asserted by this symbol release.
Reference-family matching and terminal geometry tests are not ISO/IEC/ISA
certification; every starter is a non-approved concept drawing.

## Historical 0.2.0 fidelity record


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
