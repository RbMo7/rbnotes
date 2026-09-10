/**
 * Shown instantly on navigation while the note's content streams in from
 * the server -- this is also what unlocks real prefetching for this route
 * (per Next's own docs: a dynamic segment without a `loading.js` boundary
 * isn't prefetched by `<Link>` at all; with one, "layout to first loading
 * boundary" prefetches automatically as sidebar links enter the viewport).
 * Mirrors BufferWorkspace's exact geometry (same header height, same
 * canvas treatment) so nothing shifts when the real content replaces it.
 */
export default function NoteLoading() {
  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="w-full px-space-4 sm:px-space-8 pt-space-4 sm:pt-space-2 flex-1 flex flex-col min-h-0">
          <div className="min-h-[5.5rem] flex items-center mb-space-4 shrink-0 gap-space-3">
            <div className="h-6 w-40 rounded bg-surface-container-high animate-pulse" />
            <div className="h-5 w-16 rounded bg-surface-container-high animate-pulse" />
          </div>
          <div className="w-full flex-1 min-h-[320px] relative bg-surface-dim overflow-hidden rounded-lg p-space-6">
            <div className="flex flex-col gap-space-3">
              <div className="h-4 w-2/3 rounded bg-surface-container-high animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-surface-container-high animate-pulse" />
              <div className="h-4 w-3/5 rounded bg-surface-container-high animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
