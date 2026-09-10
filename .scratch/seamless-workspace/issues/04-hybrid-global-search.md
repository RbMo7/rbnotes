# 04: Hybrid global search

**What to build:** `Ctrl+/` opens instantly and always returns complete results: from the warm local cache once everything is warm (fast, offline-capable), from the server fallback during the warm window so early searches never silently miss notes. Picking a result opens the buffer at the match.

**Blocked by:** 02 (needs warm-up to demo and verify the warm-cache branch).

**Status:** ready-for-agent

- [x] The overlay opens instantly with no network block
- [x] Fully warmed: results come from the local cache, complete and instant
- [x] During warm-up: results come from the server fallback and miss nothing
- [x] Selecting a result opens the buffer with the match handed off and selected
