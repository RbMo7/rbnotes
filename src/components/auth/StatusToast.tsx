/**
 * The Stitch login screen's `#status-toast` — an opacity-toggled status
 * line under the terminal window, `>> message [OK]`. Promoted from pure
 * decoration to the app's real error/status surface for the auth flow, in
 * the design's own error color when it's reporting a failure.
 */
export function StatusToast({
  message,
  tone = "info",
}: {
  message: string | null;
  tone?: "info" | "error";
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
      <span className={tone === "error" ? "text-error font-code-editor" : "text-on-surface-variant font-code-editor"}>
        {tone === "error" ? "[ERR]" : "[OK]"}
      </span>
    </div>
  );
}
