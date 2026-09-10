# 05: Reading-mode Live Preview for the editor

**What to build:** In vim NORMAL mode and the read-only shared view, hide markdown syntax marks (headings, emphasis, strikethrough, code marks, link syntax, blockquote marker, list markers, horizontal rules) and render list bullets/rules as glyphs. INSERT, VISUAL and EDIT show raw source. No cursor-line exception.

**Blocked by:** None — independent of the shell work, touches only `src/components/editor/`.

**Status:** done

- [x] `src/components/editor/live-preview.ts`: a `livePreview(modeRef)` factory returning a `StateField<DecorationSet>` (not a ViewPlugin, not a Compartment — see spec/plan for why), providing both `EditorView.decorations` and `EditorView.atomicRanges`
- [x] Correct lezer-markdown node names used per the plan's table (`HeaderMark`, `EmphasisMark` for both bold and italic, `StrikethroughMark`, `CodeMark`/`CodeInfo`, `LinkMark`/`URL`, `QuoteMark`, `ListMark`, `HorizontalRule`); trailing whitespace after a block mark is swallowed too
- [x] `build(state, mode)` returns `Decoration.none` for INSERT/VISUAL/EDIT — the syntax-tree walk only runs in NORMAL/RO
- [x] List markers replaced with a bullet/number widget; horizontal rules rendered as an actual rule; blockquote gets a line-level left border; fenced code gets a line-level background with fences hidden
- [x] An `EditorState.transactionFilter` keeps empty cursor selections out of hidden ranges (direction-biased), since vim's own motions bypass `atomicRanges` entirely
- [x] `modeRef` is kept current in `wireVimMode`, and a `setPreviewMode` effect rides the existing mode-change dispatch
- [x] `syncPreviewMode` dispatched after every `view.setState()` (view creation, cold placeholder, note activation) including the read-only path, fixing the staleness bug where a cached state keeps a stale mode
- [x] `Editor.livepreview.test.tsx`: marks hidden in NORMAL; raw after entering INSERT; hidden again after `<Esc>`; switch-away-and-back staleness regression; read-only renders clean with no vim engine; cursor snaps out of a hidden range on `0`/`$`
