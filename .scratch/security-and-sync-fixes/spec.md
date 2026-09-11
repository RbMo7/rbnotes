# Ultrareview fixes: link XSS, ownerId tagging, sign-out/sync correctness

Status: ready-for-agent

## Problem Statement

A cloud code review of the offline-first-sync + theme-support work found nine real issues, ranging from an exploitable XSS in the new markdown-link-click feature to several data-integrity bugs in the Local-only/Synced tier split (ADR 0002): a note can leak across accounts on the same device, a pending edit can be silently lost on sign-out, a delete can be resurrected by a stale pending save, and a reload can silently overwrite unsynced local edits with older server content. All nine were grilled with the user one at a time; this spec records the agreed fix for each.

## Solution

Nine targeted fixes, described per finding below. The architecturally significant one: `LocalNote` (the Local store's record shape, `src/lib/local-notes-store.ts`) gains an `ownerId: string | null` field recording which account (or `null` for genuinely Local-only) created/last-owns a given local record. This single addition is what makes the cross-account-leak fix, the sign-out data-loss fix, and the "resume my own stranded draft" behavior all correct and non-contradictory -- without it, "unsynced" and "anonymous-origin" were being conflated, which was the actual root cause.

## User Stories

1. As a note-taker clicking a link inside a note, I want the link to only ever open if it's a genuine http/https/mailto destination, so that a malicious note (including one shared with me) can never run script in my browser via a `javascript:`/`data:`/other scripting-scheme link.
2. As a user signing into an account on a device that was previously used Local-only, I want only genuinely-anonymous local notes to be adopted into my account, never a note that was created under someone else's account on this same device, so that I never see another account's content.
3. As a user signing out mid-edit (before the 800ms autosave debounce fires), I want the app to make one best-effort attempt to push that edit to the server before actually signing me out, so that the common case (I'm online, I just clicked sign out a fraction of a second early) doesn't need a second device visit to resolve.
4. As a user whose edit didn't make it to the server before I signed out (offline, or the flush attempt failed), I want that edit preserved locally and automatically resumed the next time I sign back into my own account on this device, so that nothing is silently destroyed.
5. As a user, I want a note I just deleted to stay deleted, even if it had a save in flight or pending when I deleted it, so that `:delete` is never quietly undone by a stale background save.
6. As a user reloading the app while signed in, I want any note with genuine unpushed local edits to keep those edits, not have them silently overwritten by older content freshly fetched from the server, so that a failed or delayed background sync can never cause silent data loss.
7. As a Local-only user who pins or archives a note and then signs in, I want that note to arrive in my account still pinned/archived, so that signing in doesn't quietly reset my organization of my own notes.
8. As a user, I want signing out to actually and immediately flip the app into Local-only mode (no more auth-gated calls attempted), even though sign-out is a soft route transition and not a full page reload, so that I don't hit stray `/login` redirects right after signing out.
9. As a returning Local-only user with a non-default theme or other saved preference, I want the app not to flash mismatched content between server-render and hydration, so that the app feels stable on load, not glitchy.

## Implementation Decisions

### 1. Link scheme allow-list (XSS fix)

`live-preview.ts`'s link-click handler currently passes the raw markdown link destination straight to `window.open` with no validation. Add a small pure function (e.g. `isSafeLinkScheme(url: string): boolean`) that parses the URL and allows only `http:`, `https:`, and `mailto:` schemes (case-insensitive), returning `false` for anything else or anything that fails to parse. The click handler calls this before `window.open` and no-ops (does not open, does not preventDefault -- or does preventDefault but simply does nothing further) when it returns `false`.

### 2. `ownerId` on `LocalNote`

Add `ownerId: string | null` to the `LocalNote` type in `local-notes-store.ts`. Every write path that creates or updates a local record needs to set it correctly:
- `useCreateNote` (anonymous or Synced): set `ownerId` to the current signed-in user's id if Synced, `null` if Local-only.
- `persistLocallyImmediately` (in `useAutosave.ts`, fires on every edit): preserve the existing record's `ownerId` if present; if creating a new local mirror for a note that didn't have one yet, set it from the current session the same way `useCreateNote` does.
- `warmAllNotes`'s mirror-into-local-store step: set `ownerId` to the current signed-in user's id (this content only ever gets mirrored for a Synced session).

Two small pure eligibility predicates, alongside the existing CRUD in `local-notes-store.ts`:
- `isMigratable(note, currentUserId)`: true when `note.ownerId === null || note.ownerId === currentUserId`.
- `isPurgeable(note, signingOutUserId)`: true when `note.ownerId === signingOutUserId && note.syncedAt !== null`.

`useMigrateLocalNotes` filters candidates through `isMigratable` instead of its current `syncedAt === null` check. `purgeSyncedNotes` filters through `isPurgeable` instead of its current `syncedAt !== null` check (note the change: purge now also requires ownership match, not just "is synced").

### 3 & 4. Sign-out flush + resume-own-stranded-draft

`useSignOut` (`src/lib/use-sign-out.ts`) attempts a best-effort flush of every currently-dirty note before calling `purgeSyncedNotes`/`signOutAction` -- a short bounded timeout (e.g. 2 seconds); if the flush doesn't complete in time, proceed with sign-out regardless. This needs a way to reach `useAutosave`'s live dirty-note state and trigger a flush of all of them from outside the hook that owns it (the existing `flushAllDirty` logic already in `useAutosave`'s retry effect is the shape to reuse/expose, not duplicate).

Resuming a stranded draft is already covered by `isMigratable` above (`ownerId === currentUserId` is eligible) -- no separate mechanism needed, `useMigrateLocalNotes` already re-runs on every sign-in.

### 5. Cancel pending save on delete

`useAutosave` exposes a new `cancel(noteId)` alongside its existing `markDirty`/`flush`/`isDirty`: clears that note's pending debounce timer (and local-persist timer) and removes its `infoRef` map entry entirely. `deleteNote` (`use-note-operations.ts`) calls `cancel(activeNoteId's autosave handle)` before tombstoning/purging the Local store record, so no stale pending flush can run afterward and rewrite `deleted: false`.

### 6. Stale-overwrite guard in `warmAllNotes`

Before mirroring newly-warmed server content into the Local store, `warmAllNotes` reads the existing local record (if any). If `existing.editedAt > existing.syncedAt` (or `existing.syncedAt === null` while `existing.editedAt` is set) -- i.e. genuine unpushed local changes -- skip the mirror write for that note entirely, leaving the local version as-is. Only mirror when the local record is missing or already fully synced.

### 7. Migration carries `pinned`/`archived`

After `useMigrateLocalNotes`'s `saveNoteContentAction` call succeeds for a given note, follow it with `setNoteFlagsAction({ noteId, pinned, archived })` when either flag is `true` on the local record (that action already accepts both fields, no schema change needed). `createdAt` is explicitly out of scope (see below).

### 8. `SettingsHydrator` split (fixes stuck `syncEnabled` + hydration mismatch)

Split the current single lazy `useState` initializer into two parts:
- A synchronous seed on first mount using only server-safe values (the `settings`/`syncEnabled` props as passed -- no `loadLocalSettings()` call here, so server and client render the same thing on first pass).
- A `useEffect` that re-runs on every change to the `syncEnabled`/`settings` props (not just once on mount) and calls `setSyncEnabled`/`setSettings` there -- for a Local-only session, this effect is also where `loadLocalSettings()` gets called to overlay the real local values.

Accepted trade-off: a Local-only user with non-default settings sees a one-tick flash of default settings on first paint before the effect applies their real values -- same trade-off already made for `data-theme` specifically; this generalizes it to settings as a whole. No cookie/script-tag mechanism is being added to avoid this flash.

### Nits

- Fix the contradictory comment in `store.ts` describing `syncEnabled`'s default (currently says "defaults true", code sets `false`).
- Gate `useAutosave`'s 30-second retry `setInterval`/`online` listener on `syncEnabled` -- skip installing it entirely for a Local-only session, since there's nothing to retry.

## Testing Decisions

No new seams -- every fix reuses an existing test file/pattern:
- `isSafeLinkScheme` (and the existing `findLinkAt`): `live-preview.test.ts`, pure-function unit tests.
- `isMigratable`/`isPurgeable`: `local-notes-store.test.ts`, alongside this file's existing CRUD tests.
- Stale-overwrite guard and migration-carries-flags: `notes-query.test.tsx`, extending the existing "regression: stale-never-clobbers" pattern already there for `warmAllNotes`.
- `useAutosave.cancel` and the gated retry timer: `useAutosave.test.ts`.
- `SettingsHydrator` split and sign-out flush: integration-level tests in the style of `save-state.integration.test.tsx` (render, change props/trigger sign-out, assert store state) -- these are timing/orchestration behaviors without a clean pure-function core to extract.

Only test external behavior (what ends up in the store/Local store/what gets called), not internal implementation details.

## Out of Scope

- Migrating `createdAt` to preserve the original local timestamp (cosmetic only -- affects sidebar recency grouping and the "created X ago" label, not correctness). Server-side `createdAt` becomes "now" on migration; known, accepted gap.
- Any cookie- or script-tag-based mechanism to eliminate the settings-hydration flash entirely.
- Device-based (rather than account-based) ownership tagging -- `ownerId` is scoped to accounts only, per the agreed design.
- Any change to the sharing mechanism itself (still account-only, per the existing offline-first-sync spec's Out of Scope).

## Further Notes

- This spec's nine fixes were reached via a one-question-at-a-time grilling session; each Implementation Decision above reflects the user's actual agreed answer, not a default assumption.
- `ownerId` deserves a CONTEXT.md glossary entry and likely an ADR amendment to `docs/adr/0002-offline-first-local-storage.md` recording why it exists (the leak/data-loss root cause) -- do this as part of implementation, not a separate follow-up.
- Finding severity levels (from the cloud review) were all independently re-verified directly against the code before this spec was written -- none were false positives.
