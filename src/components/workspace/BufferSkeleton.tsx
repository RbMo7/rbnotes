/**
 * Shown only for a genuinely cold buffer -- content requested (cold-open
 * jumps the warm-up queue for it) but not back yet. Absolutely positioned
 * over the editor canvas rather than replacing it, so the persistent Editor
 * underneath never unmounts while this shows (see Editor.tsx's module doc).
 */
export function BufferSkeleton() {
  return (
    <div className="absolute inset-0 bg-surface-dim overflow-hidden rounded-lg p-space-6 z-10">
      <div className="flex flex-col gap-space-3">
        <div className="h-4 w-2/3 rounded bg-surface-container-high animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-surface-container-high animate-pulse" />
        <div className="h-4 w-3/5 rounded bg-surface-container-high animate-pulse" />
      </div>
    </div>
  );
}
