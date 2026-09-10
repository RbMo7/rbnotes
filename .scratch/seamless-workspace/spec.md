# Seamless workspace

Status: ready-for-agent

## Problem Statement

Opening the app feels like loading a website, not opening a notes app. First paint waits on every note's full content; switching notes remounts the whole editor through a route navigation with skeletons and blank flashes; in-buffer `/` search drops keystrokes into insert mode instead of searching; and every save is a manual act that waits on the network. The user wants the entire project to feel like a native mobile/desktop notes app: clicky, instant, no loading states after first paint.

## Solution

A persistent workspace where buffers switch as instant client state inside a single shell, first paint blocks only on note metadata while content warms up invisibly in the background, in-buffer `/` search works like real vim, global search answers from the warm cache with a server fallback, and saves happen silently via autosave with `:w` retained as force-flush. Rebuild is authorized where the current shape causes the friction.

## User Stories

### Local search

1. As a vim user, I want `/` followed by typing to incrementally jump to matches in the current buffer, so that search feels like real vim.
2. As a vim user, I want `n` and `N` to repeat the last in-buffer search forward and backward, so that muscle memory survives.
3. As a vim user, I want a pattern with no matches to report E486 and leave my cursor where it was, so that a failed search never loses my place.
4. As a vim user, I want `Esc` to cancel an in-buffer search and restore the prior state, so that abandoning a search is free.
5. As a vim user, I want keystrokes typed into the `/` prompt to never leak into the buffer as insert-mode input, so that searching can never corrupt text.

### Loading model

6. As a note-taker opening the app, I want the note list to appear immediately from metadata, so that I never wait on full contents to orient myself.
7. As a note-taker, I want every note's content fetched quietly in the background after first paint, most-recently-updated first, so that whatever I open next is already there.
8. As a note-taker opening a note, I want zero loading state when its content is already warm, so that opening feels instant.
9. As a note-taker opening a note whose content has not arrived yet, I want it fetched immediately with a brief skeleton, so that the wait is rare and short.
10. As a note-taker, I want a cold buffer to never open as an empty editable buffer, so that I can never accidentally overwrite real content with emptiness.

### Workspace

11. As a note-taker switching notes, I want the switch to be instant client state with no page transition, so that the app feels clicky like a native app.
12. As a vim user returning to a buffer, I want cursor, scroll, and undo history exactly as I left them, so that buffers behave like vim buffers.
13. As a desktop user, I want the Back button to step through previously opened notes, so that navigation matches trained web reflexes.
14. As a user, I want Forward to restore the note plus its cursor position, so that moving back and forward is lossless.
15. As a user opening a shared note link, I want the workspace to load with that exact buffer open, so that links stay shareable.
16. As a user refreshing the page, I want the same buffer restored, so that refresh is non-destructive.
17. As a user opening an id with no buffer, I want the E484 no-such-buffer screen, so that bad links fail loudly instead of showing a fake empty note.
18. As a new user with no notes, I want the empty-buffer screen with a `:new` path, so that starting is obvious.

### Global search

19. As a note-taker pressing Ctrl+/, I want the overlay to open instantly, so that invoking search never blocks on the network.
20. As a note-taker searching after warm-up, I want instant complete results from the local cache, so that search is fast and works offline.
21. As a note-taker searching during the first seconds after load, I want complete results via the server fallback, so that early searches never silently miss notes.
22. As a note-taker picking a global search result, I want the buffer to open with the match handed off and selected, so that I land directly on the hit.

### Autosave

23. As a note-taker who just typed, I want my text persisted silently in the background, so that I never think about saving.
24. As a vim user, I want `:w` and Ctrl+S to flush immediately, so that the ritual still guarantees durability on demand.
25. As a note-taker, I want a `[+]` marker while my buffer has unsaved changes, so that I can tell at a glance whether my text is safe.
26. As a note-taker, I want successful saves to be silent with no toast or banner, so that saving never interrupts flow.
27. As a note-taker, when a save fails, I want a visible retry affordance with my text fully intact, so that no keystroke is ever silently lost.

### Friction bar

28. As a mobile user tapping notes, I want each open to be instant with no spinner, so that the app feels native on my phone.
29. As a note-taker doing anything after first paint, I want no spinner, skeleton, or disabled control blocking me, so that the whole app feels frictionless throughout.

## Implementation Decisions

- First paint blocks on the metadata list only (identifiers, titles, timestamps, flags). The full-content fetch leaves the critical path entirely.
- The single notes collection in the client cache remains the one seam. Unwarmed content is represented as absent, never as an empty string; the data-loss guard is encoded in the representation itself.
- Warm-up is a post-mount client loop: strictly serial with a small stagger, most-recently-updated first, seeding the same collection. It skips buffers holding unsaved local state, and a late-arriving fetch never overwrites newer or dirty content (stale-never-clobbers).
- Two new minimal contracts, nothing more: a per-note content fetch, and a server-side global search returning note identity plus match locations.
- Global search resolution order: the warm cache when every buffer is warm, the server fallback while any buffer is cold. Selecting a result reuses the existing one-shot pending-match handoff to open the buffer at the hit.
- Persistent workspace: the shell mounts once and buffer switching is client state. One editor instance swaps documents instead of remounting per note. Note routes become entry and deep-link only. Each switch pushes history so Back walks buffers.
- Per-buffer state (cursor, scroll, undo) travels with the document and is restored on switch and on back/forward traversal.
- The `/` fix repairs prompt focus timing in the engine panel path. The app never intercepts bare `/`; engine ownership stands and the prior muscle-memory decision is reaffirmed, not relitigated.
- Autosave debounces a short idle down the same persist path as force-flush; `:w` and Ctrl+S flush immediately. The statusline shows `[+]` while dirty and clears silently on success; failure surfaces a toast with retry and the text is always retained.
- Cold open preempts the warm-up queue with an on-demand fetch and shows only the skeleton; editing enables once content lands.
- Home entry resolves to the most-recently-updated non-archived buffer inside the workspace, with no blank redirect hop.

## Testing Decisions

- A good test asserts external behavior only: switching buffers shows no loading state; Back restores buffer and cursor; a cold buffer is never editable; a failed save retains text. No assertions on internals (query keys, component instances, dispatch counts).
- Test the warm-up scheduler (order, serial cadence, skip-dirty, stale-never-clobbers), the search resolution order (warm cache vs server fallback boundary), autosave (debounce, force-flush immediacy, failure retry), history traversal (back/forward restoration), and the `/` prompt (keystrokes never reach the buffer as inserts).
- Prior art: the shortcut-table unit tests named after the two historical `/` bugs. Extend the convention: name each new regression test after the bug it pins (prompt focus race, empty-overwrite guard, skeleton-on-switch).

## Out of Scope

- Cross-device and cross-tab conflict merging; last-writer-wins stays.
- A close-tab durability guarantee for the dirty window; follow-up work.
- Search ranking and relevance tuning; completeness first.
- Mobile-specific surface polish (touch editing, FAB behavior) as its own round.
- An offline-first mutation queue beyond the failure toast with retry.
- Removing deep-link routes; they stay as entry points.
- Replacing or upgrading the vim engine package.
- Optimistic UI beyond autosave.

## Further Notes

- This spec reverses two shipped decisions (route-per-note navigation; load-once full prefetch). The reversal is recorded in ADR-0001.
- Seams check: one preserved seam (the notes collection) plus two new minimal contracts. Everything else reuses existing seams: the intent table, the pending-match handoff, the statusline.
- Acceptance bar: after first paint, no skeleton or spinner follows any user action; skeletons appear only for genuinely absent content. Verified by feel; trace-verified timings are a possible later hardening.
- Known follow-up: durability if the tab closes inside the dirty window.
