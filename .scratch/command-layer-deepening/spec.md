# Spec: Deepen the command layer

Status: ready-for-agent

## Problem Statement

rbnotes is a vim-style notes app: I live in the editor and drive it with `:` commands (write, quit, new, rename, archive) and keyboard shortcuts (Ctrl+S, Ctrl+N, Ctrl+P, Ctrl+B, Ctrl+/, `:`). This surface is the product — and it is brittle in ways I keep hitting:

- The save indicator lies. After editing one note and switching to another, the second note's statusline and buffer header show "[+]" (modified) even though it's clean — and pressing `:w` on it doesn't clear the lie, so I can't trust the indicator that tells me whether my work is saved.
- Shortcuts have broken twice in recent history (the `/` search key misfiring in different modes), because the same shortcuts are implemented in two places whose only coordination is a comment.
- The help buffer is hand-maintained, so it drifts from what the keys actually do.
- There are no tests at all. Every tweak to commands or keys risks silently breaking the primary interface, and I only find out by using the app.
- Adding one new command today means touching four places; adding a shortcut means the same. I avoid extending the app because the change surface is so wide.

## Solution

Same commands, same keys, same UI — but the whole command surface becomes trustworthy:

- The save-state bug is fixed: the indicator always reflects the actual buffer, and `:w` on a clean buffer reports clean.
- All `:` commands and all global shortcuts flow through one intent pipeline with one owner, so behavior can't diverge between contexts.
- The help buffer is generated from the shortcut table, so it can't drift.
- The repo gets its first test suite, and every command and shortcut is locked in through tests that need no browser, no editor instance, no database.
- Adding a command or shortcut becomes a one-place change (plus a row in the help table, for free).

Non-goals: no new commands, no new keys, no visual changes. This is the same product with its primary interface made deep, testable, and honest.

## User Stories

1. As a note author, I want the "[+]" modified indicator to accurately reflect the current buffer's saved state, so that I always know whether my note is safe.
2. As a note author, I want the indicator to reset to clean the moment I switch to a different note, so that a stale dirty flag from a previous note never follows me.
3. As a note author, I want `:w` on a clean buffer to leave the indicator at clean, so that an explicit write can't leave a stale "modified" lie on screen.
4. As a note author, I want `:w` on a modified buffer to show saving then clean, so that I get confirmation my content persisted.
5. As a note author, I want `:q` to close the current buffer view and return me to the most recent note, so that quitting feels like vim.
6. As a note author, I want `:new` to create a blank note instantly and put me in it, so that capture is never blocked.
7. As a note author, I want `:rename <title>` to rewrite the first H1 and update the sidebar title immediately, so that renaming works the way the title rule defines it.
8. As a note author, I want `:archive` to move a note into the archive group without deleting it, so that my note list stays uncluttered.
9. As a note author, I want deleting an empty buffer to remove it for real and deleting a non-empty buffer to archive it, so that delete matches the documented policy in one place.
10. As a note author, I want `:set` commands to adjust my settings persistently, so that my preferences survive reloads.
11. As a vim user, I want `:` to open the command dock only when the editor is in NORMAL mode, so that typing a colon in INSERT mode stays in my text.
12. As a vim user, I want Ctrl+/ to open search whether focus is in the editor or in the page, so that search works from anywhere.
13. As a vim user, I want Ctrl+P to open the quick switcher from any focus context, so that jumping between notes never requires clicking.
14. As a vim user, I want Ctrl+N to create a new note from any focus context, so that capture is one chord away.
15. As a vim user, I want Ctrl+S to force a save from anywhere, so that persistence doesn't depend on remembering vim commands.
16. As a vim user, I want Ctrl+B to toggle the sidebar on desktop and the drawer on mobile, so that the one chord does the right thing per device.
17. As a vim user, I want in-buffer `/` search to keep working exactly as it does today (inside the vim engine), so that my muscle memory survives this refactor unchanged.
18. As a vim user, I want the same shortcut to behave identically when pressed in the editor versus outside it, so that there is exactly one shortcut behavior per key.
19. As a mobile user without a keyboard, I want the quick-actions strip and its buttons to keep working, so that the refactor doesn't regress the touch interface.
20. As a reader opening a shared note, I want the read-only share view to render with no command wiring at all, so that read-only viewing can't accidentally trigger intents.
21. As a reader opening a shared note, I want the read-only chip strip and RO statusline to be unchanged, so that sharing looks exactly as before.
22. As a note author, I want the help buffer to list shortcuts that match reality, so that the help teaches what the keys actually do.
23. As a note author, I want newly added shortcuts to appear in help automatically, so that help never lags behind behavior.
24. As a maintainer, I want all `:` command semantics tested through one pure interface with a fake editor, so that command changes are verified without a browser, an editor instance, or a database.
25. As a maintainer, I want the shortcut table tested as a pure keydown-to-intent mapping, so that key regressions like the `/` bugs are caught by a unit test.
26. As a maintainer, I want the save-state lifecycle tested, so that the stale-indicator bug can never return unnoticed.
27. As a maintainer, I want adding a command to be one edit in the command layer, so that the change surface stops being four files.
28. As a maintainer, I want adding a shortcut to be one row in the shortcut table, so that the help text and both listener contexts follow automatically.
29. As a maintainer, I want the editor component to have a small editing-focused interface, so that new call sites (like the share view) don't wire up no-op callbacks.
30. As a maintainer, I want the buffer workspace to stop assembling a thirteen-closure command context, so that the app's most-changed file gets smaller and its churn drops.
31. As an AFK agent, I want the command semantics behind a pure, deterministic interface, so that I can safely implement and verify command changes without a human verifying by hand.

## Implementation Decisions

- **One intent vocabulary.** A single Intent type becomes the app's language for "the user asked the app to do X." Shortcut keydowns, editor-detected gestures, and parsed `:` commands all funnel into it, and one dispatch turns intents into effects. No new module names beyond this vocabulary are introduced to callers.

- **The command layer keeps its shape, shrinks its interface.** The existing dispatcher (raw command text in, effects out) is the seam; its command context shrinks from thirteen assembled closures to a small set of note operations: save, quit, create, delete/archive policy, notify. The delete-vs-archive policy ("empty buffer is deleted for real, non-empty is archived") moves into these note operations, out of the buffer workspace component.

- **An editor-operations adapter sits at the command seam.** The dispatcher currently reaches into the live editor view (document splices for `:rename`, vim ex-command execution). Instead it receives a small adapter — read the document, replace the first H1, execute a vim ex command — and the editor is the sole production implementation. Tests supply a fake. The raw editor-view escape hatch is removed from the handle other modules see.

- **The shortcut table is data, not two listeners.** A pure predicate maps a keyboard event plus the current vim mode to an Intent or nothing. It owns mode legality (e.g. `:` only in NORMAL). The two existing listeners — the editor's capture-phase listener and the shell's document-level listener — become two-line adapters over the table. Their event-ordering precedence stays as-is; the table removes the duplication, not the ordering.

- **Help is derived.** The help buffer's global-shortcut section renders from the shortcut table, so it cannot drift. Statusline hint text may consume the same table opportunistically but is not required to.

- **The editor's interface shrinks to editing.** The editor component's interface contracts from twelve props (six of them pass-through app-intent callbacks) to roughly: content, settings, read-only flag, vim-enabled flag, and one `onIntent` callback (or direct store writes, following the precedent of how it already publishes mode and cursor). The read-only share view passes only editing concerns — no no-op callback wall.

- **Save state gets a single writer.** The manual-save hook becomes the only writer of the save-state store field: it sets clean on mount, and derives dirty/saving/clean from its revision counters throughout the write path. The status bar, buffer header, and statusline continue reading the store field unchanged — it becomes a read-only projection. The early-return path in the write flow must also produce a correct state, not skip state updates.

- **Interface-width cleanups ride along.** The command-chip data moves next to its only consumer (the command dock); the `force` parameter on quit is removed (it documents nothing); the dead client-revision return value on the save action is dropped.

- **Test runner.** Vitest, with a DOM-capable environment only for the one hook-lifecycle test. This is the repo's first test infrastructure; the runner must not require a running app, database, or editor.

- **No behavior changes.** Same commands, same keys, same visuals, same local `/` search (which stays inside the vim engine untouched). This refactor is observable only through the save-state bug fix.

- **No schema changes, no new API contracts.** The server action surface is untouched except for dropping the dead return value.

## Testing Decisions

- **A good test crosses the module's interface and asserts external behavior**: feed command text or a synthetic keydown in; assert what the fake editor adapter and note operations were asked to do, and what save state resulted. Never assert the dispatcher's internal structure, call counts of internals, or listener wiring details.

- **Primary seam — the command dispatch interface (existing, highest).** Every `:` command (`:w`, `:q`, `:new`, `:rename`, `:set`, `:archive`, delete policy) is tested against a recording fake editor adapter and minimal fake note operations. Zero DOM, zero CodeMirror, zero router, zero database. Command-level save-state transitions (clean→saving→clean, early-return-stays-clean) are asserted here.

- **Feeding seam — the shortcut table.** Pure predicate tests: keydown + vim mode → expected Intent (or none). Key legality cases (`:` in NORMAL vs INSERT, Ctrl+/ inside and outside the editor) are regression tests named after the historical bugs. Intent→effect behavior is deliberately NOT re-asserted here; it is proven once at the primary seam.

- **Hook lifecycle — the save-state reset.** One render-hook test with a fake save action covering: fresh mount reads clean, dirtying then unmounting/remounting a second buffer reads clean again (the stale "[+]" regression), and a no-change write leaves clean.

- **Prior art: none.** This repo has zero tests today; this spec establishes the runner and the first suite. The pure derivation modules elsewhere in the codebase remain untested and out of scope here.

- **Tests come first for the regressions they encode**: the `:`-in-NORMAL-only rule, the both-contexts Ctrl+/, and the save-state reset are written before the refactor moves code, so the suite proves behavior is preserved.

## Out of Scope

- **Note mutation protocol** (optimistic write + fire-and-forget server call + immortal cache = silent divergence on failure). A separate, independent candidate.
- **Note visibility & ordering policy** (pinned dropped by tags/search, archived included by the quick switcher). Separate candidate.
- **Shares folded into the query regime** and the inspector panel extraction from the buffer workspace.
- **Search-match handoff via URL** (the one-shot store channel consumed during render).
- **Per-keystroke store fan-out** (cursor/save-state writes on every keystroke reaching four subscribers). Performance work, not correctness.
- **Settings optimistic-save deduplication** (two drifted copies).
- Any UI/visual changes, new commands, new shortcuts, or changes to the vim engine's own keymap.
- Testing the pure derivation modules (tags, graph, grouping, title derivation) — worthwhile, but a separate suite.
- Any database schema or server contract change beyond dropping a dead return value.

## Further Notes

- This spec is the top recommendation from the architecture review of 2026-09-10. It deliberately bundles the command-layer deepening with its two on-ramps (the shortcut table and the editor interface slimming) because they share the intent vocabulary — building any one alone would force the others to reinvent it. The save-state fix rides along because it lives in the same write flow the command tests cover.
- The buffer workspace is the most-changed file in the repo (seven of the last ~20 commits). Its closure mesh is the churn engine; this spec removes the heaviest part of it.
- No ADRs exist yet. If the editor-operations adapter proves out, a follow-up note-operations adapter (server-side) would complete the symmetric seam; record that decision as an ADR when made.
- No CONTEXT.md exists yet; the spec uses the app's own established vocabulary (buffer, command dock, statusline, quick switcher, search palette, share view, archive, save state). If any term feels fuzzy during implementation, feed it to domain-modeling rather than inventing a synonym.
