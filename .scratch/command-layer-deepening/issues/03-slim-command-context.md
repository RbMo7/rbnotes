# 03: Slim the command context; policy leaves the buffer workspace

**What to build:** The buffer workspace — the app's most-changed file — stops hand-assembling a thirteen-closure command context. The context shrinks to a small set of note operations: save, quit, create, delete/archive, notify. The delete-vs-archive policy ("an empty buffer is deleted for real; a non-empty buffer is archived") moves into these note operations, out of the buffer workspace, so command policy lives in the command layer. Interface-width cleanups ride along: the command-chip data moves next to its only consumer (the command dock); the meaningless `force` parameter on quit is removed; the dead client-revision return value on the save action is dropped. The command suite from ticket 02 stays green throughout, now covering the policy from its new home.

**Blocked by:** 02 — EditorOps adapter at the command seam + command suite (the slim context is shaped around the adapter; slimming before it exists is rework).

**Status:** ready-for-agent

- [ ] The command context is a small, named set of note operations instead of thirteen ad-hoc closures
- [ ] The delete-vs-archive policy lives in the command layer's note operations, verified by the command suite
- [ ] The buffer workspace no longer contains command policy or chip data
- [ ] `quit(force)` parameter removed; dead client-revision return value dropped from the save action's contract
- [ ] The command suite from 02 passes unmodified (bar the policy's new assertions)
