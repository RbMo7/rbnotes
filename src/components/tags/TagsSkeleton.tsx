/**
 * Shared between tags/loading.tsx (the route-level Suspense fallback, for
 * a genuine first/hard load) and TagsView's own `isPending` check (for
 * the brief moment before the notes-query cache is readable, even on an
 * already-warm client). Without the second one, TagsView's old
 * `data: notes = []` default made a still-pending query indistinguishable
 * from "you really have zero tags", flashing the wrong empty state.
 */
export function TagsSkeleton() {
  return (
    <div className="w-full px-space-4 sm:px-space-8 py-space-6 flex flex-col sm:flex-row gap-space-8">
      <div className="w-full sm:w-56 shrink-0">
        <div className="px-space-2 font-label-sm text-label-sm text-outline uppercase tracking-wider mb-space-2">
          Tags
        </div>
        <div className="space-y-space-px">
          {[16, 14, 12, 15].map((w, i) => (
            <div key={i} className="flex items-center justify-between px-space-2 py-space-1">
              <div
                className="h-3 rounded bg-surface-container-high animate-pulse"
                style={{ width: `${w * 0.35}rem` }}
              />
              <div className="h-3 w-4 rounded bg-surface-container-high animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="px-space-2 font-label-sm text-label-sm text-outline uppercase tracking-wider mb-space-2">
          <div className="h-3 w-24 rounded bg-surface-container-high animate-pulse" />
        </div>
        <div className="space-y-space-px">
          {[20, 16, 22, 14, 18].map((w, i) => (
            <div key={i} className="flex items-center gap-space-2 px-space-2 py-space-1">
              <div className="h-3.5 w-3.5 rounded bg-surface-container-high animate-pulse shrink-0" />
              <div
                className="h-3 rounded bg-surface-container-high animate-pulse"
                style={{ width: `${w * 0.35}rem` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
