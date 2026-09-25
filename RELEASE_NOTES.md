# Conduit CAD 0.2.1 — engineering symbol libraries

223 original masters in eleven categories, up from 64 in three; 21 connection
styles and 20 editable industry starters. All thirteen packages are versioned
0.2.1. The original symbol IDs, block names and named terminals remain available.

The catalogue uses explicit ISO 10628-2, ISO 1219-1, IEC 60617, ISA-5.1 and ISO
5807 reference families where relevant. Other forms are labeled project
conventions. This is a geometry/convention review, **not normative dimensional
certification or engineering approval**. See docs/SYMBOLS.md and the generated
per-master ledger/visual atlas for scope and audit details.

Native curves, valve geometry, electrical alternatives, liquid/gas triangles,
actuator states, instrument location lines, valid ellipse axes, inherited fills,
preview text bounds and endpoint-body routing were corrected. The workbench adds
category/family search, a searchable industry chooser and explicit undoable saved
master updates; browsing or installing never silently replaces user definitions.

Validation: 164 Node tests, 76 integrated browser checks (Canvas 2D), strict
TypeScript contracts, clean offline package integration and independent ezdxf
audits of 223 masters and twenty starters. New tests distinguish automated
geometry checks from standards approval. This release adds no claim of new font,
dynamic-block, ACIS/3D-solid or physical-device GPU functionality.

---

# Conduit CAD 0.2.0 — DXF fidelity and touch editing

This release expands the native interchange/model/rendering pipeline, rather
than flattening imported CAD into an image. All 13 reusable modules are versioned
0.2.0; generated app/package artifacts are rebuilt from source.

## DXF and rendering

Native solid/pattern HATCH paths with bulge, line, clockwise/counterclockwise arc,
ellipse and rational spline edges; normal/outer/ignore islands; bounded pattern
scan conversion; retained native gradient tags with a diagnosed flat preview.
Variable-width bulged ribbons, 3D polyline/polyface/polygon-mesh wireframes,
hidden 3DFACE edges, LEADER, viewport-bounded RAY/XLINE and OCS projection.

Improved TEXT alignment/fit/second points/style/oblique data and MTEXT attachment,
wrap, scoped formatting, affine placement and masks. Correct foreground/background
ACI/true-color separation, alpha semantics, signed linetypes, global/entity
scales, lineweights and double-precision decimal export. Native export is tested
against a separate 37-entity ezdxf-authored fixture, not only self-roundtrips.

Canvas/SVG/PNG carry compound holes and opacity. Ordered fidelity compositing
prevents later fills being placed behind earlier lines. GPU strokes remain the
fast path for compatible scenes; filled/masked/long-dash/dotted scenes select
Canvas 2D explicitly rather than silently sacrificing order or dash content.

## Touch, clipping and symbols

Real drawing/overlay clipping excludes rulers, and ruler input cannot start an
edit. Dedicated 44px symbol grab handles reserve touch gestures before capture,
while cards remain scrollable and tap-to-place. Portrait/landscape spacing,
focus, overflow and safe-area behavior are refined. Non-default OCS raw grips
are withheld rather than shown at incorrect positions; body dragging is projected.

64 original masters now have connected leads and terminal-geometry checks.
Revised valve/check-valve, instrumentation, diode/ground/contact and flow geometry
plus eight additional variants improve convention clarity. New project examples
use geometry revision 2; saved user masters are not silently overwritten.
These are original, non-certified symbols, not a claim of IEC/ISA/ISO compliance.

## Validation and remaining boundaries

124 unit tests; 29 established browser workflows plus 14 new pixel/import/touch
checks; strict TypeScript consumer compilation; independent normalized-fixture
and sample audits with zero errors/repairs. Actual browser execution is Canvas 2D.
Hardware WebGPU/WebGL2, real-device storage/PWA durability and complete CAD-system
interoperability are not certified. Full fonts, XCLIP/layout clipping, associative
regeneration, dynamic blocks, object graphs and 3D solid modeling remain open.

See docs/DXF_COMPATIBILITY.md, docs/SYMBOLS.md and docs/VALIDATION.md for exact scope.

---

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
