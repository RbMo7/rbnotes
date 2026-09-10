# 02: Dashboard landing screen and the `/` reroute

**What to build:** `/` becomes the Dashboard, rendered inside the auth-gated `(app)` shell. Retire the most-recent-buffer home-entry behavior in favor of it, while keeping deep-link/refresh restoration of `/notes/<id>` intact.

**Blocked by:** 01 (touches the same middleware file; trivial to rebase if done out of order, but avoid parallel edits).

**Status:** done

- [x] `src/app/page.tsx` deleted; `src/app/(app)/page.tsx` added, rendering `<Dashboard />`
- [x] `pathname === "/"` added to middleware's protected check (exact match, not a prefix); post-auth redirect changed from `/notes` to `/`; `/tags` and `/graph` dropped from `PROTECTED_PREFIXES`
- [x] Bare `/notes` redirects to `/` (`src/app/(app)/notes/page.tsx`)
- [x] `/notes/<id>` deep link and page refresh still restore the exact buffer, cursor included
- [x] `WorkspaceProvider`'s home-resolution effect and `resolvedHome` fallback removed; an explicit `null` activeNoteId no longer silently re-resolves to a note
- [x] `goHome()` still opens the next most-recent buffer (used after deleting a note); only its no-notes-left fallback becomes `router.replace("/")`
- [x] `clearToHome` removed from `useWorkspaceNav.ts` (now unreferenced) and its test case removed from `useWorkspaceNav.test.ts`
- [x] `activeFilename` / `activeBufferInfo` cleared when leaving the notes section, so the footer doesn't show a stale filename on the Dashboard
- [x] `Dashboard.tsx`, `RecentNotesList.tsx`, `QuoteBanner.tsx`, `ShortcutCheatsheet.tsx` under `src/components/dashboard/`; `src/lib/quotes.ts` with a pure `pickRandomQuote(rng)`
- [x] Recent list: 8 most-recent non-archived notes by `updatedAt`, no scroll
- [x] List is keyboard-focused on load, first item highlighted; `j`/`k` and arrow keys move; Enter opens the note as a buffer
- [x] `/` focuses an inline filter box; plain typing filters the recent list by title; a leading `/` + Enter escalates to the existing global search (`SearchPalette`)
- [x] Sidebar wordmark links to `/`
- [x] `docs/adr/0001-persistent-workspace.md` gets an amendment noting home entry is now the Dashboard
