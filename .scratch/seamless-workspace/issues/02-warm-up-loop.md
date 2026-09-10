# 02: Background warm-up loop

**What to build:** After first paint, every note's content warms invisibly into the same collection, most-recently-updated first, one at a time, so that whatever the user opens next is already there and opens with zero loading state.

**Blocked by:** 01 (needs the per-note content fetch and the absent-vs-empty representation).

**Status:** ready-for-agent

- [x] Contents warm most-recently-updated first, strictly serial with a small stagger, and nothing visible changes while warming
- [x] A warmed note opens instantly with no skeleton, spinner, or blank flash
- [x] Buffers holding unsaved local state are skipped by warm-up
- [x] A late-arriving fetch never overwrites newer or dirty content (stale-never-clobbers)
