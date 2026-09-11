# Local storage as the universal base; server sync as a paid add-on

The app has zero client-side persistence today: the note cache is in-memory only (TanStack Query, no persister), autosave debounces 800ms then writes straight to Postgres, and a refresh mid-debounce silently loses the keystrokes. We decided every note is stored fully in the browser (IndexedDB) as the source of truth for editing, with server sync layered on top as a one-directional push (local → server) rather than a rewrite of the save pipeline — because the product's core promise is "never lose what you typed," and that has to hold whether or not the network, or an account, exists at all.

This also settles the free/paid boundary: an anonymous session is fully-featured Local-only notes, no sign-in required, zero server calls. Signing in doesn't change how notes are edited — it adds the push-to-server behavior on the same storage. There is no separate anonymous code path and no separate paid code path, only sync as an add-on to one storage layer.

## Considered Options

- **Two separate storage paths for free vs. paid.** Rejected — would mean maintaining two save pipelines and two sets of offline-durability bugs for what's really one feature (local durability) plus one optional add-on (sync).
- **Real-time bidirectional sync with merge (CRDT / git-like conflict resolution).** Rejected for now — the app assumes one active device at a time, so plain last-write-wins is sufficient and far simpler. Versioned writes / git-like merge conflicts are noted as a future idea, not built; revisit if simultaneous multi-device editing becomes a real use case.
- **Require an account to use the app at all.** Rejected — login becomes optional; presence of a session is what flips a browser into synced mode. Frictionless free tier (open the app, start typing, no signup) outweighs the simplicity of one universal auth gate.
- **Anonymous usage counted via full accounts only.** Rejected — a lightweight per-device ping (random local ID, first/last seen, no note content) counts free-tier usage without requiring sign-in, keeping the free tier genuinely frictionless.

## Consequences

- `(app)/layout.tsx` moves from `getAuthedUser()` (hard redirect to `/login`) to the already-existing `getOptionalUser()`. Session presence alone determines Local-only vs Synced — actual billing/plan enforcement is a separate, later decision.
- Existing DB-backed notes and users are grandfathered as Synced (paid) on ship — no forced migration, no one loses sync they already had.
- Same-device, multiple-tab conflicts on the same note are an explicit known gap, not handled by this design (local-storage-first doesn't fix it — two tabs would just have two local copies).
- Last-write-wins is final for the foreseeable future: no version vector, no ETag, no merge UI. If that changes, it supersedes this ADR.
