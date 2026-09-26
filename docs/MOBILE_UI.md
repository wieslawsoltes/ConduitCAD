# Adaptive mobile workbench — 0.7.1

The shared workbench UI supports small phones, coarse-pointer tablets up to 1100 CSS pixels wide, short landscape screens, and narrow desktop/split-screen hosts. Desktop layouts retain their permanent panels. No user-agent or model-name detection is used.

## Document navigation

Document tabs use separate selection and close targets, a contrasting active border, dirty/error indicators, ellipsized long names and complete accessible names. Every mobile tab/close/new/switcher target is at least 44 CSS pixels high. Tabs scroll natively; new/activated documents are revealed, but autosave updates do not reset the strip's scroll position or steal focus. Arrow/Home/End navigation uses manual activation (Enter/Space); Delete closes a focused tab using the existing save/discard/cancel contract.

The document manager offers Rename, Duplicate, Move left, Move right and Close, with its New/Open/Save All footer outside the scrolling body. Rename is undoable and refuses a drawing with an open block authoring draft; the draft must be saved or closed first. This avoids mixing parent-document names into a draft's private history.

## Tools, sheets and views

The single searchable tool catalogue includes quick drawing tools, all native drawing tools, editing operations and commands. All search words participate in matching and empty results are announced. An active drawing command has a horizontally scrollable command strip, separate Finish action and readable next-point prompt. Redundant zoom chrome hides while the strip is active. The exact-point dialog retains Cartesian/polar/parameter expressions and never substitutes a numeric-only keyboard for expression fields.

Library and Properties sheets use measured canvas/chrome boundaries, including a block editor bar, rather than assumed header offsets. Sheets expand/reduce through touch handles; short landscape uses side sheets and a scrollable tool rail. Properties/Layers/Check are accessible inspector tabs. Closed mobile panels are inert. Open sheets intentionally remain non-modal so the drawing dock can switch tools; modal forms make the underlying application inert.

## Dialog and keyboard behavior

Every workbench dialog shares the same lifecycle: bounded visual-viewport dimensions, a non-scrolling heading/close button, independently scrolling body and retained confirmation footer. Touch browsing focuses the dialog heading instead of opening the software keyboard. Desktop command/forms keep their input-first focus. Tab focus stays in the dialog, closing restores its connected invoker, disabled controls are excluded, and a pending confirmation cannot be submitted twice.

Text entry uses 16-pixel form controls on touch layouts. Checkbox/radio geometry is not inflated into text-field geometry; associated labels remain touch sized. Software keyboard handling distinguishes a reduced visual/layout viewport from accessibility pinch zoom, carries viewport offsets to portalled dialogs and scrolls only the local input container. Events are animation-frame-coalesced, observers and handlers are disposed, and renderer resize runs only when the measured canvas size changes.

Wide exact-geometry/solver tables have named keyboard-focusable horizontal scrolling regions. Parameter rows become stacked cards retaining the entire expression, solved value and remove button. Long schema text remains editable at readable size. Specialist block settings, parameter/actions, attribute, port, exact vertices, constraint, calculated-text, export, layer and drawing dialogs use the same responsive system.

## Validation and limits

`node --test tests/mobile-layout.test.mjs` checks media/viewport calculations including accessibility zoom and resized-layout keyboards. `python tests/browser_mobile_ui.py` tests touch at 320×568, 390×844, 844×390, 820×1180 and 1024×768 plus desktop at 1440×960. It covers bounded dialogs and sheets, control sizes, document rename/reorder, all 28 native tool sessions, parameter calculations, specialist forms, focus containment, duplicate confirmation, and synthetic keyboard metrics. Existing editing, drawing, parametric and workspace recovery suites remain gates.

Local browser runs use the standalone Canvas 2D build with explicitly emulated Web Storage because HTTP origins are not accessible in this execution environment. CI runs real localhost/IndexedDB for document and mobile suites. Neither is a physical iOS/Android test, an OS keyboard test, a screen-reader certification, or WebGPU/WebGL2 performance equivalence. Device/browser-specific IME and safe-area behavior still need real-device acceptance.

Design references: W3C ARIA APG [manual tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/), [modal dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), WCAG [enhanced target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html), and [VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport). These are design inputs, not a blanket conformance claim.
