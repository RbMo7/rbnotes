import type { ReactNode } from "react";

/**
 * The shared auth window chrome: one terminal-styled frame, reused verbatim
 * (only the title-bar label changes) across login, register,
 * forgot-password, and reset — the design has one auth window, not four.
 */
export function TerminalWindow({
  titleBarLabel,
  children,
}: {
  titleBarLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col w-full bg-surface-container-lowest border border-outline-variant shadow-2xl">
      <div className="px-space-4 py-space-2 bg-surface-container-high border-b border-outline-variant select-none">
        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
          {titleBarLabel}
        </span>
      </div>
      <div className="p-space-6 flex flex-col gap-space-5">{children}</div>
    </div>
  );
}

export function TerminalHeader({ tagline }: { tagline: string }) {
  return (
    <div className="flex flex-col gap-space-1 border-b border-outline-variant pb-space-4">
      <span className="text-primary font-headline-lg text-headline-lg font-bold tracking-tight">
        RbNotes
      </span>
      <p className="font-body-sm text-body-sm text-on-surface-variant italic">
        &ldquo;{tagline}&rdquo;
      </p>
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
