"use client";

import { X } from "lucide-react";

export type ShareViewer = { email: string; viewCount: number; lastViewedAt: string };

function formatViewerTime(iso: string): string {
  const date = new Date(iso);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

/**
 * The `:insp` side inspector -- the Stitch NORMAL header's own button, given
 * an actual panel behind it. Purely presentational: WorkspaceBuffer owns
 * the share/viewer state so `:share`/`:unshare` and this panel's buttons
 * stay in sync.
 */
export function InspectorPanel({
  open,
  onClose,
  loading,
  token,
  viewers,
  onShare,
  onUnshare,
  onCopy,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  token: string | null;
  viewers: ShareViewer[];
  onShare: () => void;
  onUnshare: () => void;
  onCopy: () => void;
}) {
  if (!open) return null;

  return (
    <aside className="w-72 shrink-0 bg-surface-container-low border-l border-outline-variant/30 flex flex-col h-full overflow-y-auto">
      <div className="h-14 px-space-4 border-b border-outline-variant/30 flex items-center justify-between shrink-0">
        <span className="font-label-md text-label-md text-on-surface uppercase tracking-wider">
          Inspector
        </span>
        <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="p-space-4 border-b border-outline-variant/20 flex flex-col gap-space-2">
        <div className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
          Share
        </div>
        {loading ? (
          <p className="font-body-sm text-body-sm text-outline/50">~ loading</p>
        ) : token ? (
          <>
            <button
              onClick={onCopy}
              className="text-left font-code-editor text-body-sm text-primary bg-surface-container px-space-2 py-space-2 truncate hover:bg-surface-container-high"
              title="Click to copy"
            >
              /s/{token}
            </button>
            <button
              onClick={onUnshare}
              className="text-left font-label-sm text-label-sm text-error hover:underline"
            >
              :unshare
            </button>
          </>
        ) : (
          <button
            onClick={onShare}
            className="w-full px-space-3 py-space-2 bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-fixed-dim transition-colors"
          >
            :share — create link
          </button>
        )}
      </div>

      <div className="p-space-4 flex flex-col gap-space-2 flex-1">
        <div className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
          Viewers · {viewers.length}
        </div>
        {viewers.length === 0 ? (
          <p className="font-body-sm text-body-sm text-outline/30">~ no views yet</p>
        ) : (
          <div className="space-y-space-px">
            {viewers.map((v) => (
              <div
                key={v.email}
                className="flex items-center justify-between px-space-2 py-space-1 font-body-sm text-body-sm"
              >
                <span className="flex items-center gap-space-2 truncate">
                  <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-on-primary text-[10px] font-bold shrink-0">
                    {v.email[0]?.toUpperCase()}
                  </span>
                  <span className="truncate text-on-surface-variant">{v.email}</span>
                  {v.viewCount > 1 && (
                    <span className="font-label-sm text-label-sm bg-surface-container-high text-outline px-1 shrink-0">
                      ×{v.viewCount}
                    </span>
                  )}
                </span>
                <span className="font-label-sm text-label-sm text-outline/70 shrink-0">
                  {formatViewerTime(v.lastViewedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
