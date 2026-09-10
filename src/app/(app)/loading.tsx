import Image from "next/image";

/**
 * Shown by Next.js while AppLayout's auth check + notes prefetch (and the
 * page's own async work) are in flight -- covers the gap on client-side
 * navigation into this route group (e.g. right after login) where nothing
 * else fills the screen. Mirrors Dashboard's shape so the swap-in feels
 * like a continuation rather than a generic spinner.
 */
export default function AppLoading() {
  return (
    <div className="min-h-screen bg-surface flex items-start justify-center px-space-6 py-space-8">
      <div className="w-full max-w-2xl flex flex-col items-center gap-space-6">
        <div className="flex flex-col items-center gap-space-2">
          <Image src="/logo.svg" alt="RbNotes" width={40} height={40} className="h-10 w-auto" />
          <p className="flex items-center gap-space-2 font-code-editor text-code-editor text-on-surface-variant">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
            mounting workspace...
          </p>
        </div>

        <div className="flex flex-col gap-space-3 w-full">
          <div className="h-9 w-full rounded bg-surface-container animate-pulse" />
          <div className="flex flex-col gap-space-px">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-9 w-full rounded bg-surface-container-low animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
