# 04: Sidebar tab switcher and tag drill-down

**What to build:** Replace the sidebar's single note list with a Buffers/Tags tab switcher. Delete the standalone `/tags` page — tag browsing becomes a two-level, ephemeral drill-down that overlays only the sidebar's list region.

**Blocked by:** None structurally, but touches the store (shares it with issue 02's Dashboard search wiring) — sequence after 02 to avoid conflicting store edits.

**Status:** done

- [x] `src/app/(app)/tags/{page,loading}.tsx` and `src/components/tags/{TagsView,TagsSkeleton}.tsx` deleted; `src/lib/tags.ts` kept
- [x] `src/components/shell/sidebar/{SidebarLists,SidebarTabs,SidebarBufferList,SidebarTagList,SidebarFilterInput}.tsx` added; `Sidebar.tsx` keeps its aside/header/actions/footer and delegates the list region to `SidebarLists`
- [x] Tab/tag/filter state is local to `SidebarLists` (`{tab, tag, filter}`), never in the store or URL
- [x] Buffers tab returns to the top-level list from any drill depth; a breadcrumb steps back exactly one level from the tag-files view
- [x] The list region is `absolute inset-0` inside a `relative` container, so the overlay structurally cannot cover the sidebar's header/actions above it — assert this in a test, not just visually
- [x] The mobile-dismiss click handler (currently on the whole `<aside>`) no longer fires on tab/tag/breadcrumb clicks
- [x] The filter input replaces the old "Quick search" button in the same slot; plain typing filters the current list client-side; a leading `/` + Enter calls a new store action (`openSearchWith`) that seeds and opens `SearchPalette`
- [x] `Ctrl+/` still opens `SearchPalette` with an empty query, unaffected by the new seed field
