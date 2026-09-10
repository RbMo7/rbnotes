# 06: History and deep links

**What to build:** Each buffer switch pushes history so Back steps through previously opened notes and Forward restores note plus cursor; Back past the trail exits without trapping. Note links load the workspace with that exact buffer open, and refresh restores the same buffer.

**Blocked by:** 05 (needs the workspace shell and client-state switching).

**Status:** ready-for-agent

- [x] Back walks previously opened notes; Forward restores note plus cursor position
- [x] Back past the oldest trail entry exits the workspace (no trap)
- [x] A note link opens the workspace with that exact buffer (cold via on-demand fetch, unknown via E484)
- [x] Refresh restores the same buffer
