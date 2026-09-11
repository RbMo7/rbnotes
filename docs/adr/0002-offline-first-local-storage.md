# Local storage as the universal base; server sync as a paid add-on

The app has zero client-side persistence today: the note cache is in-memory only (TanStack Query, no persister), autosave debounces 800ms then writes straight to Postgres, and a refresh mid-debounce silently loses the keystrokes. We decided every note is stored fully in the browser (IndexedDB) as the source of truth for editing, with server sync layered on top as a one-directional push (local → server) rather than a rewrite of the save pipeline — because the product's core promise is "never lose what you typed," and that has to hold whether or not the network, or an account, exists at all.

This also settles the free/paid boundary: an anonymous session is fully-featured Local-only notes, no sign-in required, zero server calls. Signing in doesn't change how notes are edited — it adds the push-to-server behavior on the same storage. There is no separate anonymous code path and no separate paid code path, only sync as an add-on to one storage layer.

## Considered Options

- **Two separate storage paths for free vs. paid.** Rejected — would mean maintaining two save pipelines and two sets of offline-durability bugs for what's really one feature (local durability) plus one optional add-on (sync).
- **Real-time bidirectional sync with merge (CRDT / git-like conflict resolution).** Rejected for now — the app assumes one active device at a time, so plain last-write-wins is sufficient and far simpler. Versioned writes / git-like merge conflicts are noted as a future idea, not built; revisit if simultaneous multi-device editing becomes a real use case.
- **Require an account to use the app at all.** Rejected — login becomes optional; presence of a session is what flips a browser into synced mode. Frictionless free tier (open the app, start typing, no signup) outweighs the simplicity of one universal auth gate.
- **Anonymous usage counted via full accounts only.** Rejected — a lightweight per-device ping (random local ID, first/last seen, no note content) counts free-tier usage without requiring sign-in, keeping the free tier genuinely frictionless.

## Amendment (settings is a free-tier feature, not account-gated)

`/settings` was originally listed as staying hard-gated behind an account, on the reasoning that "there's nothing to configure without one." That was wrong: line numbers, tab size, word wrap, and autosave are editor preferences, not account data, and a Local-only session has every reason to want them. `/settings` is no longer in the edge guard's protected list, `SettingsPage` uses `getOptionalUser()`, and a Local-only session's preferences persist to `localStorage` (`src/lib/local-settings.ts`) instead of the account's Profile row -- the same Synced-vs-Local-only branch `useAutosave` already takes for note content, applied to settings too. Only the Account section (email display, sign-out) stays conditional on actually having a session.

## Amendment (a local note needs an Owner, not just a Synced mark)

A cloud code review found a real cross-account leak: `useMigrateLocalNotes` decided what to adopt into a newly-signed-in account by checking `syncedAt === null` alone, and `purgeSyncedNotes` decided what to delete on sign-out the same way. That conflates two different questions -- "has this reached the server yet" and "whose is this" -- which are NOT the same thing. A note created while signed in as Alice, that just hasn't reached the server before she signs out, is unsynced but still hers. Treating "unsynced" as "anonymous-origin" meant that note could get silently adopted by Bob, if he signs in on the same device afterward.

`LocalNote` now carries an `ownerId: string | null` (CONTEXT.md's Owner) alongside `syncedAt`. Migration eligibility (`isMigratable`) and sign-out purge eligibility (`isPurgeable`) both check ownership first, `syncedAt` second:
- **Migration** only ever adopts a note with `ownerId === null` (genuinely anonymous) or `ownerId === <the signing-in account>` (that account resuming its own previously-stranded unsynced note on this device) -- never a different account's note, regardless of sync state.
- **Purge** only ever removes a note owned by the signing-out account AND already confirmed synced. A same-account note that's still unsynced is left alone rather than destroyed -- inert on the device, invisible to any other account, recoverable the next time its actual owner signs in here.

Every local write path (note creation, autosave's local mirror, the server-content warm-up mirror) now tags `ownerId` from the current session. Sign-out also makes one best-effort, time-boxed attempt to flush any pending dirty note before purging, so the common case (online, just mid-debounce) doesn't need a second device visit to resolve -- the Owner tag is what makes it safe either way, whether that flush succeeds or not.

## Consequences

- `(app)/layout.tsx` moves from `getAuthedUser()` (hard redirect to `/login`) to the already-existing `getOptionalUser()`. Session presence alone determines Local-only vs Synced — actual billing/plan enforcement is a separate, later decision.
- Existing DB-backed notes and users are grandfathered as Synced (paid) on ship — no forced migration, no one loses sync they already had.
- Same-device, multiple-tab conflicts on the same note are an explicit known gap, not handled by this design (local-storage-first doesn't fix it — two tabs would just have two local copies).
- Last-write-wins is final for the foreseeable future: no version vector, no ETag, no merge UI. If that changes, it supersedes this ADR.
