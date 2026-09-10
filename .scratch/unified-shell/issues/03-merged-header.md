# 03: Merge TopNav and BufferHeaderNormal into one line

**What to build:** A single header line — sidebar toggle, title, then branch pill / `:insp` / profile avatar — replacing the two-bar layout.

**Blocked by:** 02 (title needs a section-name fallback for the Dashboard route).

**Status:** done

- [x] `TopNav.tsx` renamed `TopBar.tsx`; the `TABS` array and its rendering removed
- [x] Title derived synchronously from `useWorkspace().activeNoteId` + `useNotesQuery()` when a buffer is active, falling back to a section-name map (`/` → "Dashboard", `/settings` → "Settings") otherwise — not from the effect-written `activeFilename`
- [x] `:insp` renders only when a buffer is active, wired directly to the store's `toggleInspector`
- [x] `BufferHeaderNormal.tsx` deleted, along with its wrapper in `WorkspaceBuffer.tsx` and the now-unused `toggleInspector` binding/import there
- [x] `--spacing-header-height: 3.5rem` added to `globals.css`; `TopBar`, `AppShell`, `Sidebar` use it instead of the literal `h-14`/`pt-14`
- [x] `StatusBar.test.tsx` passes unmodified
