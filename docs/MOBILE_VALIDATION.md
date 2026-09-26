# Mobile release validation — 0.7.1

Feature validation run: https://github.com/wieslawsoltes/ConduitCAD/actions/runs/36221491424

Validated application and evidence commit: `074d9b15335376149f861b7ee20828a26b2b3a79`.
Production build identifier: `11c9a57fc93e`. All fifteen reusable packages are version 0.7.1.

## Recorded results

- 460 Node tests passed; zero failures, cancellations or skips.
- 792 integrated browser assertions passed: 246 inherited editing/fidelity checks, 61 document/recovery checks, and 485 adaptive mobile UI checks. The separate browser smoke suite also passed. These are assertion counts, not device counts.
- Document tests used actual IndexedDB and Web Locks on localhost. They cover reload, isolated block drafts, failed save-and-close retry, asynchronous reopening, independent duplicated-page recovery and duplicating an already-forked page. The browser test now creates an explicit shared BrowserContext rather than the single-page convenience context.
- Mobile tests exercised 320x568, 390x844, 844x390, 820x1180 and 1024x768 coarse-pointer viewports, plus a 1440x960 desktop comparison. They cover all 28 native drawing sessions, specialist authoring forms, tab scrolling/rename/reorder, panels, fixed dialog actions, focus containment and synthetic keyboard metrics.
- Existing native DXF, dimension, parametric, drawing-tool, symbol and starter audits passed. This release adds no new DXF semantics.
- Strict TypeScript consumer checks and empty-cache offline installation/import of all fifteen package archives passed.

Raw evidence is committed under `artifacts/`: `ci-unit-tests.log`, `browser-documents.json`, `browser-mobile-ui.json`, existing browser/audit reports and `package-consumer.json`. The permanent Pages workflow now requires both document and adaptive mobile suites. It retains read-only repository permissions for normal builds; temporary source-import/checkpoint workflows are removed.

## Reproduction and boundaries

After `node scripts/bootstrap.mjs`, run `npm test`, `npm run build`, and the browser scripts. Install the pinned Python dependencies from `tests/requirements.txt` and Chromium. Set `CONDUIT_TEST_ORIGIN=localhost` for real-origin storage tests on a machine that permits browser HTTP navigation.

Browser execution used Canvas 2D with emulated coarse pointers, viewport sizes and keyboard events. No physical iOS/Android device, actual IME, screen reader, process-kill/eviction durability, or WebGPU/WebGL2 equivalence is certified by these results. Physical-device acceptance remains required. UI behavior is described in [MOBILE_UI.md](MOBILE_UI.md).
