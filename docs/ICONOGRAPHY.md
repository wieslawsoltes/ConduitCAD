# Coherent CAD iconography — 0.9.1

The UI uses 180 original SVG glyphs from the independent `@conduitcad/icons` package. They share a 24-unit optical grid, rounded caps/joins, currentColor strokes and restrained surface accents. The existing 32-unit brand glyph is retained. Glyphs are UI affordances, **not ISO/IEC drawing symbols**; none of the 223 engineering symbol masters has been modified by this change.

## Coverage and architecture

The workbench's semantic map (`icon-map.js`) assigns commands, native entity types, modeling operations, example categories and named dimensional fields to glyphs. The same operation appears consistently in the catalogue, contextual actions, timeline and inspector. Distinct glyphs identify body/face/vertex selection, camera directions, modeling primitives, extrusion/revolve/loft/sweep, holes, booleans, patterns, block authoring, constraints, dimensions and file formats. Plain parameter values, arbitrary body/document names and engineering drawing previews remain text or actual geometry.

`icons.js` renders escaped command markup and changes command labels in place. Render-boundary decoration adds supplementary glyphs to property captions, modal headings and specialized editors. No MutationObserver, polling loop, SVG sprite registration, dynamic remote asset fetch, icon font or per-camera-frame icon scan is used. The existing deterministic bundler embeds the same package in the standalone and hosted builds. `scripts/icon-atlas.mjs` generates an offline catalogue from the actual package definitions.

## Adaptive presentation

- **Adaptive**: compact camera controls; icon-and-caption selection controls on touch; labeled primary creation and less familiar contextual operations; compact familiar navigation/editing actions. Inactive feature timeline entries compact on small screens; the active feature retains its name. Document titles remain visible and ellipsized, never replaced with anonymous icons.
- **Icons and labels**: explicitly retain toolbar captions, with bounded horizontal scrolling when needed.
- **Compact icons**: minimize toolbar labels while keeping their text in the accessibility tree. Forms, catalogues, property names, critical confirmation actions and destructive operations outside toolbars retain visible text.

The label selector and **Icon guide** are reachable from More / Shapes, 3D Create, 3D View, and Help. The choice is an optional origin-level Web Storage preference, separate from CAD document data. Storage denial cannot prevent the application from opening. The guide has grouped glyph names and search; it does not execute modeling actions.

## Accessibility and interaction

Every icon is decorative (`aria-hidden="true"`, `focusable="false"`). A button's existing accessible name, visible text or visually hidden caption identifies its action. Compact captions are visually clipped rather than removed from the accessibility tree. Existing active/pressed/selected states, focus outlines, keyboard actions and disabled behavior remain on the real controls. Pointer events ignore SVG paths so delegated button actions and existing row/remove handlers continue working. Touch targets remain at least 44 CSS pixels in the tested primary toolbars and sheets.

A single transient tooltip appears for keyboard focus or fine-pointer hover; it uses the current control label, preserves unrelated aria-describedby tokens, is hoverable, remains until dismissal/focus departure, and closes on Escape without closing the parent dialog on the same keypress. It is positioned within the current visual viewport. The native title is suppressed only while the custom tooltip is visible, then restored. Touch does not acquire a destructive long-press-to-discover behavior. Tooltips have no focusable content and are removed with the workbench.

Primary references used for interaction review:
- WAI-ARIA Button Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/button/
- WCAG Content on Hover or Focus: https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html
- WCAG Target Size (Enhanced): https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html

These engineering choices and automated checks are **not a certification of complete WCAG conformance or native screen-reader acceptance**.

## Validation

`tests/icons.test.mjs` validates registry coverage, decorative/focus attributes, escaping, immutable discovery data, unknown-glyph handling, command state overrides, modeling/drawing catalogue completeness and safe compact CSS selectors. `tests/browser_iconography.py` exercises actual tool activation, view labels, pressed-state glyph changes, focus/DOM stability, operation fields, export/document controls, label preferences, guide filtering and tooltip lifecycle. Layouts include 320×568, 390×844, 844×390, 1024×768 and 1728×1000. Screenshots and raw reports are in artifacts.

CI runs the new browser suite on localhost. Local opaque-origin runs use an explicitly declared memory storage adapter and are not native recovery evidence. The new suite uses Canvas/software-depth rendering and emulated touch. Existing separate browser and DXF regression suites remain enabled. Physical phones, OS keyboards, native screen readers and hardware GPU performance require separate acceptance testing.

## Continuation provenance

The interrupted upload retained 36 complete per-file patches and the start of the
workbench icon adapter. The complete files were checked against their target Git
blob hashes. The truncated adapter and the remaining render-boundary integration,
responsive styles, atlas generator and regression tests were completed in this
continuation, not represented as recovered original code. The source baseline tree
was verified against commit `bcc790a08cce28f64d11e4c8d8832acb2a0718ff`.

The document indicator keeps its file/block glyph while a separate badge reports
unsaved/error status. Feature selection now refreshes the timeline directly rather
than waiting for a later document edit. This refresh does not rebuild geometry.
All glyphs, including the supplementary controls group, are present in the guide.
