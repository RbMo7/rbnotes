import type { ReactNode } from "react";

/**
 * The `auth.buffer.v1` terminal window chrome from the Stitch login screen.
 * Reused verbatim (only the title-bar label and right-side meta change) for
 * register, forgot-password, and reset — the design has one auth window,
 * not four.
 */
export function TerminalWindow({
  titleBarLabel,
  rightMeta = ["ENCODING: UTF-8", "MOD: RO"],
  footer,
  children,
}: {
  titleBarLabel: string;
  rightMeta?: string[];
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col w-full bg-surface-container-lowest border border-outline-variant shadow-2xl relative overflow-hidden">
      <div className="flex items-center justify-between px-space-4 py-space-2 bg-surface-container-high border-b border-outline-variant select-none">
        <div className="flex items-center space-x-space-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-error" />
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-tertiary-container" />
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary-container" />
          <span className="font-label-sm text-label-sm text-on-surface-variant ml-space-2 uppercase tracking-wider">
            {titleBarLabel}
          </span>
        </div>
        <div className="flex items-center space-x-space-3 font-label-sm text-label-sm text-on-surface-variant">
          {rightMeta.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      </div>
      <div className="p-space-6 flex flex-col gap-space-5">{children}</div>
      {footer}
    </div>
  );
}

export function TerminalHeader({
  tag,
  tagline,
}: {
  tag: string;
  tagline: string;
}) {
  return (
    <div className="flex flex-col gap-space-1 border-b border-outline-variant pb-space-4">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-space-2">
          <span className="text-primary font-headline-lg text-headline-lg font-bold tracking-tight">
            RbNotes
          </span>
          <span className="inline-flex items-center px-space-1 bg-primary text-on-primary font-label-sm text-label-sm font-semibold">
            {tag}
          </span>
        </div>
        <span className="font-label-sm text-label-sm text-on-surface-variant">
          tty/101
        </span>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant italic">
        &ldquo;{tagline}&rdquo;
      </p>
    </div>
  );
}

export function TerminalFooter({ hints }: { hints: [string, string][] }) {
  return (
    <div className="bg-surface-container-low border-t border-outline-variant px-space-4 py-space-2 flex flex-col sm:flex-row items-center justify-between text-on-surface-variant font-label-sm text-label-sm select-none gap-space-2">
      <div className="flex items-center gap-space-3 flex-wrap justify-center">
        {hints.map(([key, label]) => (
          <span key={key} className="flex items-center gap-space-1">
            <kbd className="bg-surface-container-high px-space-1 text-on-surface">
              {key}
            </kbd>{" "}
            {label}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-space-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <span>DAEMON: IDLE</span>
      </div>
    </div>
  );
}

export function OrDivider({ label }: { label: string }) {
  return (
    <div className="relative flex items-center justify-center my-space-1">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-outline-variant" />
      </div>
      <div className="relative bg-surface-container-lowest px-space-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest select-none">
        {label}
      </div>
    </div>
  );
}
