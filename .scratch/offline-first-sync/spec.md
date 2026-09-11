# Offline-first local storage with paid sync

Status: ready-for-agent

## Problem Statement

Today the app has zero client-side persistence: the note cache is in-memory only, and a refresh — or closing the tab — mid-debounce silently loses whatever the user just typed. The app also only works with a network connection and an account; there's no way to just open it and start typing. The user wants a notes app that feels instant and never loses a keystroke, works fully offline, and where sign-in becomes optional rather than required — laying the groundwork for a free (local-only) / paid (synced) split later.

## Solution

Every note is stored fully in the browser (a new Local store, IndexedDB-backed) as the source of truth for editing — this is universal, whether or not the user is signed in. Signing in doesn't change how notes are edited; it adds a one-directional sync push (Local store → server) on top of the same storage. Anonymous sessions get fully-featured Local-only notes with zero backend calls for note content; a lightweight per-device ping counts free-tier usage without requiring an account. Conflict resolution is last-write-wins, no merge — the app assumes one active device at a time.

## User Stories

### Local durability

1. As a note-taker, I want every keystroke to persist to the browser immediately, so that refreshing or closing the tab right after typing never loses what I wrote.
2. As a note-taker, I want the app to work fully offline — creating, editing, and deleting notes — so that a lost connection never blocks me.
3. As a note-taker, I want my Edited mark to update the instant I make a change, regardless of network state, so that I can always see my note reflects my latest edit.
4. As a note-taker, I want a deleted note to disappear from my view immediately but not be purged until the deletion has had a chance to sync, so that an offline delete isn't lost or resurrected.
5. As a note-taker creating a note while offline, I want it to get a real, permanent id immediately, so that I can keep working with it exactly like any other note.

### Sync (signed-in)

6. As a signed-in note-taker, I want my locally-edited notes to push to the server automatically, so that they're backed up and available on another device.
7. As a signed-in note-taker, I want the push to happen shortly after I stop typing, on tab blur, on regaining connectivity, and periodically in the background while changes are pending, so that sync happens promptly without me thinking about it.
8. As a signed-in note-taker, I want to see a Synced mark separate from my Edited mark, so that I can tell whether my latest change has actually reached the server.
9. As a signed-in note-taker who edited the same note from two different offline sessions, I want the most recent push to simply win, so that sync never blocks me with a conflict-resolution prompt.
10. As a signed-in note-taker on a new device, I want my existing synced notes to hydrate into the local store on first login, so that I see my full note history everywhere I sign in.
11. As a signed-in note-taker, I want a failed push (not offline, a genuine error) to retry automatically first and only surface a manual retry as a last resort, so that transient errors don't need my attention.

### Free / local-only tier

12. As a first-time visitor, I want to land on the Dashboard and start typing without signing in, so that using the app has zero friction.
13. As an anonymous user, I want my notes to stay entirely in my browser and never touch the server, so that using the app for free never requires trusting it with my data.
14. As an anonymous user, I want a persistent, unobtrusive indicator that I'm in local-only mode, so that I understand my notes aren't backed up anywhere else.
15. As an anonymous user, I want signing in at any point to start syncing my existing local notes going forward, so that upgrading doesn't feel like starting over.
16. As the product owner, I want anonymous browser installs counted (first seen / last seen) without requiring sign-in, so that I can track free-tier usage and eventual free-to-paid conversion.

### Existing users

17. As an existing signed-in user, I want my current notes to remain fully synced with no action required, so that this change doesn't regress what already works.

## Implementation Decisions

- **Local store** (Seam 1): a new module wrapping IndexedDB with a plain interface — get, set, list, tombstone, purge — keyed by note id. This becomes the single source of truth the editor reads from and writes to; the existing in-memory-only TanStack Query cache is backed by it (via a persister) rather than replaced with a separate mechanism.
- **NoteRecord** gains two client-facing timestamp concepts: **Edited mark** (set on every local change, immediately) and **Synced mark** (set only once a push succeeds). The existing server-side `updatedAt` (Prisma `@updatedAt`) becomes the source for the Synced mark on the server side; the Edited mark is purely client-side and never blocked by network state.
- **Tombstone**: deletes are a flag + timestamp on the note, synced like any other edit, purged only after the server has confirmed it (or immediately, locally, for a note that never reached the server in the first place — i.e. a Local-only note or a Synced note never yet pushed).
- **Sync scheduler** (Seam 2): extends the existing `useAutosave` engine rather than introducing a parallel system — same per-note dirty tracking, debounce, and revision/savedRevision race guard. Adds: offline-awareness (skip flush attempts while `navigator.onLine` is false), retry on the browser `online` event, a periodic background retry while any note is dirty, and reads/writes going through the Local store instead of directly against the live editor document.
- **Sync direction**: one-directional push only, Local store → server. The server never pushes changes back down except a one-time hydration of existing Synced notes into a new device's Local store on login. No version vectors, no ETags, no merge — last push wins, matching the existing plain-overwrite `upsertNoteContent`.
- **Auth becomes optional**: `(app)/layout.tsx` switches from `getAuthedUser()` (redirects to `/login`) to the already-existing `getOptionalUser()` (returns `null`, no redirect). Presence of a session is what determines Local-only vs. Synced — no separate signup/plan flag yet; billing enforcement is a later, separate concern. Server actions and `lib/notes.ts` are unchanged — they still require a real authenticated `userId` and are simply never called for an anonymous session.
- **Existing users are grandfathered**: any note that already exists in Postgres today is treated as Synced on ship; no migration, no forced local-only fallback.
- **Anonymous device tracking**: a small new table, `AnonymousDevice { id, firstSeenAt, lastSeenAt }`, populated via a lightweight server action pinged on load / periodically from a random id generated client-side and stored in the Local store. Carries no note content and no account link unless/until that browser signs in.
- **Storage layer is universal, sync is an add-on**: one code path for editing and local persistence regardless of tier; signing in only adds the push behavior on top. No separate "free" vs. "paid" storage implementation.
- **UI indicator**: a persistent, non-dismissible badge (not a toast) shown whenever a session is Local-only, reflecting a durable tier state rather than a transient condition.

## Testing Decisions

- Tests should assert on externally observable behavior — what ends up in the Local store, what gets pushed and when, what the UI shows — never on internal function calls or module-private state.
- **Local store** (Seam 1): unit-tested in isolation with `fake-indexeddb`, no React, no network — get/set/list/tombstone/purge round-trips, and that a tombstoned note is excluded from list reads but retained until purge.
- **Sync scheduler** (Seam 2, extending `useAutosave`): extend `useAutosave.test.ts`'s existing fake-timer + mocked `saveNoteContentAction` pattern with new scenarios — flush is skipped while offline, a pending flush fires on the `online` event, periodic retry eventually flushes a long-dirty note, and a second local edit arriving mid-push is not clobbered by that push's response (already covered by the existing revision/savedRevision guard, extend rather than duplicate).
- **Optional-login gate**: an integration test in the style of `save-state.integration.test.tsx`, asserting an anonymous session renders the Dashboard without redirecting and never triggers a note-content server call.
- **Device ping**: tested like the other functions in `src/server/actions/notes.ts` — a straightforward action test, no new pattern.
- Prior art throughout: `notes-query.test.ts` (cache/store round-trips), `useAutosave.test.ts` (debounce/flush timing with fake timers), `Editor.persistence.test.tsx` and `save-state.integration.test.tsx` (integration-level save-state assertions).

## Out of Scope

- Real-time bidirectional sync, version vectors, or git-like merge conflict resolution. Last-write-wins is final for now; a versioned/merge approach is a noted future idea, not built here (see `docs/adr/0002-offline-first-local-storage.md`).
- Same-device, multiple-tab conflict handling on the same note (e.g. via `BroadcastChannel` or a lock). Known gap, unaddressed.
- Billing/plan enforcement — a session existing is the only signal used to determine Synced vs. Local-only in this spec; actually gating or charging for sync is a separate later effort.
- Data export/backup tooling for Local-only notes.
- Any change to the sharing (`NoteShare`) mechanism.

## Further Notes

- This spec supersedes the "close-tab durability guarantee" that `useAutosave.ts` currently defers as out-of-scope/follow-up work — the Local store is exactly that follow-up.
- `docs/adr/0002-offline-first-local-storage.md` records the architectural decision this spec implements; `CONTEXT.md`'s "Storage & sync" section defines the canonical terms (Local-only note, Synced note, Edited mark, Synced mark, Tombstone, Device) used throughout.
- The badge UI, exact ping cadence, and periodic-retry interval are left to implementation judgment within the decisions above — no specific values were mandated during design.
