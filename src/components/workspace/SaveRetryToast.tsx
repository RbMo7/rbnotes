/**
 * The one visible surface for a failed autosave: success is always silent
 * (see useAutosave.ts), but a failure must never leave the user guessing --
 * the text itself is untouched (still sitting in the live CodeMirror
 * document), this is just the affordance to try persisting it again.
 */
export function SaveRetryToast({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mt-space-3 flex items-center justify-between gap-space-3 p-space-2 bg-surface-container-high border border-error font-label-sm text-label-sm"
    >
      <span className="flex items-center gap-space-2">
        <span className="text-error font-bold">&gt;&gt;</span>
        <span className="text-on-surface">save failed -- your text is safe, not yet persisted</span>
      </span>
      <button
        onClick={onRetry}
        className="px-space-2 py-space-0 bg-error/10 text-error hover:bg-error/20 rounded font-medium"
      >
        Retry
      </button>
    </div>
  );
}
