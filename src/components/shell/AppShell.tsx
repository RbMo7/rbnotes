"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { TopBar } from "@/components/shell/TopBar";
import { StatusBar } from "@/components/shell/StatusBar";
import { QuickSwitcher } from "@/components/overlay/QuickSwitcher";
import { SearchPalette } from "@/components/overlay/SearchPalette";
import { CheatsheetPopup } from "@/components/overlay/CheatsheetPopup";
import { matchGlobalShortcut, dispatchIntent } from "@/components/editor/shortcuts";
import { useIntentHandlers } from "@/components/editor/use-intent-handlers";
import { useWorkspaceStore } from "@/lib/store";
import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import { hasSeenOnboarding, markOnboardingSeen } from "@/lib/onboarding";

/**
 * Covers first paint until `ready` (below) says the onboarding decision has
 * actually been made -- logo rising in, a terminal-flavored "booting
 * workspace" line with a blinking block cursor, a thin sweeping progress
 * bar. Visibility is driven by React state (a CSS opacity transition, not
 * a fixed-duration CSS animation): a fixed timer -- tried twice before --
 * has no relationship to how long hydration + the first effect pass
 * actually take. In dev, a route's very first hit can mean several
 * seconds of on-demand webpack compilation; a loader that reveals content
 * on its own clock reveals it *before* the decision effect has run,
 * showing the Dashboard first exactly like the bug this exists to prevent.
 * On a reload the same route is already compiled, hydration is fast, and
 * everything resolves inside what used to look like "one fixed delay" --
 * which is why the bug only ever showed up on a genuine first load, never
 * on reload. Gating on the real signal instead of a clock fixes both: it
 * can never reveal early (still covering exactly while genuinely
 * undecided), and can never get stuck (nothing here is a resettable
 * timer -- `ready` just flips true the first time the effect actually
 * runs, however long that took).
 */
function BootLoader({ ready }: { ready: boolean }) {
  return (
    <div
      aria-hidden={ready}
      className={`fixed inset-0 z-[80] bg-surface-container-lowest flex flex-col items-center justify-center gap-space-6 transition-opacity duration-300 ${
        ready ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-space-3 [animation:rbnotes-boot-rise_480ms_ease-out]">
        <Image src="/logo.svg" alt="" width={56} height={56} className="h-14 w-auto" priority />
        <span className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
          RbNotes
        </span>
      </div>
      <div className="flex items-center gap-space-2 font-code-editor text-code-editor text-outline">
        <span className="text-primary">&gt;</span>
        <span>booting workspace</span>
        <span className="inline-block w-[0.6ch] h-[1em] bg-primary [animation:rbnotes-boot-blink_1s_step-end_infinite]" />
      </div>
      <div className="w-40 h-px bg-outline-variant/30 overflow-hidden relative">
        <div className="absolute inset-y-0 w-1/3 bg-primary [animation:rbnotes-boot-sweep_1.1s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}

export function AppShell({
  email,
  children,
}: {
  email: string | null;
  children: ReactNode;
}) {
  const collapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const activeFilename = useWorkspaceStore((s) => s.activeFilename);
  const setSidebarCollapsed = useWorkspaceStore((s) => s.setSidebarCollapsed);
  // Settings' "Replay tour" link flips this one directly -- the store is
  // the right home for that case (a cross-component trigger, unrelated to
  // first mount). The automatic first-run show below deliberately does NOT
  // route through it; see the comment on `showFirstRun`.
  const storeOnboarding = useWorkspaceStore((s) => s.onboardingOpen);
  const setStoreOnboarding = useWorkspaceStore((s) => s.setOnboardingOpen);
  const handlers = useIntentHandlers();

  // First-run onboarding: plain LOCAL state (not the store), defaulting to
  // false so server-rendered HTML and the client's first render agree, same
  // "start neutral, flip client-only in an effect" shape lib/use-is-
  // desktop.ts already uses for the identical hydration-mismatch reason.
  // `ready` flips in the exact same effect, right after the decision is
  // made -- see BootLoader's doc for why that (not a fixed timer) is what
  // actually fixes the "Dashboard on first load, onboarding only on
  // reload" bug.
  const [showFirstRun, setShowFirstRun] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!hasSeenOnboarding()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time check against an external source (localStorage), not derivable at render; see the doc above for why it can't be a lazy useState initializer either
      setShowFirstRun(true);
      // Minimalistic first view -- the sidebar starts closed rather than
      // competing with the tour for attention. Left collapsed afterward
      // too; a returning user can reopen it with :b / the resize handle.
      setSidebarCollapsed(true);
    }
    setReady(true);
  }, [setSidebarCollapsed]);

  const showOnboarding = showFirstRun || storeOnboarding;
  const finishOnboarding = useCallback(() => {
    setShowFirstRun(false);
    setStoreOnboarding(false);
    markOnboardingSeen();
  }, [setStoreOnboarding]);

  // The shell's adapter over the one shortcut table: when focus is inside
  // the editor, Editor.tsx's capture-phase listener handles the chord first
  // and stops it from reaching here. Outside the editor, this is where the
  // same table gets its turn. `null` mode means "no editor focus", so
  // mode-gated chords (the ':') never fire here.
  const handleIntent = useCallback(
    (event: KeyboardEvent) => {
      const intent = matchGlobalShortcut(event, null);
      if (!intent) return;
      event.preventDefault();
      dispatchIntent(intent, handlers);
    },
    [handlers],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleIntent);
    return () => document.removeEventListener("keydown", handleIntent);
  }, [handleIntent]);

  return (
    <>
      <TopBar email={email} />
      <div
        data-collapsed={collapsed}
        className="pl-0 lg:data-[collapsed=false]:pl-sidebar-width transition-[padding] duration-150 pt-header-height pb-status-bar-height h-dvh overflow-y-auto bg-surface"
      >
        {children}
      </div>
      <StatusBar filename={activeFilename} />
      <QuickSwitcher />
      <SearchPalette />
      <CheatsheetPopup />
      {showOnboarding && <OnboardingOverlay onFinish={finishOnboarding} />}
      <BootLoader ready={ready} />
    </>
  );
}
