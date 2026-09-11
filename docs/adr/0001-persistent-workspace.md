# Persistent workspace with warmed buffers

The app felt like a website: first paint waited on every note's full content, and each note was a route that remounted the editor with skeletons. We decided on a persistent workspace (buffer switches are instant client state in one shell, URLs sync via pushed history) with first paint on metadata only and note contents warmed invisibly afterward — because the product bar is a native-feeling, zero-friction notes app, and no amount of prefetching makes route-per-note switching clicky.

## Considered Options

- Keep per-note routes and remove just the remount (persistent editor above the route, swapping documents). Smaller change, keeps framework-idiomatic routing, but transitions still round-trip the router and cache misses still flash skeletons: near-zero friction, not zero.
- Server-always global search. Consistent and complete, but pays a network round-trip on every invocation forever. Rejected in favor of warm-cache-first with a server fallback only during the warm window.

## Consequences

- Back/Forward walk buffer history with cursor restoration rather than triggering data fetches; deep links still work as workspace entry points.
- Unwarmed content is represented as absent, never empty, so a save can never overwrite real content with an empty document; late warm-up writes never clobber dirty buffers.

## Amendment (unified shell)

Home entry is no longer "resolve to the most-recently-updated buffer" — bare `/notes` now redirects to the Dashboard at `/`, a real route rendered inside this same persistent shell. The most-recent-buffer resolution survives only inside `goHome()`, used after a note is deleted, where landing on the Dashboard instead of the next buffer would be a jarring context switch. `clearToHome` (the "no notes left" fallback) is gone; that case now navigates to `/` directly.

## Amendment (batched warm-up)

Content warming is no longer a serial per-note loop with an artificial stagger between requests — it's a single batched fetch of every note's content, fired once right after first paint. The serial loop existed to avoid hammering the server, but at this app's expected scale (a personal notes app, short-form content) a single request costs about the same as one of the old per-note requests while eliminating the other N-1 round trips entirely; Next.js Server Actions also serialize on the client dispatcher by design, so N per-note requests couldn't have been parallelized anyway. Cold-open no longer jumps a queue to fetch on demand, since there's no longer a queue — every note becomes warm at the same moment the one batch resolves.

## Amendment (mobile screens)

Below the mobile breakpoint, the Workspace presents a List screen (no buffer open) and a Note screen (one buffer open) as full-screen states. Back, from Note to List, is an ordinary navigation to `/` — the same Dashboard-route transition the unified-shell amendment above already describes (a real route, rendered inside this same persistent shell, `WorkspaceProvider` swapping `WorkspaceBuffer` for `children`), just reached from a back button instead of the wordmark. No new navigation mechanism, no remount of the shell itself, and warmed buffers stay warm across it. Desktop's sidebar-overlay-over-persistent-buffer presentation is untouched; mobile is a second view over the same Workspace state, gated by the existing viewport-width check, not a fork of it.
