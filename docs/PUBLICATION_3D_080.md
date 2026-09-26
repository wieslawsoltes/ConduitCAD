# 3D 0.8.0 publication provenance

Baseline: `617ea9b10989f4f5009b0dc4518d7df7dc142b8f` (0.7.1).

The previous upload stopped before its XZ stream trailer. Eleven uploaded Git blobs
were recovered in order, yielding 273,074 bytes of patch data. The first 56 complete
file patches applied cleanly and every resulting file matched the original target
Git blob hash recorded in its patch. These include all recovered production modules,
the ten-example generator, browser and independent-reader tests, and documentation.

The stream ended inside `tests/modeling3d.test.mjs`. Its complete test cases were
retained; new recovery-time tests are explicitly separate in
`tests/modeling3d-recovery.test.mjs`. Missing historical test results are not claimed.
Additional TypeScript consumer coverage checks the three new package contracts.

Recovery-time testing also fixed direct mesh vertex edits retaining stale feature
metadata: `Object.assign` does not delete absent properties, so deletion is now
committed explicitly only after validation succeeds.

The interrupted raw upload remains recoverable from branch commit
`749c3544f76dc6e02a095bfd382606ce85a74a6f`. Its compressed prefix SHA-256 is
`963cd0b2908c9a525e282a0c39c61ee6437cbed8c5d2cfc9668d9a539b2fa1a4`.
The detailed recovered-file identities are in `docs/3d-recovered-files.json`.

Validation evidence for this publication is regenerated from the committed source.
Run `npm test`, `npm run samples:3d`, `npm run build`, and the browser/audit scripts.
CI uses localhost and actual IndexedDB. Local opaque-origin runs are labeled as
such and are not substituted for native-origin or physical-device acceptance.
GPU adapter identity and pixel-comparison scope are recorded explicitly. This
release is mesh modeling, not full AutoCAD/Fusion or curved ACIS B-rep parity.
