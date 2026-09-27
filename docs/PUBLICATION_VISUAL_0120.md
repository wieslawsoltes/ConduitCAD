# Visual editing publication — 0.12.0

All pending 0.10.0 rendering, 0.11.0 spatial manipulation and 0.12.0 planar/inspection source changes have been transferred to GitHub. The restored source matches the saved f9618a887765d65766622f09ddbb8d016b36ce90 checkpoint for all 101 changed source paths. Generated distribution, package archives, example drawings and new CI evidence were committed at bd043c0c26e4e8e3f54f8916899fcad8be90f47a.

Validation run: https://github.com/wieslawsoltes/ConduitCAD/actions/runs/36316378265

The run passed 838 Node tests, strict TypeScript contracts, offline integration of 21 package archives, all inherited browser suites and all independent DXF audits. Unlike the historical local-only reports, the new browser suites ran through localhost with native origin and storage. The 176-assertion planar/inspection suite and the 157-assertion spatial manipulation suite each passed on Canvas, WebGL2 and WebGPU. The separate rendering suite passed 193 checks, executed all sixteen styles on each requested backend and reported no uncaught errors. Independent native DXF checks passed: 408 planar/inspection checks and 139 spatial manipulation checks, in addition to all inherited audits.

The WebGPU adapter was Google SwiftShader; this qualifies API/shader execution on the fixture, not physical GPU performance, universal rendering equivalence or physical-device UX. Touch was browser-emulated. Native AutoCAD acceptance, physical iOS/Android, real operating-system keyboards and screen readers remain unqualified. Historical validation documents retain their original local execution scope rather than being rewritten as if those earlier runs used GPUs.

The temporary recovery directory and source-import workflows are removed in the publication commit. Regular Pages CI retains read-only contents permission, reruns the complete source/build/browser/DXF gates, requires execution of the requested WebGPU backend and verifies the live production resource hashes after deployment. The original interrupted bytes remain available in Git history only.

See VISUAL_EDITING_2D.md, VISUAL_EDITING_3D.md and RENDERING_3D.md for the implementation contracts and remaining capability boundaries.
