# 07: Autosave with force-flush

**What to build:** Typing persists silently in the background after a short idle; `:w` and Ctrl+S flush immediately down the same path. A `[+]` marker shows dirty state and clears silently on success; failed saves keep all text and offer visible retry.

**Blocked by:** 05 (integrates once with the workspace buffer lifecycle, not twice).

**Status:** ready-for-agent

- [x] Edits persist silently after a short idle with no toast or banner
- [x] `:w` and Ctrl+S persist immediately through the same path
- [x] `[+]` shows while dirty and clears silently on success
- [x] A failed save retains all text and surfaces a visible retry
