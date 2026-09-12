"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import { StatusBar } from "@/components/shell/StatusBar";
import { StatusToast } from "@/components/auth/StatusToast";
import { QuickSwitcher, PinnedSwitcher } from "@/components/overlay/QuickSwitcher";
import { SearchPalette } from "@/components/overlay/SearchPalette";
import { CheatsheetPopup } from "@/components/overlay/CheatsheetPopup";
import { CommandDock, DASHBOARD_COMMAND_CHIPS } from "@/components/buffer/CommandDock";
import { dispatchCommand, type CommandContext, type EditorOps } from "@/components/editor/command-dispatch";
import { matchGlobalShortcut, dispatchIntent } from "@/components/editor/shortcuts";
import { useIntentHandlers } from "@/components/editor/use-intent-handlers";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { useWorkspaceStore } from "@/lib/store";
import { useSignOut } from "@/lib/use-sign-out";
import { persistSettings } from "@/lib/save-settings";
import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import { hasSeenOnboarding, markOnboardingSeen } from "@/lib/onboarding";

// A plain `:` keystroke (no modifier) has to be told apart from someone
// typing a literal colon into a text field -- every other global shortcut
// is ctrl/meta-modified, which a text input never produces on its own.
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

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
  const titleRevealed = useWorkspaceStore((s) => s.titleRevealed);
  const setSidebarCollapsed = useWorkspaceStore((s) => s.setSidebarCollapsed);
  // Kept in lockstep with TopBar's own `compact` (same inputs, modulo the
  // one-frame-lagged `activeFilename` vs TopBar's zero-lag `activeNote` --
  // fine here, since this only drives the content wrapper's padding-top
  // catching up to the header's actual height, not anything that needs to
  // be crisp).
  const headerCompact = !!activeFilename && !titleRevealed;
  // Settings' "Replay tour" link flips this one directly -- the store is
  // the right home for that case (a cross-component trigger, unrelated to
  // first mount). The automatic first-run show below deliberately does NOT
  // route through it; see the comment on `showFirstRun`.
  const storeOnboarding = useWorkspaceStore((s) => s.onboardingOpen);
  const setStoreOnboarding = useWorkspaceStore((s) => s.setOnboardingOpen);
  const handlers = useIntentHandlers();

  // WorkspaceProvider mounts its own WorkspaceBuffer (and that buffer's own
  // CommandDock) for exactly this route range -- rendering a second dock
  // here too would double up on the one `commandDockOpen` flag they'd both
  // be watching. Everywhere else (the Dashboard, tags, settings...) has no
  // buffer of its own, which is the "`:` dosent work in dashboard page" bug:
  // the shortcut could now fire there (see shortcuts.ts), but nothing was
  // ever mounted to show it. This is that dock, wired to a note-less
  // command context -- buffer-only commands (:w, :rename, :delete, :pin,
  // :share/:unshare) just report there's no buffer, same as :pin already
  // did inside a real buffer with nothing to pin.
  const pathname = usePathname();
  const router = useRouter();
  const inNotesSection = pathname === "/notes" || pathname.startsWith("/notes/");
  const { createAndOpenNote } = useWorkspace();
  const commandDockOpen = useWorkspaceStore((s) => s.commandDockOpen);
  const setCommandDockOpen = useWorkspaceStore((s) => s.setCommandDockOpen);
  const syncEnabled = useWorkspaceStore((s) => s.syncEnabled);
  const signOut = useSignOut();
  const [notify, setNotify] = useState<string | null>(null);
  const showNotify = useCallback((message: string) => {
    setNotify(message);
    window.setTimeout(() => setNotify(null), 3500);
  }, []);

  const handleGlobalCommandSubmit = useCallback(
    (raw: string) => {
      setCommandDockOpen(false);
      const ops: EditorOps = {
        replaceFirstH1: () => {},
        execVimEx: () => false,
      };
      const noBuffer = (verb: string) => showNotify(`E486: no buffer to ${verb}`);
      const ctx: CommandContext = {
        note: {
          save: async () => {
            noBuffer("save");
            return false;
          },
          isDirty: () => false,
          create: createAndOpenNote,
          rename: () => noBuffer("rename"),
          delete: () => noBuffer("delete"),
          togglePin: () => noBuffer("pin"),
        },
        workspace: {
          notify: showNotify,
          openHelp: () => showNotify("open a note first, then :help"),
          openCheatsheet: () => useWorkspaceStore.getState().setCheatsheetOpen(true),
          openPinnedSwitcher: () => useWorkspaceStore.getState().setPinnedSwitcherOpen(true),
          quit: () => {},
          toggleSidebar: handlers.toggleSidebar,
          toggleInspector: () => noBuffer("inspect"),
          share: () => noBuffer("share"),
          unshare: () => noBuffer("unshare"),
          updateSettings: (patch) => {
            useWorkspaceStore.getState().updateSettings(patch);
            void persistSettings(useWorkspaceStore.getState().settings, syncEnabled);
          },
          getSettings: () => useWorkspaceStore.getState().settings,
          openSettings: () => router.push("/settings"),
          goHome: () => router.push("/"),
          login: () => router.push("/login"),
          logout: () => {
            if (!syncEnabled) {
              showNotify("LOGOUT: already local only -- nothing to sign out of");
              return;
            }
            signOut();
          },
        },
      };
      void dispatchCommand(raw, ops, ctx);
    },
    [createAndOpenNote, handlers, router, setCommandDockOpen, showNotify, signOut, syncEnabled],
  );

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
  // same table gets its turn. `null` mode means "no editor focus", so a
  // mode-gated chord like ':' is now allowed through here too (see
  // shortcuts.ts) -- guarded by isEditableTarget so it doesn't hijack a
  // literal colon typed into some other text field (rename dialog, search
  // box, settings input...).
  const handleIntent = useCallback(
    (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
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
        className={`pl-0 lg:data-[collapsed=false]:pl-sidebar-width transition-[padding] duration-150 pb-status-bar-height h-dvh overflow-y-auto bg-surface flex flex-col ${headerCompact ? "pt-header-height-compact" : "pt-header-height"}`}
      >
        <div className="flex-1 min-h-0">{children}</div>
        {/* Same sticky-bottom-of-scroll-container trick the in-buffer dock
            relies on (see CommandDock's own "sticky bottom-0") -- nesting it
            inside this padded, sidebar-aware wrapper (rather than a
            viewport-`fixed` element, which ignored the sidebar's width and
            rendered underneath/clipped by it) means it never has to redo the
            sidebar-offset math the wrapper above already does. */}
        {!inNotesSection && commandDockOpen && (
          <>
            <CommandDock
              open={commandDockOpen}
              onClose={() => setCommandDockOpen(false)}
              onSubmit={handleGlobalCommandSubmit}
              commands={DASHBOARD_COMMAND_CHIPS}
            />
            {notify && (
              <div className="px-space-4 bg-surface-container-lowest sticky bottom-0">
                <StatusToast message={notify} tone="error" />
              </div>
            )}
          </>
        )}
      </div>
      <StatusBar filename={activeFilename} />
      <QuickSwitcher />
      <PinnedSwitcher />
      <SearchPalette />
      <CheatsheetPopup />
      {showOnboarding && <OnboardingOverlay onFinish={finishOnboarding} />}
      <BootLoader ready={ready} />
    </>
  );
}
