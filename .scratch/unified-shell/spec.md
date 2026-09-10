# Unified shell

Status: done

## Problem Statement

The chrome is split across two horizontal bars that compete for the same job: `TopNav` carries a sidebar toggle, three section tabs (BUFFER / TAGS / GRAPH), a decorative "main" branch pill and a profile avatar, while a second bar (`BufferHeaderNormal`) sits inside the buffer content area holding only the note title and the `:insp` toggle. The sidebar shows one flat, date-grouped note list and nothing else — no tags, no graph entry point beyond the top tabs. There is no landing screen: `/` redirects straight into whichever note was edited most recently, so there is nowhere to orient, see recent work, or start something new. The editor shows raw markdown marks in every mode, so a note never reads like a document. The graph view is a distraction the user wants shelved for now.

## Solution

Merge the two header bars into one line. Move section navigation into the sidebar as a Buffers/Tags tab switcher, with tag browsing as an ephemeral two-level drill-down that overlays only the sidebar's list region. Delete the graph feature's routes and UI while keeping its logic dormant for a later return. Add a vim-mode-driven "Live Preview" to the editor: NORMAL and RO hide markdown syntax marks, INSERT/VISUAL/EDIT show raw source. Add a Dashboard landing screen at `/` with recent notes, keyboard navigation, an inline filter, a shortcut cheatsheet and a quote.

Full design record, including the settled product decisions and the validated technical approach (CodeMirror StateField architecture, routing changes, sidebar decomposition): `/Users/rb/.claude/plans/streamed-shimmying-lampson.md`.

## Implementation Decisions

- Graph: delete `GraphView`/`GraphSkeleton`/`/graph` route/nav tab. Keep `src/lib/graph.ts` dormant and unreferenced. `[[wikilink]]` stays inert text.
- Sidebar nav is a tab switcher (Buffers | Tags), not stacked sections. Tag drill-down is local `useState`, never reflected in the URL.
- Header is one line: `[toggle] [title] … [branch] [:insp] [profile]`. Branch pill stays decorative/static. `:insp` renders only when a buffer is active; title falls back to a section name otherwise.
- `/` becomes the Dashboard, inside the auth-gated `(app)` shell. Bare `/notes` redirects to `/`. `/notes/<id>` deep links are untouched. ADR-0001's "most-recent-buffer" home-entry decision is retired in favor of the Dashboard; `goHome()` (used after deleting a note) keeps resolving to the next most-recent buffer, only its no-notes-left fallback changes.
- Reading mode is a CodeMirror `StateField<DecorationSet>` (not a ViewPlugin — block/line-spanning decorations forbid that; not a Compartment — reconfigures don't survive `setState` across notes), reading vim mode through a ref kept in sync on every `setState`. A `transactionFilter` keeps the cursor out of hidden ranges, since vim computes motions itself and bypasses `atomicRanges`.
- Dashboard recent list: 8 items by `updatedAt`, no new "last opened" tracking. Keyboard-first: list focused on load, j/k + arrows move, Enter opens, `/` focuses an inline filter that escalates to global search on a leading `/`.

## Testing Decisions

- Existing suite (`npm test`) must stay green throughout; update only `useWorkspaceNav.test.ts` (drop the `clearToHome` case).
- New coverage: `quotes.test.ts` (deterministic via injected RNG), `RecentNotesList` keyboard/filter behavior, `SidebarLists` drill-down + overlay-doesn't-cover-header assertion, `TopBar` title/`:insp` conditional rendering, `Editor.livepreview.test.tsx` covering mode-driven hide/show, the switch-away-and-back staleness regression, read-only rendering, and cursor-snap-out-of-hidden-range.
- `npm run build` after routing changes, to catch any `/` route conflict or dangling import from deleted components.

## Out of Scope

- Reviving the graph or making the branch pill real.
- Any new "last opened" (as opposed to "last edited") tracking.
- URL-addressable tag drill-down.
- Cursor-line raw-syntax reveal in NORMAL mode (Obsidian has it; this app deliberately doesn't).
- Rendering `[[wikilinks]]` as real links, or images inline.

## Further Notes

- This spec amends ADR-0001 (`docs/adr/0001-persistent-workspace.md`): home entry is the Dashboard now, not the most-recently-updated buffer.
- `CONTEXT.md` already carries the **Dashboard** glossary entry, added during design.
