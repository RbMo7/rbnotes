# Persistent workspace with warmed buffers

The app felt like a website: first paint waited on every note's full content, and each note was a route that remounted the editor with skeletons. We decided on a persistent workspace (buffer switches are instant client state in one shell, URLs sync via pushed history) with first paint on metadata only and note contents warmed invisibly afterward — because the product bar is a native-feeling, zero-friction notes app, and no amount of prefetching makes route-per-note switching clicky.

## Considered Options

- Keep per-note routes and remove just the remount (persistent editor above the route, swapping documents). Smaller change, keeps framework-idiomatic routing, but transitions still round-trip the router and cache misses still flash skeletons: near-zero friction, not zero.
- Server-always global search. Consistent and complete, but pays a network round-trip on every invocation forever. Rejected in favor of warm-cache-first with a server fallback only during the warm window.

## Consequences

- Back/Forward walk buffer history with cursor restoration rather than triggering data fetches; deep links still work as workspace entry points.
- Unwarmed content is represented as absent, never empty, so a save can never overwrite real content with an empty document; late warm-up writes never clobber dirty buffers.
