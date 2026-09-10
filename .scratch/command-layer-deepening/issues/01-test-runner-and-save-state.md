# 01: Test runner + save-state single writer

**What to build:** The repo gets its first test command (`npm test`), and the save indicator becomes honest. Today the statusline, buffer header, and status bar show "[+]" (modified) for a clean note whenever the previous note was left dirty — and pressing `:w` on that clean note fails to clear the lie. After this ticket, switching buffers always shows the truth, an explicit write on a clean buffer reports clean, and a write on a modified buffer shows saving then clean. The manual-save hook becomes the single writer of the save-state store field: it sets clean on mount and derives dirty/saving/clean from its revision counters through the whole write path, including the no-change early return. The status bar, buffer header, and statusline keep reading the store field unchanged — it becomes a read-only projection.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Vitest is installed and configured; `npm test` runs the suite green in CI-shape (no dev server, no database, no browser)
- [ ] A render-hook test with a fake save action documents the stale-indicator bug first (red), then the fix turns it green
- [ ] Switching from a dirty note to a clean note shows clean, not "[+]"
- [ ] `:w` on a clean buffer leaves the indicator clean; `:w` on a modified buffer shows saving then clean
- [ ] The save-state store field has exactly one writer; the status bar, buffer header, and statusline are unchanged consumers
