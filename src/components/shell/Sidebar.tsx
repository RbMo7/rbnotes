"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { SidebarLists } from "@/components/shell/sidebar/SidebarLists";
import { LocalOnlyBadge } from "@/components/shell/LocalOnlyBadge";
import { persistSettings } from "@/lib/save-settings";
import type { Settings as SettingsShape } from "@/lib/schemas";

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 420;
const SIDEBAR_WIDTH_STORAGE_KEY = "rbnotes-sidebar-width";
const SIDEBAR_WIDTH_VAR = "--spacing-sidebar-width";

/**
 * Drag-to-resize for the sidebar, clamped to [MIN_SIDEBAR_WIDTH,
 * MAX_SIDEBAR_WIDTH]. Every consumer of the sidebar's width (this file's
 * own w-sidebar-width, AppShell's pl-sidebar-width, TopBar's
 * left-sidebar-width) reads the same Tailwind v4 @theme token
 * (globals.css), which is just a CSS custom property under the hood --
 * so writing directly to it on the root element (an inline style,
 * highest specificity for that element) resizes all three in lockstep
 * with zero prop drilling and no React re-render on every pointer move.
 * Persisted to localStorage so a resize survives a reload.
 */
function useSidebarResize() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
      if (saved) document.documentElement.style.setProperty(SIDEBAR_WIDTH_VAR, `${saved}px`);
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
      const width = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, ev.clientX));
      document.documentElement.style.setProperty(SIDEBAR_WIDTH_VAR, `${width}px`);
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const finalWidth = getComputedStyle(document.documentElement).getPropertyValue(SIDEBAR_WIDTH_VAR);
      try {
        localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(parseFloat(finalWidth)));
      } catch {
        // Best-effort -- the width still applies for the rest of this session.
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);
}

const THEME_ORDER: SettingsShape["theme"][] = ["hacker", "dark", "light"];
const THEME_LABEL: Record<SettingsShape["theme"], string> = {
  hacker: "Hacker",
  dark: "Dark",
  light: "Light",
};

/**
 * Quick-toggle for the theme-support spec: cycles Hacker -> Dark -> Light
 * -> Hacker on each click, no Settings-page trip required. Styled as a
 * bracket-command chip (`[theme]`), the same terminal-voice language as
 * `[:set]`/`[^N]` elsewhere in this shell, not a color-swatch picker.
 *
 * Icon-only (a small accent-colored dot, not the theme's full name) so it
 * doesn't crowd this row at the sidebar's minimum resized width -- the
 * name is still available via the tooltip/aria-label, not lost, just not
 * spending horizontal space by default. `data-theme={theme}` on the dot
 * itself (same live-preview mechanism SettingsView's swatches use) is
 * redundant most of the time -- it's already the ambient theme -- but
 * keeps the dot correct even in the one-tick window before
 * SettingsHydrator's effect applies the real theme to <html>.
 */
function ThemeToggle() {
  const settings = useWorkspaceStore((s) => s.settings);
  const syncEnabled = useWorkspaceStore((s) => s.syncEnabled);
  const updateStore = useWorkspaceStore((s) => s.updateSettings);
  const theme = settings.theme;

  const cycle = () => {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
    updateStore({ theme: next });
    void persistSettings({ ...settings, theme: next }, syncEnabled);
  };

  return (
    <button
      onClick={cycle}
      title={`Theme: ${THEME_LABEL[theme]} (click to cycle)`}
      aria-label={`Theme: ${THEME_LABEL[theme]}. Click to cycle.`}
      className="flex items-center gap-space-1 font-label-sm text-label-sm text-outline hover:text-on-surface transition-colors shrink-0"
    >
      <span className="text-primary">[theme]</span>
      <span data-theme={theme} className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
    </button>
  );
}

/**
 * Below the mobile breakpoint (the same `useIsDesktop()` seam everything
 * else here uses) this same browse role -- search, tags, every note --
 * lives in the Dashboard route's List screen instead (CONTEXT.md), so
 * Sidebar doesn't render at all there. At every other width this is
 * unchanged from before that split existed.
 */
export function Sidebar() {
  const collapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const mobileOpen = useWorkspaceStore((s) => s.mobileSidebarOpen);
  const setMobileOpen = useWorkspaceStore((s) => s.setMobileSidebarOpen);
  const syncEnabled = useWorkspaceStore((s) => s.syncEnabled);
  const pathname = usePathname();
  const { createAndOpenNote } = useWorkspace();
  const isDesktop = useIsDesktop();
  const onResizeStart = useSidebarResize();

  const handleNewNote = () => {
    createAndOpenNote();
    setMobileOpen(false);
  };

  if (isDesktop === false) return null;

  return (
    <>
      {/* Mobile/tablet backdrop — sidebar overlays the buffer below 1024px
          per the design system's own breakpoint rule, rather than docking. */}
      {mobileOpen && (
        <button
          aria-label="Close sidebar"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
        />
      )}
      <aside
        data-collapsed={collapsed}
        data-mobile-open={mobileOpen}
        onClick={() => setMobileOpen(false)}
        className="fixed left-0 top-0 bottom-status-bar-height w-sidebar-width bg-surface-container-low border-r border-outline-variant/30 flex flex-col z-40 transition-transform duration-150 max-lg:-translate-x-full max-lg:data-[mobile-open=true]:translate-x-0 lg:translate-x-0 lg:data-[collapsed=true]:-translate-x-full"
      >
      <div className="h-header-height px-space-4 border-b border-outline-variant/30 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-space-2">
          <Image src="/logo.svg" alt="RbNotes" width={32} height={32} className="h-8 w-auto" />
          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
            RbNotes
          </span>
        </Link>
        <span className="font-label-sm text-label-sm text-outline px-space-1 py-space-0 rounded bg-surface-container-high">
          v0.4.2
        </span>
      </div>

      <div className="p-space-3 shrink-0 border-b border-outline-variant/20">
        <button
          onClick={handleNewNote}
          className="w-full flex items-center justify-between px-space-3 py-space-2 bg-primary text-on-primary font-label-md text-label-md rounded hover:bg-primary-fixed transition-colors"
        >
          <span>+ New Note</span>
          <span className="font-label-sm text-label-sm opacity-80">[^N]</span>
        </button>
      </div>

      <SidebarLists />

      <div className="h-12 px-space-4 border-t border-outline-variant/30 flex items-center justify-between gap-space-3 shrink-0 bg-surface-container-low">
        {syncEnabled ? (
          <Link
            href="/settings"
            data-active={pathname === "/settings"}
            className="flex items-center gap-space-2 text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors data-[active=true]:text-on-surface min-w-0"
          >
            <Settings size={16} strokeWidth={1.5} />
            <span className="truncate">Settings</span>
            <span className="font-label-sm text-label-sm text-outline shrink-0">[:set]</span>
          </Link>
        ) : (
          <LocalOnlyBadge />
        )}
        <ThemeToggle />
      </div>

      {/* Hit target is wider (w-3, centered on the true edge via -right-1)
          than what's actually painted (the nested w-px/hover:w-0.5 bar) --
          a 1px-wide draggable strip was near-impossible to grab precisely.
          The visible line stays thin; only the invisible grab zone grew. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={onResizeStart}
        className="hidden lg:flex items-stretch justify-center absolute top-0 -right-1 bottom-0 w-3 cursor-col-resize group"
      >
        <div className="w-px group-hover:w-0.5 bg-transparent group-hover:bg-primary/50 group-active:bg-primary transition-colors" />
      </div>
      </aside>
    </>
  );
}
