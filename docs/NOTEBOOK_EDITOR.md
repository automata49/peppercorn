# Notebook writing

Journal and reflection share `NotebookEditor`. The supplied Notability screenshot informs the paper/top-action/bottom-dock arrangement; artwork, branding and native APIs are not copied.

## Open source

- [Tiptap](https://github.com/ueberdosis/tiptap), MIT, pinned existing 3.31.4 packages: rich text, selected format states, lists, headings and text undo/redo.
- [perfect-freehand](https://github.com/steveruizok/perfect-freehand), MIT, pinned 1.2.3: vector stroke outlines, pressure, smoothing and simulated mouse pressure. Original license remains in the installed package and dependency lock.

## Data compatibility

`InkStroke` stays an array of x/y points. Optional point metadata stores pressure, palette color, width and tool; old arrays need no migration. Shared import cleanup restricts metadata to supported finite values. New normalized y coordinates may exceed the legacy 400-high drawing region; page height derives from text and stored ink bounds, and preview expands for new styled strokes. Legacy unstyled previews retain the 1000x400 polyline presentation.

Optional `paper` records the paper style. Each dated reflection can hold an optional `note` with sanitized Tiptap JSON, text, ink, photos and paper. Results, lessons, decision and next action/date stay structured. Reflection notes never replace the original journal body or ink. Snapshot/revision, version-1 export/import and opaque owner-RLS cloud JSON retain the additions. Opening an older app version may not display the new metadata; use current clients when editing.

Pen/pencil/highlighter support pen and mouse; finger scrolling is the default and finger writing is opt-in. Touch on drawing surfaces is handled as vertical scrolling to avoid browser cancellation of pen strokes. Extra palm contacts do not terminate an active pen stroke. Pointer cancellation discards only the uncommitted gesture. The eraser removes touched strokes; rectangle selection moves/deletes whole strokes. Ink undo/redo is separate from Tiptap text history and stores at most 60 operations for the open editor. It does not persist across reopen. Paper is one continuous writing surface, with up to four existing resized photos and the existing notebook payload limit.

## Verification

`tests/notebook-editor.spec.ts` exercises all four canonical widths in Light/Dark, tool reachability and target sizes, saved styled ink/text/paper, erasing, selection movement/deletion, undo/redo, photo backup, independent reflection notes/history, dirty dismissal, tall ink and pressure/cancel behavior. Existing lifetime, account-sync, identity/four-screen and full UI suites remain required. Browser tests do not prove physical iOS Safari or Apple Pencil feel; those remain unverified.
