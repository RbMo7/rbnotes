# 02: EditorOps adapter at the command seam + command suite

**What to build:** The `:` command dispatcher stops touching the live editor view. Instead it receives a small editor-operations adapter — read the document, replace the first H1 (for `:rename`), execute a vim ex command — and the editor component is the sole production implementation of it. The raw editor-view escape hatch is removed from the handle other modules see. With the adapter in place, the command layer's full semantics get their first test suite: every `:` command (`:w`, `:q`, `:new`, `:rename`, `:set`, `:archive`, the delete policy) is exercised through the dispatch interface against a recording fake adapter and minimal fake note operations — no DOM, no editor instance, no router, no database. Command-level save-state transitions (clean → saving → clean; a no-change write stays clean) are asserted here too.

**Blocked by:** 01 — Test runner + save-state single writer (needs the runner; the save-state transitions it asserts are fixed there).

**Status:** ready-for-agent

- [ ] The dispatcher's interface takes an editor-operations adapter, not an editor view; `:rename`'s H1 splice happens behind it
- [ ] No module outside the editor can reach the raw editor view
- [ ] A suite tests every `:` command through the dispatch interface with a fake adapter and fake note operations, zero DOM
- [ ] `:w` transitions (clean → saving → clean, no-change write stays clean) are covered at this seam
- [ ] No user-visible behavior changes; existing manual behavior is preserved
