# 05: Persistent workspace shell with instant switching

**What to build:** The rebuild's core: the shell mounts once and switching buffers is instant client state — no navigation, no remount, no skeleton or spinner. Each buffer keeps its cursor, scroll, and undo across switches. Home entry resolves to the most-recently-updated non-archived buffer with no blank hop.

**Blocked by:** 01 (needs the metadata list and the on-demand content read path).

**Status:** ready-for-agent

- [x] Switching buffers shows no loading state of any kind after first paint
- [x] Returning to a buffer restores cursor, scroll, and undo exactly as left
- [x] Home entry opens the most-recently-updated non-archived buffer directly
- [x] An account with no notes shows the empty-buffer screen with a `:new` path
