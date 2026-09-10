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
import { dispatchCommand, type CommandContext } from "@/components/editor/command-dispatch";
import { useManualSave } from "@/components/editor/use-manual-save";
import { useWorkspaceStore } from "@/lib/store";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { displayFilename } from "@/lib/format";
import { useNotesQuery, useNotesMutations, useCreateNote, computeBufferNumber } from "@/lib/notes-query";
import { setNoteFlagsAction, deleteNoteAction } from "@/server/actions/notes";
import { createShareAction, getShareInfoAction, revokeShareAction } from "@/server/actions/shares";
import { saveSettingsAction } from "@/server/actions/settings";
import type { Settings } from "@/lib/schemas";

export function BufferWorkspace({ noteId }: { noteId: string }) {
  const router = useRouter();
  const editorRef = useRef<EditorHandle>(null);
  const isDesktop = useIsDesktop();

  const { data: notes } = useNotesQuery();
  const { updateNote, removeNote } = useNotesMutations();
  const createNote = useCreateNote();
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
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const setMobileSidebarOpen = useWorkspaceStore((s) => s.setMobileSidebarOpen);
  const mobileSidebarOpen = useWorkspaceStore((s) => s.mobileSidebarOpen);
  const setQuickSwitcherOpen = useWorkspaceStore((s) => s.setQuickSwitcherOpen);
  const setActiveFilename = useWorkspaceStore((s) => s.setActiveFilename);

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

  const showNotify = useCallback((message: string, tone: "info" | "error" = "info") => {
    setNotify(message);
    setNotifyTone(tone);
    window.setTimeout(() => setNotify(null), 3500);
  }, []);

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

  const commandContext: CommandContext = {
    save: write,
    // `force` (from `:q!`) is meaningful at the call site in
    // command-dispatch.ts (it's what bypasses the dirty-buffer refusal
    // before quit() is ever called); by the time we're here there's
    // nothing left to branch on.
    //
    // Deliberately never navigates. This is a single persistent pane with
    // an always-visible sidebar, not a multi-window Vim session -- there
    // is no "previous buffer" to reveal by leaving, and routing anywhere
    // (even to a genuinely different note) reads as the app randomly
    // teleporting you right after you asked it to save. `:q` instead
    // closes whichever overlay is on top (mirroring real Vim's `:q`
    // closing a help/preview window), or is a no-op if the plain note
    // view is all that's showing -- the existing [Saved] indicator
    // already confirms the write, so there's nothing more to communicate.
    quit: () => {
      if (helpOpen) setHelpOpen(false);
      else if (inspectorOpen) setInspectorOpen(false);
    },
    isDirty,
    createNew: createNote,
    // The actual rename (splicing the new title into the document's first
    // `#` heading, then persisting) happens in command-dispatch.ts, which
    // has direct access to the CodeMirror view -- a note's title is that
    // heading, not separate metadata (see lib/markdown-title.ts). This is
    // just the optimistic cache update so the header/sidebar filename
    // reflect it instantly, ahead of the save round-trip's own
    // authoritative title.
    rename: (newTitle) => {
      updateNote(noteId, { title: newTitle });
      showNotify(`RENAME: "${displayFilename(newTitle)}" written  [OK]`);
    },
    // Same instant pattern as :new (see useCreateNote): update the cache
    // and navigate first, persist in the background after. There's
    // nothing to roll back to on failure -- archived/deleted is a
    // one-way door either way, same as real Vim's own `:bd`.
    //
    // An empty buffer is deleted for real rather than archived, bang or
    // not -- there is nothing worth keeping in an "Archive" for a note
    // that was never written into (this is also what makes deleting an
    // unsaved `:new` note correct: it doesn't exist server-side yet, so
    // deleteNoteAction's background call is a harmless no-op there).
    deleteNote: (hard) => {
      const isEmpty = getContent().trim().length === 0;
      if (hard || isEmpty) {
        removeNote(noteId);
        deleteNoteAction({ noteId }).catch(() => {});
      } else {
        updateNote(noteId, { archived: true });
        setNoteFlagsAction({ noteId, archived: true }).catch(() => {});
      }
      router.push("/notes");
    },
    openHelp: () => setHelpOpen(true),
    toggleSidebar: () => {
      if (isDesktop) toggleSidebar();
      else setMobileSidebarOpen(!mobileSidebarOpen);
    },
    toggleInspector,
    share: handleShare,
    unshare: handleUnshare,
    updateSettings,
    notify: (message) => showNotify(message, "error"),
  };

  const handleCommandSubmit = useCallback(
    (raw: string) => {
      setCommandDockOpen(false);
      const view = editorRef.current?.getView();
      if (view) {
        // Fire-and-forget from this synchronous handler; dispatchCommand
        // is async only so `:wq` can await the write before quitting --
        // nothing here needs to block on it.
        void dispatchCommand(raw, view, commandContext);
      }
      editorRef.current?.focus();
    },
    // commandContext is rebuilt each render but always reflects current
    // closures, which is what we want here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setCommandDockOpen],
  );

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
                settings={settings}
                vimEnabled={vimEnabled}
                onChange={markDirty}
                onOpenCommandDock={() => setCommandDockOpen(true)}
                onNewNote={createNote}
                onOpenQuickSwitcher={() => setQuickSwitcherOpen(true)}
                onToggleSidebar={() => {
                  if (isDesktop) toggleSidebar();
                  else setMobileSidebarOpen(!mobileSidebarOpen);
                }}
                onForceSave={write}
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
