"use client";

import { useEffect, useState } from "react";

function ProgressRing({ progress, size = 16 }: { progress: number; size?: number }) {
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        fill="none"
        className="stroke-outline-variant"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="stroke-primary transition-[stroke-dashoffset] duration-300 ease-out"
      />
    </svg>
  );
}

/**
 * Visible feedback for useMigrateLocalNotes's server push -- without this,
 * adopting several Local-only notes into a Synced account on sign-in
 * looked like nothing was happening (or that the notes had vanished) for
 * however long the pushes took. Stays mounted a beat after the last note
 * lands so "done" reads as a state the user actually sees, not just a
 * toast disappearing mid-thought.
 */
export function SyncingNotesToast({ total, current }: { total: number; current: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (total === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
    if (current < total) return;
    const timer = setTimeout(() => setVisible(false), 1200);
    return () => clearTimeout(timer);
  }, [total, current]);

  if (!visible) return null;

  const done = current >= total;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(var(--spacing-status-bar-height)+1rem)] right-4 z-50 flex items-center gap-space-2 px-space-3 py-space-2 bg-surface-container-high border border-outline-variant font-label-sm text-label-sm shadow-lg"
    >
      <ProgressRing progress={total === 0 ? 0 : current / total} />
      <span className="text-primary font-bold">&gt;&gt;</span>
      <span className="text-on-surface">{done ? "offline notes synced" : "syncing offline notes"}</span>
      <span className="text-on-surface-variant font-code-editor">
        {current}/{total}
      </span>
    </div>
  );
}
