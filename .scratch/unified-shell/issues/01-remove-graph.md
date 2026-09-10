# 01: Remove the graph feature from the UI

**What to build:** Delete the graph route and its components; keep the pure edge-computation logic dormant for a later return. Drop it from route protection.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] `src/components/graph/GraphView.tsx` and `GraphSkeleton.tsx` deleted
- [x] `src/app/(app)/graph/page.tsx` and `loading.tsx` deleted
- [x] `src/lib/graph.ts` untouched, left unreferenced (do not delete — the feature returns later)
- [x] `/graph` removed from `PROTECTED_PREFIXES` in `src/lib/supabase/middleware.ts`
- [x] `npm run build` succeeds with no dangling imports
