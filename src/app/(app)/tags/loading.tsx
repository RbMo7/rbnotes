import { TagsSkeleton } from "@/components/tags/TagsSkeleton";

/**
 * Route-level Suspense fallback for a genuine first/hard load into /tags
 * (also what unlocks real <Link> prefetching for this route -- a dynamic
 * segment with no loading.js boundary isn't prefetched at all). See
 * TagsSkeleton for why TagsView also needs this same skeleton itself, not
 * just here.
 */
export default function TagsLoading() {
  return <TagsSkeleton />;
}
