# 05: Editor interface shrinks to editing + onIntent

**What to build:** The editor component's interface contracts to editing concerns: content, settings, read-only flag, vim-enabled flag, and a single `onIntent` callback for app intents. The six pass-through callbacks (open command dock, new note, open quick switcher, open search, toggle sidebar, force save) disappear — intents flow through the one vocabulary established in ticket 04, either via the callback or direct store writes following the editor's existing precedent for publishing mode and cursor. The read-only share view is the proof: it renders with zero command wiring, no wall of no-op lambdas — just content, read-only, and its chip strip. The buffer workspace's wiring mesh shrinks accordingly.

**Blocked by:** 04 — One shortcut table → intents (the `onIntent` vocabulary must exist to collapse the callbacks onto).

**Status:** ready-for-agent

- [ ] The editor's interface is roughly five concerns: content, settings, read-only, vim-enabled, onIntent
- [ ] The read-only share view passes no command callbacks — no no-op lambdas
- [ ] The editor's existing mode/cursor publication pattern is the precedent the intent publication follows
- [ ] All shortcuts and `:` commands behave exactly as before, per the existing suites
- [ ] The buffer workspace's editor wiring is visibly smaller
