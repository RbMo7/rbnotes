import Link from "next/link";

/**
 * Persistent, non-dismissible indicator that a session is Local-only
 * (CONTEXT.md) -- a durable tier signal, not a transient offline warning,
 * so unlike SaveRetryToast this never disappears on its own.
 *
 * Styled as a vim-style mode flag (see StatusBar's NORMAL/INSERT block:
 * a solid, square, tracking-wide tag) rather than a rounded pill with a
 * "Sign in to sync" link -- Local-only is a mode this session is in, the
 * same grammar the rest of the shell already uses for that, and the sync
 * action reads as a `:command` (`[:login] sync`) to match `[:w] Save`,
 * `[:insp]`, `[:set]` elsewhere instead of generic SaaS copy.
 */
export function LocalOnlyBadge() {
  return (
    <div className="flex items-center gap-space-2 font-label-sm text-label-sm">
      <span className="px-space-2 py-space-0 border border-outline-variant text-outline font-semibold tracking-wider">
        LOCAL
      </span>
      <Link
        href="/login"
        className="text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <span className="text-primary">[:login]</span> <span>sync</span>
      </Link>
    </div>
  );
}
