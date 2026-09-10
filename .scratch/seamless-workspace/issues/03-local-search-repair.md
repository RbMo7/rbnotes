# 03: Real-vim `/` search repair

**What to build:** In-buffer `/` search works like real vim: the prompt takes focus reliably, typing incrementally jumps to matches, `n`/`N` repeat, E486 reports no match without moving the cursor, `Esc` cancels cleanly, and prompt keystrokes never leak into the buffer as insert-mode input. Engine ownership of bare `/` is reaffirmed, not relitigated.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] `/` followed by typing incrementally jumps to matches in the current buffer
- [x] `n`/`N` repeat forward/backward; E486 leaves the cursor unmoved; `Esc` restores prior state
- [x] Prompt keystrokes never reach the buffer as inserts
- [x] Regression test named after the focus-race bug; no app-level interception of bare `/`
