# Multi-document workspace and mobile UI — 0.7.0

## Drawing tabs

New, Open and file drop now add a drawing tab instead of replacing the existing
file. The file picker accepts multiple DXF/project files; imports are serialized
in input order and a failed file does not remove successful imports. Reopening
the same filename creates an independent session. The default limit is 32 open
drawings, configurable up to 128; exceeding it refuses the new file without
silently evicting an open document. Each file keeps the existing 128 MiB import cap.

Each tab retains its own document, undo/redo history, selection, camera, active
model/paper layout, layer, line style, library category/search, inspector page,
snapping/grid/ortho settings, accepted drawing points and command options. There
is only one active renderer, camera and pointer host, not hidden canvases for every
file. Activation recompiles the selected scene. An in-flight pointer drag is
cancelled/rolled back before activation; accepted command points are preserved.

The document switcher (stack icon and count beside the tabs) provides search,
activate, duplicate, move-left, close, reopen saved recently closed drawings,
New, Open and Save all on device. Duplicate copies the parent drawing without
committing an unsaved block-authoring draft. Rename uses the title on desktop
or the existing More/rename action; tab names and browser title update together.
DXF, project, SVG and PNG export still act on the active drawing only. There is
no new workspace-container file format and no automatic writeback to imported files.

Tabs use the manual-activation accessibility pattern: Left/Right/Home/End move
focus without rebuilding a scene, Enter/Space activates, Delete requests close.
Alt+PageUp/PageDown activates the preceding/next document. Ctrl/Cmd+Shift+S saves
all device-recovery copies. Browser Ctrl/Cmd+W is not intercepted. Tab controls
include selected state, labels and the shared active panel relationship.

## Block editing and cross-document clipboard

An isolated block editor is part of its owning document session. Switching away
suspends its draft, private history, view and Test Block state. Returning restores
them. New/Open can create other tabs without discarding that editor; Export remains
guarded until the active block session is closed. Saving the master uses the existing
shared-reference transaction and cannot affect another document's same-named block.

Clipboard content is application-wide. Paste copies only referenced block
dependencies; different definitions with the same case-insensitive DXF block name
receive fresh names and nested references are rewritten. Existing definitions
are never overwritten. Root entity IDs are replaced, missing layer definitions
are imported and pasted entities use the destination's active layout. This is
not a universal clone of arbitrary reactors, constraints or foreign DXF object graphs.

## Device recovery and close semantics

Autosave uses independent drawing records and an ordered active-document manifest,
written in one IndexedDB transaction. Completion means the transaction completed,
not merely that its first put request succeeded. When IndexedDB cannot open,
localStorage uses one atomic workspace value. Writes are serialized, snapshotting
all open records just before storage begins. A later edit stays dirty even when
an earlier snapshot finishes. Failed writes show a recovery error without closing
or replacing any open drawing. Invalid manifests or serialization failures issue
no successful checkpoint; synchronous IndexedDB put errors abort the transaction.

The dirty marker means **not checkpointed on this device**, not "not exported".
The close dialog distinguishes Save on device & close, Close without saving and
Cancel. It also appears for an active block draft or unfinished drawing command.
Save-and-close awaits recovery completion and refuses to close a drawing changed
during the write. Closing without saving drops the current in-memory tab; it does
not erase an older recovery copy. Closing the last tab opens a new blank drawing.
Saved closed records remain available through Recently closed in that workspace.

Reload recovery restores the open set, active tab, document geometry, view,
selection, settings and supported accepted command points. An uncommitted block
draft remains isolated; a recovered Test Block returns to its authoring draft,
not a committed scratch instance. Partial pointer drags are never checkpointed
as committed edits. **Undo/redo stacks, clipboard contents and Test Block scratch
history are in-memory only and are not recovered after page reload.**

Each browser page has a sessionStorage identity. A new page can read the most
recent workspace and then saves under its own identity. Web Locks, where available,
prevent a duplicated live page from writing the same recovery namespace. Without
Web Locks this copied-page collision protection is not guaranteed. An explicit
`workspaceKey` opts into a host-controlled namespace; the host is responsible for
single-writer ownership. Unreadable/partial recovery forks a new namespace, retaining
the old data instead of replacing it with a blank manifest. The old legacy single
`autosave` is read as a migration fallback and is not deleted.

Pagehide/visibility checkpoints and unsaved-navigation warnings are best-effort.
A browser/process kill, quota exhaustion, private mode, clearing site data or
changing origins can make recovery unavailable. Device recovery is not durable
file storage, cloud synchronization, collaborative editing or a portable backup.
Export important documents as individual Conduit project files.

The current implementation snapshots all open documents per checkpoint and keeps
full-snapshot histories per tab. There is no global memory-pressure eviction,
entity-delta persistence or million-insert activation performance claim.

## Mobile workspace

Portrait uses a compact header, horizontally scrollable 44px document tabs,
New and a document switcher. Redundant mode chrome is hidden to keep drawing
space. The primary tool dock, properties/library buttons and footer layout/snap
controls remain reachable. Long tab names ellipsize without widening the page.

The library and properties panels are nonmodal sheets with 44px handles. Tap a
handle to expand/reduce; drag upward to expand and downward to reduce/dismiss.
Their content scrolls independently. Hidden sheets are inert and toggle controls
report expanded state; closing restores toggle focus. Opening one closes the other.

Short landscape viewports use a vertical tool rail, side sheets and file actions
in the tab-header row rather than two stacked headers. The media predicate is
shared by CSS and JavaScript, including coarse-pointer landscape wider than 720px.

VisualViewport events constrain the shell and modals when the virtual keyboard
shrinks the viewport; canvas-only chrome hides while editing a text field, and
the focused field scrolls into view. Browser page pinch is not treated as keyboard
resize. Safe-area insets are included. The deterministic test simulates the
VisualViewport resize; physical iOS/Android IME behavior remains device testing.

## Public embedding API

```js
import { mountWorkbench } from '@conduitcad/workbench';
import { createDocument } from '@conduitcad/model';

const workbench = mountWorkbench(document.getElementById('app'));
await workbench.ready;
const session = workbench.openDocument(createDocument('Second drawing'));
workbench.activateDocument(session.id);
await workbench.saveAllDocuments();
// Closing may open an explicit confirmation dialog; it does not imply discard.
await workbench.closeDocument(session.id);
```

`conduit:documentchange` reports documentId, optional previousId and the parent
CAD document. `conduit:change` includes documentId for edits. `dispose()` returns
a promise for the queued final checkpoint before closing storage; hosts that
need completion must await it. CSS, keyboard and dialogs still expect one
workbench per browser document; multi-document tabs are not multiple CSS-isolated
workbench instances. `@conduitcad/workspace` itself has no DOM dependency.

## References and validation

- WAI-ARIA APG Tabs: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- IndexedDB transaction completion: https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event
- VisualViewport: https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
- Web Locks: https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API

See `tests/workspace.test.mjs`, `tests/browser_documents.py` and VALIDATION.md.
The browser report distinguishes standalone memory-backed fallback storage from
native IndexedDB on localhost, and emulated touch from physical-device tests.
