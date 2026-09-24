# Conduit CAD 0.1.0

Initial working touch-first 2D CAD and engineering-diagram editor, built from
13 native JavaScript packages. The source and generated standalone application
are supplied under MIT, with third-party notices for the ACI palette.

## Delivered

- Mobile portrait bottom sheets, landscape tool rail, desktop workbench, shared
  pointer gestures, pinch-pan, precision magnifier, snapping and numeric editing.
- Native CAD entities and symbol blocks, 56 illustrative engineering masters,
  10 line styles, obstacle-aware connectors, tags and editable sample drawings.
- Planar geometry, parameters, a bounded sketch solver, undo/redo, layer controls,
  QA checks, DXF/project/SVG/PNG/CSV/graph exchanges and local persistence code.
- ASCII/binary DXF input, normalized ASCII R2000–R2018 output, original-file
  preservation, XDATA metadata and an explicit compatibility matrix.
- Retained batched strokes, WebGPU compute culling and indirect drawing code,
  WebGL2 instancing, Canvas fallback and same-topology incremental scene updates.
- Offline build tools, modular source files, TypeScript declarations,
  complete npm tarballs, examples, technical documentation and test reports.

## Validation

86 Node tests, 29 integrated browser checks, strict TypeScript consumer validation,
13-package offline install/import integration, and three independently audited
DXF samples with zero reported errors or repairs. Synthetic CPU performance
measurements are included; they are not GPU/FPS/mobile benchmarks.

## Explicit limits

This release is not full AutoCAD or Visio parity and does not implement every DXF
entity, object graph, layout or 3D feature. Normalized edited DXF output can omit
unsupported data. Original-file export is distinct from edited export. Symbols
are illustrative rather than standards-certified. The sketch solver is bounded
and the geometry kernel is planar.

The delivery browser exercised Canvas 2D; GPU drivers/shaders and device loss
were not executed on real hardware. Browser storage durability, installable PWA
behavior, actual download flows and real-phone/pen acceptance remain open tests.

Read `docs/DXF_COMPATIBILITY.md`, `docs/VALIDATION.md` and `docs/ROADMAP.md` before
using this release for production drawing exchange.
