# 01: Metadata-first load with on-demand buffer content

**What to build:** First paint blocks only on the note list metadata so the app orients instantly; opening any note fetches its content on demand. Unwarmed content is represented as absent, never as empty, so a cold buffer can never be mistaken for an empty one.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] First paint shows the note list without waiting on any note's full content
- [x] Opening a note fetches its content on demand and displays it
- [x] A buffer whose content has not arrived is never editable; only its skeleton shows
- [x] Unknown note ids show E484, never an empty note
- [x] Regression test pinning the empty-overwrite guard, named after the bug
