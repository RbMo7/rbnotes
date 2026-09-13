/**
 * The Stitch login screen's `#status-toast` — an opacity-toggled status
 * line under the terminal window, `>> message [OK]`. Promoted from pure
 * decoration to the app's real error/status surface for the auth flow, in
 * the design's own error color when it's reporting a failure.
 */
export function StatusToast({
  message,
  tone = "info",
  onUndo,
}: {
  message: string | null;
  tone?: "info" | "error";
  /** An action worth reversing (e.g. archiving a note) -- renders an Undo button in place of the [OK]/[ERR] tag. */
  onUndo?: () => void;
}) {
  return (
    <div
      className={`transition-opacity duration-200 mt-space-2 p-space-2 bg-surface-container-high border text-on-surface font-label-sm text-label-sm flex items-center justify-between select-none ${
        message ? "opacity-100" : "opacity-0"
      } ${tone === "error" ? "border-error" : "border-outline-variant"}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-space-2">
        <span className={tone === "error" ? "text-error font-bold" : "text-primary font-bold"}>
          &gt;&gt;
        </span>
        <span>{message ?? "Ready"}</span>
      </div>
      {onUndo ? (
        <button
          onClick={onUndo}
          className="px-space-2 py-space-0 bg-primary/10 text-primary hover:bg-primary/20 rounded font-medium"
        >
          Undo
        </button>
      ) : (
        <span className={tone === "error" ? "text-error font-code-editor" : "text-on-surface-variant font-code-editor"}>
          {tone === "error" ? "[ERR]" : "[OK]"}
        </span>
      )}
    </div>
  );
}
