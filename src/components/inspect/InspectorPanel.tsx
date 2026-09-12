"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useIsDesktop } from "@/lib/use-is-desktop";

export type ShareViewer = { email: string; viewCount: number; lastViewedAt: string };

const MIN_INSPECTOR_WIDTH = 240;
const MAX_INSPECTOR_WIDTH = 480;
const INSPECTOR_WIDTH_STORAGE_KEY = "rbnotes-inspector-width";
const INSPECTOR_WIDTH_VAR = "--spacing-inspector-width";

/**
 * Drag-to-resize for the inspector -- the same trick as Sidebar's own
 * useSidebarResize (writing straight to the shared @theme token that
 * w-inspector-width reads, so there's no per-frame React re-render), mirrored
 * for a panel that grows from the *right* edge inward: width is measured
 * from the pointer to the viewport's right edge instead of to its left.
 */
function useInspectorResize() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(INSPECTOR_WIDTH_STORAGE_KEY);
      if (saved) document.documentElement.style.setProperty(INSPECTOR_WIDTH_VAR, `${saved}px`);
    } catch {
      // Best-effort -- the default width from globals.css still applies.
    }
  }, []);

  const draggingRef = useRef(false);

  return useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      const width = Math.min(
        MAX_INSPECTOR_WIDTH,
        Math.max(MIN_INSPECTOR_WIDTH, window.innerWidth - ev.clientX),
      );
      document.documentElement.style.setProperty(INSPECTOR_WIDTH_VAR, `${width}px`);
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const finalWidth = getComputedStyle(document.documentElement).getPropertyValue(
        INSPECTOR_WIDTH_VAR,
      );
      try {
        localStorage.setItem(INSPECTOR_WIDTH_STORAGE_KEY, String(parseFloat(finalWidth)));
      } catch {
        // Best-effort -- the width still applies for the rest of this session.
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);
}

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
 *
 * Below the mobile breakpoint this renders as a full-screen overlay instead
 * of an inline side panel -- a fixed w-72 would squeeze the buffer down to
 * nothing on a phone-width screen. Above it, this is unchanged.
 */
export function InspectorPanel({
  open,
  onClose,
  signedIn,
  loading,
  token,
  viewers,
  onShare,
  onUnshare,
  onCopy,
}: {
  open: boolean;
  onClose: () => void;
  /** Sharing needs an account (ADR 0002) -- false shows a sign-in notice instead of loading/fetching anything. */
  signedIn: boolean;
  loading: boolean;
  token: string | null;
  viewers: ShareViewer[];
  onShare: () => void;
  onUnshare: () => void;
  onCopy: () => void;
}) {
  const isDesktop = useIsDesktop();
  const onResizeStart = useInspectorResize();

  if (!open) return null;

  const body = (
    <>
      <div className="h-14 px-space-4 border-b border-outline-variant/30 flex items-center justify-between shrink-0">
        <span className="font-label-md text-label-md text-on-surface uppercase tracking-wider">
          Inspector
        </span>
        <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {signedIn ? (
        <>
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
        </>
      ) : (
        <div className="p-space-4 flex flex-col gap-space-2">
          <div className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
            Share
          </div>
          <p className="font-body-sm text-body-sm text-outline/70">
            Local-only notes can&rsquo;t be shared.
          </p>
          <Link href="/login" className="text-primary hover:underline font-label-sm text-label-sm">
            Sign in to share
          </Link>
        </div>
      )}
    </>
  );

  if (isDesktop === false) return <MobileInspectorOverlay onClose={onClose}>{body}</MobileInspectorOverlay>;

  return (
    <aside className="relative w-inspector-width shrink-0 bg-surface-container-low border-l border-outline-variant/30 flex flex-col h-full overflow-y-auto">
      {/* Same wider-hit-zone-than-painted-line trick as Sidebar's own
          resize handle -- on the panel's left edge instead of its right,
          since the inspector grows leftward. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize inspector"
        onPointerDown={onResizeStart}
        className="hidden lg:flex items-stretch justify-center absolute top-0 -left-1 bottom-0 w-3 cursor-col-resize group z-10"
      >
        <div className="w-px group-hover:w-0.5 bg-transparent group-hover:bg-primary/50 group-active:bg-primary transition-colors" />
      </div>
      {body}
    </aside>
  );
}

function MobileInspectorOverlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <>
      <button
        aria-label="Close inspector"
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-30"
      />
      <aside className="fixed inset-x-0 bottom-0 top-1/4 z-40 bg-surface-container-low border-t border-outline-variant/30 rounded-t-xl flex flex-col overflow-y-auto">
        {children}
      </aside>
    </>
  );
}
