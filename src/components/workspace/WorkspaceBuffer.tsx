"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Editor, type EditorHandle } from "@/components/editor/Editor";
import { VimStatuslineDock } from "@/components/buffer/VimStatuslineDock";
import { QuickActionsStrip } from "@/components/buffer/QuickActionsStrip";
import { CommandDock } from "@/components/buffer/CommandDock";
import { MobileActionMenu } from "@/components/buffer/MobileActionMenu";
import { MoreHorizontal } from "lucide-react";
import { HelpBuffer } from "@/components/overlay/HelpBuffer";
import { EmptyBuffer } from "@/components/buffer/EmptyBuffer";
import { InspectorPanel, type ShareViewer } from "@/components/inspect/InspectorPanel";
import { StatusToast } from "@/components/auth/StatusToast";
import { SaveRetryToast } from "@/components/workspace/SaveRetryToast";
import { BufferSkeleton } from "@/components/workspace/BufferSkeleton";
import {
  dispatchCommand,
  type CommandContext,
  type EditorOps,
  type WorkspaceOps,
} from "@/components/editor/command-dispatch";
import { dispatchIntent, type Intent } from "@/components/editor/shortcuts";
import { useIntentHandlers } from "@/components/editor/use-intent-handlers";
import { useAutosave } from "@/components/workspace/useAutosave";
import { useNoteOperations } from "@/components/buffer/use-note-operations";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { useWorkspaceStore } from "@/lib/store";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { displayFilename, formatWordCount, shortHash } from "@/lib/format";
import { useNotesQuery, useNotesMutations, useTogglePin } from "@/lib/notes-query";
import { createShareAction, getShareInfoAction, revokeShareAction } from "@/server/actions/shares";
import { persistSettings } from "@/lib/save-settings";
import { useSignOut } from "@/lib/use-sign-out";
import type { Settings } from "@/lib/schemas";

/**
 * The persistent buffer chrome: mounted once by WorkspaceProvider whenever
 * the URL is inside `/notes*`, never remounted on a note-to-note switch
 * (that's the whole point -- see ADR-0001). Everything that used to reset
 * "for free" via remount (helpOpen, share panel state, the inspector) is
 * reset explicitly here instead, keyed on `activeNoteId`.
 */
export function WorkspaceBuffer() {
  const { activeNoteId, goHome } = useWorkspace();
  const router = useRouter();
  const editorRef = useRef<EditorHandle>(null);
  const isDesktop = useIsDesktop();

  const { data: notes } = useNotesQuery();
  const { updateNote } = useNotesMutations();
  const togglePin = useTogglePin();
  const note = activeNoteId ? notes?.find((n) => n.id === activeNoteId) : undefined;

  const settings = useWorkspaceStore((s) => s.settings);
  const setSettingsStore = useWorkspaceStore((s) => s.updateSettings);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notify, setNotify] = useState<string | null>(null);
  const [notifyTone, setNotifyTone] = useState<"info" | "error">("info");
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareViewers, setShareViewers] = useState<ShareViewer[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const mode = useWorkspaceStore((s) => s.mode);
  const setMode = useWorkspaceStore((s) => s.setMode);
  const commandDockOpen = useWorkspaceStore((s) => s.commandDockOpen);
  const setCommandDockOpen = useWorkspaceStore((s) => s.setCommandDockOpen);
  const inspectorOpen = useWorkspaceStore((s) => s.inspectorOpen);
  const setInspectorOpen = useWorkspaceStore((s) => s.setInspectorOpen);
  const toggleInspector = useWorkspaceStore((s) => s.toggleInspector);
  const setActiveFilename = useWorkspaceStore((s) => s.setActiveFilename);
  const setActiveBufferInfo = useWorkspaceStore((s) => s.setActiveBufferInfo);
  const setTitleRevealed = useWorkspaceStore((s) => s.setTitleRevealed);
  const saveState = useWorkspaceStore((s) => s.saveState);

  // The editor's own listener produces intents; this is the one dispatcher
  // that turns them into effects -- the same handler set the shell uses.
  const intentHandlers = useIntentHandlers();
  const handleIntent = useCallback(
    (intent: Intent) => dispatchIntent(intent, intentHandlers),
    [intentHandlers],
  );

  // Per-buffer local UI state resets on every switch -- there is no remount
  // to do it for free anymore (see the module doc).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local UI state to the active buffer changing, not derivable at render
    setHelpOpen(false);
    setInspectorOpen(false);
    setShareToken(null);
    setShareViewers([]);
    // Editor's own onTitleRevealChange re-reports this right after the
    // switch (see its note-switch effect), but that fires from an effect a
    // render later -- defaulting true here (rather than leaving the
    // outgoing note's stale value) means the header never shows a
    // just-closed note's title for that one frame.
    setTitleRevealed(true);
  }, [activeNoteId, setInspectorOpen, setTitleRevealed]);

  useEffect(() => {
    setMode(isDesktop === false ? "EDIT" : "NORMAL");
  }, [isDesktop, setMode]);

  useEffect(() => {
    if (!note) return;
    setActiveFilename(displayFilename(note.title));
    return () => setActiveFilename(null);
  }, [note?.title, setActiveFilename]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!note || note.content === undefined) {
      setActiveBufferInfo(null);
      return;
    }
    setActiveBufferInfo({
      wordCount: formatWordCount(note.content),
      hash: shortHash(note.content),
      createdAt: note.createdAt,
    });
    return () => setActiveBufferInfo(null);
  }, [note?.content, note?.createdAt, setActiveBufferInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  // A global-search result click stashes {noteId, query} in the store right
  // before switching (see SearchPalette.tsx); read-and-clear it once per
  // activation, same "consume once" pattern SettingsHydrator uses for its
  // initial value.
  useEffect(() => {
    const pending = useWorkspaceStore.getState().pendingSearchMatch;
    if (pending?.noteId === activeNoteId) {
      useWorkspaceStore.getState().setPendingSearchMatch(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot handoff consumed on activation, not derivable at render
      setPendingQuery(pending.query);
    } else {
      setPendingQuery(null);
    }
  }, [activeNoteId]);

  const getContent = useCallback(() => editorRef.current?.getContent() ?? "", []);
  const getContentFor = useCallback(
    (id: string) => editorRef.current?.getContentFor(id) ?? null,
    [],
  );
  const handleSaved = useCallback(
    (id: string, info: { title: string; content: string; updatedAt: string }) =>
      updateNote(id, info),
    [updateNote],
  );
  const { markDirty, flush, isDirty, cancel } = useAutosave({
    getContentFor,
    activeNoteId,
    onSaved: handleSaved,
  });
  const handleChange = useCallback((id: string) => markDirty(id), [markDirty]);
  const write = useCallback(
    () => (activeNoteId ? flush(activeNoteId) : Promise.resolve(true)),
    [activeNoteId, flush],
  );
  const activeIsDirty = useCallback(
    () => (activeNoteId ? isDirty(activeNoteId) : false),
    [activeNoteId, isDirty],
  );

  // Ctrl+S reaches whichever buffer is active through this registration --
  // registered once (not per switch): it reads the current active id via
  // `write`'s own closure over `activeNoteId` at call time.
  useEffect(() => {
    useWorkspaceStore.getState().registerActiveSave(() => {
      void write();
    });
    return () => useWorkspaceStore.getState().registerActiveSave(null);
  }, [write]);

  // Clicking a `#tag` pill in the document (Editor's tagPillDecorations)
  // jumps to the sidebar's Tags view, filtered and expanded to that tag.
  // Desktop: the sidebar might be collapsed (including from onboarding's
  // minimalistic-first-view default), so force it open -- the buffer stays
  // mounted underneath, unlike Ctrl+T which only ever needs the request
  // pulse since the sidebar's already the thing you're looking at. Mobile
  // has no docked sidebar at all while a buffer is open (CONTEXT.md's List
  // screen only exists on the Dashboard route), so jump home to it instead.
  const handleTagClick = useCallback(
    (tag: string) => {
      useWorkspaceStore.getState().requestFocusTags(tag);
      if (isDesktop) useWorkspaceStore.getState().setSidebarCollapsed(false);
      else goHome();
    },
    [isDesktop, goHome],
  );

  const showNotify = useCallback((message: string, tone: "info" | "error" = "info") => {
    setNotify(message);
    setNotifyTone(tone);
    window.setTimeout(() => setNotify(null), 3500);
  }, []);

  const noteOps = useNoteOperations({
    noteId: activeNoteId ?? "",
    getContent,
    notify: showNotify,
    cancelAutosave: cancel,
  });

  const syncEnabled = useWorkspaceStore((s) => s.syncEnabled);
  const signOut = useSignOut();

  const loadShareInfo = useCallback(() => {
    // Sharing needs a real account (createShareAction/getShareInfoAction
    // both call getAuthedUser()) -- calling it for a Local-only session
    // would redirect straight to /login. The Inspector shows a "sign in
    // to share" message instead (see the signedIn prop below); there's
    // nothing to fetch.
    if (!activeNoteId || !syncEnabled) return;
    setShareLoading(true);
    getShareInfoAction({ noteId: activeNoteId })
      .then((info) => {
        setShareToken(info.share?.token ?? null);
        setShareViewers(info.viewers);
      })
      .finally(() => setShareLoading(false));
  }, [activeNoteId, syncEnabled]);

  useEffect(() => {
    // Fetches and sets share info fresh each time the inspector opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (inspectorOpen) loadShareInfo();
  }, [inspectorOpen, loadShareInfo]);

  const handleShare = useCallback(() => {
    if (!activeNoteId) return;
    if (!syncEnabled) {
      showNotify("SHARE: sign in to share notes", "error");
      return;
    }
    startTransition(async () => {
      const result = await createShareAction({ noteId: activeNoteId });
      setShareToken(result.token);
      const url = `${window.location.origin}/s/${result.token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      showNotify(`SHARE: link copied — /s/${result.token.slice(0, 6)}…  [OK]`);
      setInspectorOpen(true);
    });
  }, [activeNoteId, syncEnabled, showNotify, setInspectorOpen]);

  const handleUnshare = useCallback(() => {
    if (!activeNoteId || !syncEnabled) return;
    startTransition(async () => {
      await revokeShareAction({ noteId: activeNoteId });
      setShareToken(null);
      setShareViewers([]);
      showNotify("SHARE: link revoked  [OK]");
    });
  }, [activeNoteId, syncEnabled, showNotify]);

  const handleCopyShare = useCallback(() => {
    if (!shareToken) return;
    navigator.clipboard.writeText(`${window.location.origin}/s/${shareToken}`).catch(() => {});
    showNotify("SHARE: link copied  [OK]");
  }, [shareToken, showNotify]);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettingsStore(patch);
      const next = { ...settings, ...patch };
      const syncEnabled = useWorkspaceStore.getState().syncEnabled;
      startTransition(() => {
        void persistSettings(next, syncEnabled);
      });
    },
    [settings, setSettingsStore],
  );

  const workspaceOps: WorkspaceOps = {
    notify: (message) => showNotify(message, "error"),
    openHelp: () => setHelpOpen(true),
    openCheatsheet: () => useWorkspaceStore.getState().setCheatsheetOpen(true),
    openPinnedSwitcher: () => useWorkspaceStore.getState().setPinnedSwitcherOpen(true),
    quit: () => {
      if (helpOpen) setHelpOpen(false);
      else if (inspectorOpen) setInspectorOpen(false);
    },
    toggleSidebar: intentHandlers.toggleSidebar,
    toggleInspector,
    share: handleShare,
    unshare: handleUnshare,
    updateSettings,
    getSettings: () => settings,
    openSettings: () => router.push("/settings"),
    goHome: () => router.push("/"),
    login: () => router.push("/login"),
    logout: () => {
      if (!syncEnabled) {
        showNotify("LOGOUT: already local only -- nothing to sign out of", "error");
        return;
      }
      signOut();
    },
  };

  const commandContext: CommandContext = {
    note: {
      save: write,
      isDirty: activeIsDirty,
      ...noteOps,
      togglePin: () => {
        if (note) togglePin(note);
        else showNotify("E486: no buffer to pin", "error");
      },
    },
    workspace: workspaceOps,
  };

  const handleCommandSubmit = (raw: string) => {
    setCommandDockOpen(false);
    const handle = editorRef.current;
    if (handle) {
      const ops: EditorOps = {
        replaceFirstH1: handle.replaceFirstH1,
        execVimEx: handle.execVimEx,
      };
      void dispatchCommand(raw, ops, commandContext);
    }
    editorRef.current?.focus();
  };

  // notes is undefined only on a genuine cache miss (should be rare -- the
  // layout always prefetches metadata).
  if (!notes) {
    return <div className="w-full px-space-8 pt-space-8" />;
  }
  if (activeNoteId === null) {
    return <EmptyBuffer />;
  }
  if (!note) {
    return (
      <div className="w-full px-space-8 pt-space-8 font-code-editor text-code-editor">
        <p className="text-error">E484: no such buffer</p>
        <button onClick={goHome} className="mt-space-2 text-primary hover:underline">
          ← back to notes
        </button>
      </div>
    );
  }

  if (isDesktop === null) {
    return <div className="w-full px-space-8 pt-space-8" />;
  }

  const vimEnabled = isDesktop;
  const cold = note.content === undefined;

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="w-full flex-1 flex flex-col min-h-0">
          <div className="w-full flex-1 min-h-[320px] relative bg-surface-container-lowest overflow-hidden">
            {mode === "INSERT" && (
              <div className="absolute -top-12 left-1/4 w-96 h-28 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            )}
            <div className="relative h-full select-text" style={cold ? { visibility: "hidden" } : undefined}>
              <Editor
                ref={editorRef}
                noteId={activeNoteId}
                content={note.content}
                pendingMatch={pendingQuery}
                settings={settings}
                vimEnabled={vimEnabled}
                onChange={handleChange}
                onIntent={handleIntent}
                onTagClick={handleTagClick}
                onTitleRevealChange={setTitleRevealed}
              />
            </div>
            {cold && <BufferSkeleton />}
            {helpOpen && <HelpBuffer onClose={() => setHelpOpen(false)} />}
          </div>

          <div className="px-space-4 sm:px-space-8 pb-space-4 shrink-0">
            {vimEnabled ? (
              <VimStatuslineDock onSave={() => void write()} />
            ) : (
              <QuickActionsStrip onSave={() => void write()} />
            )}

            {saveState === "error" && (
              <SaveRetryToast onRetry={() => void write()} />
            )}

          </div>

          {notify && (
            // A real floating overlay (fixed + high z-index), not an inline
            // flow element -- it previously sat in normal document flow
            // inside this shrink-0 footer strip, which let it render *inside*
            // HelpBuffer's own visible area (HelpBuffer is an absolute
            // inset-0 z-20 sibling of the editor, one flex item up) instead
            // of floating above it like a toast should. A command result
            // (":cheat" typo'd, etc.) needs to be visible no matter what
            // overlay is currently open, so this sits above both HelpBuffer
            // (z-20) and Radix dialog overlays (z-60) alike.
            <div className="fixed inset-x-4 sm:inset-x-8 bottom-[calc(var(--spacing-status-bar-height)+1rem)] z-[70] flex justify-center pointer-events-none">
              <div className="w-full max-w-2xl pointer-events-auto">
                <StatusToast message={notify} tone={notifyTone} />
              </div>
            </div>
          )}
        </div>

        {vimEnabled ? (
          <CommandDock
            open={commandDockOpen}
            onClose={() => {
              setCommandDockOpen(false);
              editorRef.current?.focus();
            }}
            onSubmit={handleCommandSubmit}
          />
        ) : (
          <MobileActionMenu
            open={commandDockOpen}
            onClose={() => setCommandDockOpen(false)}
            onSubmit={handleCommandSubmit}
            pinned={note.pinned}
          />
        )}

        {!vimEnabled && !commandDockOpen && (
          <button
            onClick={() => setCommandDockOpen(true)}
            className="fixed bottom-[calc(var(--spacing-status-bar-height)+1rem)] right-4 z-20 w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg lg:hidden"
            aria-label="Open actions"
          >
            <MoreHorizontal size={20} strokeWidth={2} />
          </button>
        )}
      </div>

      <InspectorPanel
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        signedIn={syncEnabled}
        loading={shareLoading}
        token={shareToken}
        viewers={shareViewers}
        onShare={handleShare}
        onUnshare={handleUnshare}
        onCopy={handleCopyShare}
      />
    </div>
  );
}
