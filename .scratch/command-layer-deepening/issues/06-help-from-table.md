# 06: Help renders from the shortcut table

**What to build:** The help buffer's global-shortcut section stops being a hand-maintained copy of the keybindings. It renders from the shortcut table built in ticket 04, so the help a reader sees is the same data the listeners dispatch on — it can't drift. Adding a shortcut to the table updates the help buffer for free. The layout and content of the help buffer look the same as today; only the source of the global section changes. Statusline hint text may consume the same table opportunistically but is not required to.

**Blocked by:** 04 — One shortcut table → intents (the table is the data source).

**Status:** ready-for-agent

- [ ] The help buffer's global-shortcut section is generated from the shortcut table
- [ ] Every row shown in help matches a shortcut the listeners actually dispatch
- [ ] The help buffer's layout and remaining sections (vim keys etc.) are unchanged
- [ ] Adding a row to the shortcut table makes it appear in help with no help-side edit
