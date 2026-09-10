# 04: One shortcut table → intents

**What to build:** The app's global shortcuts (Ctrl+S, Ctrl+N, Ctrl+P, Ctrl+B, Ctrl+/, and `:` in NORMAL mode) get one owner: a pure predicate that maps a keyboard event plus the current vim mode to an Intent — or nothing. The table owns key legality: `:` opens the command dock only in NORMAL mode; Ctrl+/ opens search from any focus context. The two existing listeners — the editor's capture-phase listener and the shell's document-level listener — become thin adapters over the table, each reduced to "ask the table, dispatch the intent." Intents land on the command layer from ticket 03. The predicate gets its own test list, with the cases named after the historical `/` bugs: `:` in NORMAL vs INSERT, Ctrl+/ inside and outside the editor. Intent→effect behavior is deliberately not re-asserted here — that's the command suite's job.

**Blocked by:** 03 — Slim the command context (intents must dispatch onto the slimmed command layer, not the thirteen-closure mesh).

**Status:** ready-for-agent

- [ ] A pure predicate maps keydown + vim mode → Intent; the table is data, not two listeners
- [ ] Both listeners are adapters over the table; each is only a few lines
- [ ] `:` opens the command dock only in NORMAL mode; typed colons in INSERT mode stay in the text
- [ ] Ctrl+/ works identically inside and outside the editor; Ctrl+S/N/P/B work from both contexts
- [ ] Predicate tests cover key legality, including the two historical `/` regression cases
- [ ] No new shortcuts, no changed keys, no user-visible behavior change
