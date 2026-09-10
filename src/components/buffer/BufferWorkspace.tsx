"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Editor, type EditorHandle } from "@/components/editor/Editor";
import { BufferHeaderNormal } from "@/components/buffer/BufferHeaderNormal";
import { VimStatuslineDock } from "@/components/buffer/VimStatuslineDock";
import { QuickActionsStrip } from "@/components/buffer/QuickActionsStrip";
import { CommandDock } from "@/components/buffer/CommandDock";
import { HelpBuffer } from "@/components/overlay/HelpBuffer";
import { InspectorPanel, type ShareViewer } from "@/components/inspect/InspectorPanel";
import { StatusToast } from "@/components/auth/StatusToast";
import {
  dispatchCommand,
  type CommandContext,
  type EditorOps,
  type WorkspaceOps,
} from "@/components/editor/command-dispatch";
import { dispatchIntent, type Intent } from "@/components/editor/shortcuts";
import { useIntentHandlers } from "@/components/editor/use-intent-handlers";
import { useManualSave } from "@/components/editor/use-manual-save";
import { useNoteOperations } from "@/components/buffer/use-note-operations";
import { useWorkspaceStore } from "@/lib/store";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { displayFilename } from "@/lib/format";
import { useNotesQuery, useNotesMutations, computeBufferNumber } from "@/lib/notes-query";
import { createShareAction, getShareInfoAction, revokeShareAction } from "@/server/actions/shares";
import { saveSettingsAction } from "@/server/actions/settings";
import type { Settings } from "@/lib/schemas";

export function BufferWorkspace({ noteId }: { noteId: string }) {
  const router = useRouter();
  const editorRef = useRef<EditorHandle>(null);
  const isDesktop = useIsDesktop();

  // Read-and-clear once per mount, same pattern as SettingsHydrator's
  // lazy initializer: a search result click stashes {noteId, query} here
  // right before navigating (see SearchPalette.tsx), and this is the one
  // place that's allowed to consume it. Reading via getState() instead of
  // the hook deliberately doesn't subscribe -- a later change to this
  // store field (e.g. a different note's click) must not re-run this.
  const [initialSearchQuery] = useState(() => {
    const pending = useWorkspaceStore.getState().pendingSearchMatch;
    if (pending?.noteId !== noteId) return null;
    useWorkspaceStore.getState().setPendingSearchMatch(null);
    return pending.query;
  });

  const { data: notes } = useNotesQuery();
  const { updateNote } = useNotesMutations();
  // Both scoped to this user at the one fetch that populated the cache
  // (see (app)/layout.tsx) -- a note that doesn't exist, or belongs to
  // someone else, simply isn't in `notes` either way. See "not found"
  // handling below.
  const note = notes?.find((n) => n.id === noteId);

  const settings = useWorkspaceStore((s) => s.settings);
  const setSettingsStore = useWorkspaceStore((s) => s.updateSettings);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notify, setNotify] = useState<string | null>(null);
  const [notifyTone, setNotifyTone] = useState<"info" | "error">("info");
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareViewers, setShareViewers] = useState<ShareViewer[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [, startTransition] = useTransition();

  const mode = useWorkspaceStore((s) => s.mode);
  const setMode = useWorkspaceStore((s) => s.setMode);
  const commandDockOpen = useWorkspaceStore((s) => s.commandDockOpen);
  const setCommandDockOpen = useWorkspaceStore((s) => s.setCommandDockOpen);
  const inspectorOpen = useWorkspaceStore((s) => s.inspectorOpen);
  const setInspectorOpen = useWorkspaceStore((s) => s.setInspectorOpen);
  const toggleInspector = useWorkspaceStore((s) => s.toggleInspector);
  const setActiveFilename = useWorkspaceStore((s) => s.setActiveFilename);

  // The editor's own listener produces intents; this is the one dispatcher
  // that turns them into effects -- the same handler set the shell uses.
  const intentHandlers = useIntentHandlers();
  const handleIntent = useCallback(
    (intent: Intent) => dispatchIntent(intent, intentHandlers),
    [intentHandlers],
  );

  // Per-note local state (helpOpen, shareToken, shareViewers) resets for
  // free: the page renders `<BufferWorkspace key={noteId} .../>`, so React
  // remounts this component fresh on every note switch. The note's own
  // data (title, content) no longer lives in component state at all --
  // it's read reactively from the notes-query cache above, so there's
  // nothing to reset for that.
  useEffect(() => {
    setMode(isDesktop === false ? "EDIT" : "NORMAL");
    setInspectorOpen(false);
  }, [isDesktop, setMode, setInspectorOpen]);

  useEffect(() => {
    if (!note) return;
    setActiveFilename(displayFilename(note.title));
    return () => setActiveFilename(null);
  }, [note?.title, setActiveFilename]); // eslint-disable-line react-hooks/exhaustive-deps

  const getContent = useCallback(() => editorRef.current?.getContent() ?? "", []);
  const handleSaved = useCallback(
    (info: { title: string; content: string; updatedAt: string }) => updateNote(noteId, info),
    [noteId, updateNote],
  );
  const { markDirty, write, isDirty } = useManualSave(noteId, getContent, handleSaved);

  // Ctrl+S reaches whichever buffer is mounted through this registration --
  // the shell listener lives above the per-route tree and can't call `write`
  // directly.
  useEffect(() => {
    useWorkspaceStore.getState().registerActiveSave(() => {
      void write();
    });
    return () => useWorkspaceStore.getState().registerActiveSave(null);
  }, [write]);

  const showNotify = useCallback((message: string, tone: "info" | "error" = "info") => {
    setNotify(message);
    setNotifyTone(tone);
    window.setTimeout(() => setNotify(null), 3500);
  }, []);

  // Note operations (with the archive-vs-delete policy) live in their own
  // module; this component just wires them into the command context.
  const noteOps = useNoteOperations({
    noteId,
    getContent,
    save: write,
    isDirty,
    notify: showNotify,
  });

  const loadShareInfo = useCallback(() => {
    setShareLoading(true);
    getShareInfoAction({ noteId })
      .then((info) => {
        setShareToken(info.share?.token ?? null);
        setShareViewers(info.viewers);
      })
      .finally(() => setShareLoading(false));
  }, [noteId]);

  useEffect(() => {
    // Fetches and sets share info fresh each time the inspector opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (inspectorOpen) loadShareInfo();
  }, [inspectorOpen, loadShareInfo]);

  const handleShare = useCallback(() => {
    startTransition(async () => {
      const result = await createShareAction({ noteId });
      setShareToken(result.token);
      const url = `${window.location.origin}/s/${result.token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      showNotify(`SHARE: link copied — /s/${result.token.slice(0, 6)}…  [OK]`);
      setInspectorOpen(true);
    });
  }, [noteId, showNotify, setInspectorOpen]);

  const handleUnshare = useCallback(() => {
    startTransition(async () => {
      await revokeShareAction({ noteId });
      setShareToken(null);
      setShareViewers([]);
      showNotify("SHARE: link revoked  [OK]");
    });
  }, [noteId, showNotify]);

  const handleCopyShare = useCallback(() => {
    if (!shareToken) return;
    navigator.clipboard.writeText(`${window.location.origin}/s/${shareToken}`).catch(() => {});
    showNotify("SHARE: link copied  [OK]");
  }, [shareToken, showNotify]);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettingsStore(patch);
      startTransition(() => {
        saveSettingsAction({ ...settings, ...patch }).catch(() => {});
      });
    },
    [settings, setSettingsStore],
  );

  const workspaceOps: WorkspaceOps = {
    // Command failures are surfaced in the error tone; informational command
    // output (rename, share) goes through showNotify's default.
    notify: (message) => showNotify(message, "error"),
    openHelp: () => setHelpOpen(true),
    // Deliberately never navigates. This is a single persistent pane with
    // an always-visible sidebar, not a multi-window Vim session -- `:q`
    // closes whichever overlay is on top (mirroring real Vim's `:q` closing
    // a help/preview window), or is a no-op if the plain note view is all
    // that's showing.
    quit: () => {
      if (helpOpen) setHelpOpen(false);
      else if (inspectorOpen) setInspectorOpen(false);
    },
    toggleSidebar: intentHandlers.toggleSidebar,
    toggleInspector,
    share: handleShare,
    unshare: handleUnshare,
    updateSettings,
  };

  // Rebuilt each render so the dispatcher always sees current closures.
  const commandContext: CommandContext = { note: noteOps, workspace: workspaceOps };

  const handleCommandSubmit = (raw: string) => {
    setCommandDockOpen(false);
    const handle = editorRef.current;
    if (handle) {
      const ops: EditorOps = {
        replaceFirstH1: handle.replaceFirstH1,
        execVimEx: handle.execVimEx,
      };
      // Fire-and-forget from this synchronous handler; dispatchCommand is
      // async only so `:wq` can await the write before quitting.
      void dispatchCommand(raw, ops, commandContext);
    }
    editorRef.current?.focus();
  };

  // notes is undefined only on a genuine cache miss (should be rare -- the
  // layout always prefetches it); note is undefined when the id doesn't
  // exist or isn't this user's, which the cache can't distinguish and
  // deliberately doesn't try to (see notes/[id]/page.tsx).
  if (!notes) {
    return <div className="w-full px-space-8 pt-space-8" />;
  }
  if (!note) {
    return (
      <div className="w-full px-space-8 pt-space-8 font-code-editor text-code-editor">
        <p className="text-error">E484: no such buffer</p>
        <button onClick={() => router.push("/notes")} className="mt-space-2 text-primary hover:underline">
          ← back to notes
        </button>
      </div>
    );
  }

  if (isDesktop === null) {
    // Briefly unknown on first client paint; avoids mounting CodeMirror
    // with the wrong keymap and immediately remounting it.
    return <div className="w-full px-space-8 pt-space-8" />;
  }

  const vimEnabled = isDesktop;
  const bufferNumber = computeBufferNumber(notes, noteId);

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="w-full px-space-4 sm:px-space-8 pt-space-4 sm:pt-space-2 flex-1 flex flex-col min-h-0">
          {/* One header for every mode -- it never swaps, so switching
              modes can never shift the canvas below it. The mode pill
              inside it already reads live from the store, which is the
              only thing that needs to change per mode (§ terminal-header
              unification: NORMAL/VISUAL/INSERT are one buffer, not three
              different screens). */}
          <div className="flex items-center mb-space-4 shrink-0">
            <BufferHeaderNormal
              title={note.title}
              content={note.content}
              bufferNumber={bufferNumber}
              createdAt={new Date(note.createdAt)}
              onToggleInspector={toggleInspector}
            />
          </div>

          {/* Canvas geometry is constant across modes -- only the
              decorative glow (absolutely positioned, no layout impact)
              differs for INSERT. CodeMirror's own .cm-content padding
              (rbnotes-theme.ts) is the real spacing, not this wrapper. */}
          <div className="w-full flex-1 min-h-[320px] relative bg-surface-dim overflow-hidden rounded-lg">
            {mode === "INSERT" && (
              <div className="absolute -top-12 left-1/4 w-96 h-28 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            )}
            <div className="relative h-full select-text">
              <Editor
                ref={editorRef}
                initialContent={note.content}
                initialSearchQuery={initialSearchQuery}
                settings={settings}
                vimEnabled={vimEnabled}
                onChange={markDirty}
                onIntent={handleIntent}
              />
            </div>
            {helpOpen && <HelpBuffer onClose={() => setHelpOpen(false)} />}
          </div>

          {vimEnabled ? (
            <VimStatuslineDock title={note.title} onSave={write} />
          ) : (
            <QuickActionsStrip onSave={write} />
          )}

          {notify && (
            <div className="mt-space-3">
              <StatusToast message={notify} tone={notifyTone} />
            </div>
          )}
        </div>

        <CommandDock
          open={commandDockOpen}
          onClose={() => {
            setCommandDockOpen(false);
            editorRef.current?.focus();
          }}
          onSubmit={handleCommandSubmit}
        />

        {/* Mobile `:` entry point -- there is no NORMAL mode to type ':' from. */}
        {!vimEnabled && !commandDockOpen && (
          <button
            onClick={() => setCommandDockOpen(true)}
            className="fixed bottom-[calc(var(--spacing-status-bar-height)+1rem)] right-4 z-20 w-10 h-10 rounded-full bg-primary text-on-primary font-headline-sm text-headline-sm font-bold flex items-center justify-center shadow-lg lg:hidden"
            aria-label="Open command line"
          >
            :
          </button>
        )}
      </div>

      <InspectorPanel
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
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
