/** Shared between graph/loading.tsx and GraphView's own isPending check -- see TagsSkeleton for why both are needed. */
export function GraphSkeleton() {
  return (
    <div className="w-full px-space-4 sm:px-space-8 py-space-6">
      <div className="bg-surface-container-high p-space-4">
        <div className="w-full aspect-[3/2] rounded bg-surface-container-lowest/40 animate-pulse" />
      </div>
    </div>
  );
}
