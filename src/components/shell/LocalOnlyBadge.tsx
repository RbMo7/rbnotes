import Link from "next/link";

/**
 * Persistent, non-dismissible indicator that a session is Local-only
 * (CONTEXT.md) -- a durable tier signal, not a transient offline warning,
 * so unlike SaveRetryToast this never disappears on its own.
 */
export function LocalOnlyBadge() {
  return (
    <div className="flex items-center gap-space-2 font-label-sm text-label-sm">
      <span className="px-space-2 py-[2px] rounded-full border border-outline-variant text-on-surface-variant">
        Local only
      </span>
      <Link href="/login" className="text-primary hover:underline">
        Sign in to sync
      </Link>
    </div>
  );
}
