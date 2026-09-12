"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { EditorState, EditorSelection, Compartment, type Extension } from "@codemirror/state";
import { EditorView, keymap, drawSelection, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
import { vim, getCM, Vim } from "@replit/codemirror-vim";
import { rbnotesTheme, rbnotesMarkdownHighlight } from "@/components/editor/rbnotes-theme";
import { rbnotesMarkdown, lineNumberGutter, tagPillDecorations } from "@/components/editor/extensions";
import { livePreview, setPreviewMode } from "@/components/editor/live-preview";
import { matchGlobalShortcut, type Intent } from "@/components/editor/shortcuts";
import { isH1Line } from "@/lib/markdown-title";
import { useWorkspaceStore, type VimMode } from "@/lib/store";
import type { Settings } from "@/lib/schemas";

export type EditorHandle = {
  focus: () => void;
  getContent: () => string;
  /** Any note's cached document, active or in the background -- null if this session never opened it. Autosave uses this to flush a buffer the user has already switched away from. */
  getContentFor: (noteId: string) => string | null;
  /** Replace the document's first H1 line with `# title`, or prepend one. */
  replaceFirstH1: (title: string) => void;
  /** Run a genuine Vim ex command; returns false if the engine rejected it. */
  execVimEx: (command: string) => boolean;
};

type Props = {
  /** Which document is active. Switching this swaps the mounted view's document instead of remounting -- see the module doc below. */
  noteId: string;
  /**
   * Undefined means "not warmed yet". Editor stays mounted regardless (so
   * its per-note document cache survives passing through a cold buffer) --
   * it simply won't create or switch to a state for `noteId` until this
   * becomes a real string. The caller overlays a skeleton in the meantime
   * (see WorkspaceBuffer) rather than Editor showing anything of its own,
   * since showing an empty document here would be exactly the
   * cold-look-like-empty bug the absent/present distinction exists to
   * prevent.
   */
  content: string | undefined;
  // Set only when arriving from a global-search result click: the first
  // case-insensitive occurrence of this text in the *active* document is
  // selected and scrolled into view once, whenever it's non-null.
  pendingMatch?: string | null;
  settings: Settings;
  vimEnabled: boolean;
  readOnly?: boolean;
  onChange?: (noteId: string) => void;
  // The only bridge from the editor to app actions. Read-only callers (the
  // shared-note view) simply omit it -- no no-op callback wall.
  onIntent?: (intent: Intent) => void;
  /** Fired with the lowercased tag text (no `#`) when a `.cm-tag-pill` is clicked. */
  onTagClick?: (tag: string) => void;
  /**
   * Fired whenever the note's title line (its first `# heading` -- see
   * lib/markdown-title.ts) scrolls out of view at the top, and again when it
   * scrolls back in. Lets the header's own title (TopBar) stay hidden while
   * the real one is already on screen, and fade in only once it isn't --
   * `true` when there's no title line to hide behind at all, since there's
   * then nothing for the header to be redundant with.
   */
  onTitleRevealChange?: (revealed: boolean) => void;
};

/** Has the note's title line scrolled fully above the visible top? */
function computeTitleRevealed(view: EditorView): boolean {
  if (view.state.doc.lines === 0) return true;
  const firstLine = view.state.doc.line(1);
  if (!isH1Line(firstLine.text)) return true;
  return view.scrollDOM.scrollTop >= view.lineBlockAt(0).bottom;
}

function mapVimMode(raw: string | undefined): VimMode {
  if (!raw) return "NORMAL";
  if (raw.startsWith("insert") || raw === "replace") return "INSERT";
  if (raw.startsWith("visual")) return "VISUAL";
  return "NORMAL";
}

/**
 * One CodeMirror view for the whole session: switching `noteId` swaps which
 * cached EditorState the single mounted EditorView shows (`view.setState`)
 * instead of tearing the view down and creating a new one. Each note's
 * EditorState is created once (on first activation) and kept forever in
 * `statesRef`, which is what makes cursor, selection, and undo history
 * survive a switch away and back -- CodeMirror's undo history lives inside
 * the EditorState object itself, not in the view, so the only way to keep
 * it is to keep reusing the exact same state object.
 *
 * The view is genuinely recreated only when `vimEnabled`/`readOnly` change
 * (a desktop<->mobile breakpoint flip, or a read-only shared view) --
 * accepted as the one case that loses every buffer's cached state, since
 * doing otherwise would mean compartmentalizing vim on/off per note, which
 * no user story asks for.
 */
export const Editor = forwardRef<EditorHandle, Props>(function Editor(
  {
    noteId,
    content,
    pendingMatch,
    settings,
    vimEnabled,
    readOnly = false,
    onChange,
    onIntent,
    onTagClick,
    onTitleRevealChange,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const setMode = useWorkspaceStore((s) => s.setMode);
  const setCursor = useWorkspaceStore((s) => s.setCursor);

  const themeCompartment = useRef(new Compartment()).current;
  const gutterCompartment = useRef(new Compartment()).current;
  const wrapCompartment = useRef(new Compartment()).current;
  const tabSizeCompartment = useRef(new Compartment()).current;

  // The live-preview StateField reads this on every rebuild rather than a
  // Compartment: a compartment reconfigure never survives view.setState()
  // to another note's cached EditorState, since that state still carries
  // whatever value the compartment held when *it* was created. See
  // live-preview.ts's module doc.
  const previewModeRef = useRef<VimMode>("NORMAL");

  // Per-note document cache (undo/selection live inside each EditorState)
  // and per-note scroll position (CodeMirror doesn't persist scroll in
  // state, so it's tracked alongside, restored on activation).
  const statesRef = useRef(new Map<string, EditorState>());
  const scrollRef = useRef(new Map<string, number>());
  const activeIdRef = useRef<string | null>(null);
  const sharedExtensionsRef = useRef<Extension[] | null>(null);
  const generationRef = useRef<string | null>(null);
  // Text + cursor carried across a vimEnabled/readOnly regeneration (a
  // desktop<->mobile breakpoint flip) -- every cached EditorState is
  // discarded then (a different vim() extension instance means CM6 can't
  // reuse them), but the *documents themselves* must survive: losing undo
  // history there is an accepted, narrow tradeoff, losing unsaved text
  // outright is real data loss and isn't. Read once by the activation
  // effect the first time each note reactivates post-regeneration, then
  // discarded.
  const carryoverRef = useRef(new Map<string, { doc: string; selection: EditorSelection }>());

  // Stable across renders so the listeners always call the latest callbacks
  // without needing to recreate the whole EditorView.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onIntentRef = useRef(onIntent);
  onIntentRef.current = onIntent;
  const onTagClickRef = useRef(onTagClick);
  onTagClickRef.current = onTagClick;
  const onTitleRevealChangeRef = useRef(onTitleRevealChange);
  onTitleRevealChangeRef.current = onTitleRevealChange;
  const titleRevealedRef = useRef<boolean | null>(null);
  const reportTitleReveal = useCallback((view: EditorView) => {
    const revealed = computeTitleRevealed(view);
    if (titleRevealedRef.current === revealed) return;
    titleRevealedRef.current = revealed;
    onTitleRevealChangeRef.current?.(revealed);
  }, []);

  /**
   * Must be called after *every* `view.setState(...)` (not just once at
   * view creation): CodeMirror's `EditorView.setState` unconditionally
   * destroys and recreates every ViewPlugin, including @replit/codemirror-vim's,
   * even when the exact same `vim()` extension value is present in both
   * states -- plugin instance reuse across a state change is a `dispatch()`
   * transaction optimization only (`updatePlugins` diffs specs by
   * identity), `setState` has no equivalent path (see its source: an
   * unconditional `for (plugin of this.plugins) plugin.destroy(this)`
   * followed by fresh `new PluginInstance(spec)` for all of them). A
   * `vim-mode-change` listener registered once at creation therefore goes
   * silently stale the moment the very first `setState()` runs -- it's
   * listening on an already-destroyed engine that will never fire again.
   * The freshly (re)created engine also always starts in Normal mode,
   * which conveniently matches real Vim's own "switching buffers resets to
   * Normal" behavior, but the store has to be told explicitly since
   * nothing else will.
   */
  const wireVimMode = useCallback(
    (view: EditorView) => {
      if (!vimEnabled || readOnly) return;
      const cm = getCM(view);
      if (!cm) return;
      const initial = mapVimMode(cm.state.vim?.mode);
      previewModeRef.current = initial;
      setMode(initial);
      cm.on("vim-mode-change", (e: { mode?: string }) => {
        const next = mapVimMode(e.mode);
        previewModeRef.current = next;
        setMode(next);
        // vim-mode-change fires synchronously from inside the vim plugin's
        // own update handling -- CodeMirror throws ("Calls to
        // EditorView.update are not allowed while an update is in
        // progress") on a reentrant dispatch() here, which destroys the
        // vim plugin outright. Deferring one microtask lets the in-flight
        // update finish first. The live-preview field rides the same
        // dispatch so a mode change and its rendering effect land in one
        // transaction, never two.
        queueMicrotask(() => {
          if (viewRef.current === view) {
            view.dispatch({
              effects: [
                themeCompartment.reconfigure(rbnotesTheme(next)),
                setPreviewMode.of(next),
              ],
            });
          }
        });
      });
    },
    [vimEnabled, readOnly, setMode, themeCompartment],
  );

  /**
   * A cached EditorState's live-preview field only ever changes through a
   * dispatched transaction -- it does not get reinitialized just because
   * `view.setState()` mounts it. A note left in INSERT still carries
   * INSERT's "raw" field value when revisited later even if the live vim
   * mode is by then NORMAL again (switching buffers always resets vim to
   * Normal). Called after every setState so the field never drifts from
   * the mode `previewModeRef` says is actually current, including on the
   * read-only path where wireVimMode itself is a no-op.
   */
  const syncPreviewMode = useCallback((view: EditorView) => {
    view.dispatch({ effects: setPreviewMode.of(previewModeRef.current) });
  }, []);

  const replaceFirstH1 = useCallback((title: string) => {
    const view = viewRef.current;
    if (!view) return;
    const doc = view.state.doc;
    let targetLine = 0;
    for (let i = 1; i <= doc.lines; i++) {
      if (isH1Line(doc.line(i).text)) {
        targetLine = i;
        break;
      }
    }
    if (targetLine) {
      const line = doc.line(targetLine);
      view.dispatch({ changes: { from: line.from, to: line.to, insert: `# ${title}` } });
    } else {
      view.dispatch({ changes: { from: 0, to: 0, insert: `# ${title}\n\n` } });
    }
  }, []);

  const execVimEx = useCallback((command: string): boolean => {
    const view = viewRef.current;
    // No editor, or vim is off: nothing to run, and nothing to report --
    // "true" here means "don't surface E492", not "the command succeeded".
    if (!view) return true;
    const cm = getCM(view);
    if (!cm) return true;
    try {
      Vim.handleEx(cm as Parameters<typeof Vim.handleEx>[0], command);
      return true;
    } catch {
      return false;
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => viewRef.current?.focus(),
      getContent: () => viewRef.current?.state.doc.toString() ?? "",
      // The active note's cached EditorState in statesRef is a stale
      // snapshot from whenever it was last (re)activated -- CodeMirror's
      // dispatch() produces a new state object on every keystroke without
      // writing it back into the map; only switching *away* from a note
      // does that (see the switch-path effect below). Reading the map for
      // the currently active id would hand autosave/`:w` whatever the
      // buffer looked like at activation, silently dropping every edit
      // made since -- read the live view instead for exactly that id.
      getContentFor: (id: string) =>
        id === activeIdRef.current
          ? (viewRef.current?.state.doc.toString() ?? null)
          : (statesRef.current.get(id)?.doc.toString() ?? null),
      replaceFirstH1,
      execVimEx,
    }),
    [replaceFirstH1, execVimEx],
  );

  const [ready, setReady] = useState(false);

  // The view lifecycle: created exactly once per vimEnabled/readOnly
  // generation, and torn down only when that generation changes or the
  // component unmounts -- never on a note switch, and never merely because
  // the *active* note happens to be cold (content undefined). It's seeded
  // with an empty, unkeyed placeholder document rather than waiting for
  // real content: that placeholder is never written into `statesRef` under
  // any noteId, so it can never be mistaken for a real (and possibly
  // dirty) buffer's cache, and the caller keeps it hidden behind a skeleton
  // until the activation effect below swaps in real content. Deliberately
  // depends on nothing but the generation key -- earlier versions of this
  // effect also depended on content's defined-ness, which meant switching
  // *to* a cold note tore the whole view down (destroying every other
  // buffer's cached undo history along with it) exactly because a changed
  // dependency always re-runs the previous effect's cleanup, regardless of
  // what the new invocation's body would have done.
  useEffect(() => {
    if (!containerRef.current) return;
    const generation = `${vimEnabled}:${readOnly}`;
    generationRef.current = generation;

    const initialMode: VimMode = readOnly ? "RO" : vimEnabled ? "NORMAL" : "EDIT";
    previewModeRef.current = initialMode;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && activeIdRef.current) onChangeRef.current?.(activeIdRef.current);
      if (update.docChanged || update.selectionSet) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        setCursor(line.number, pos - line.from + 1);
      }
      // Typing a title line into existence (or deleting it) changes what
      // computeTitleRevealed sees even with the scroll position untouched.
      if (update.docChanged) reportTitleReveal(update.view);
    });

    const extensions: Extension[] = [
      history(),
      // @replit/codemirror-vim's vim() extension explicitly hides the
      // browser's native selection rendering (it expects a custom-drawn
      // selection to take over) -- without drawSelection(), selection was
      // logically real (yank/delete etc. worked) but nothing ever painted.
      drawSelection(),
      rbnotesMarkdown,
      rbnotesMarkdownHighlight,
      tagPillDecorations,
      // A note's title is its first `# heading` (lib/markdown-title.ts) --
      // there's no separate title field to fill in, which isn't obvious
      // the first time a blank "untitled" note opens. CodeMirror's own
      // placeholder() only shows while the doc is genuinely empty and
      // clears itself the instant anything is typed -- no extra state to
      // track, and it never survives a save/reload since content is no
      // longer "".
      placeholder("# Title\n\nStart typing — the first # heading becomes the note's title."),
      livePreview(previewModeRef),
      gutterCompartment.of(
        lineNumberGutter(!vimEnabled ? "off" : readOnly ? "absolute" : settings.lineNumbers),
      ),
      wrapCompartment.of(settings.wordWrap ? EditorView.lineWrapping : []),
      tabSizeCompartment.of(EditorState.tabSize.of(settings.tabSize)),
      themeCompartment.of(rbnotesTheme(initialMode)),
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
      updateListener,
      EditorView.domEventHandlers({
        click(event) {
          const pill = (event.target as HTMLElement | null)?.closest(".cm-tag-pill");
          if (!pill?.textContent) return false;
          onTagClickRef.current?.(pill.textContent.replace(/^#/, "").toLowerCase());
          return true;
        },
        scroll(_event, view) {
          reportTitleReveal(view);
        },
      }),
      keymap.of([indentWithTab, ...historyKeymap, ...searchKeymap, ...defaultKeymap]),
    ];

    // Created once per view generation and reused identically for every
    // note's EditorState -- extensions have to be byte-identical across
    // every per-note state or CodeMirror would treat each switch as a
    // config change on top of a document change. This does NOT, however,
    // keep the vim ViewPlugin instance (or its registers/marks) alive
    // across a setState() swap -- see wireVimMode's doc for why that
    // assumption turned out to be wrong.
    if (vimEnabled && !readOnly) {
      extensions.unshift(vim({ status: false }));
    }
    sharedExtensionsRef.current = extensions;

    // An unkeyed placeholder -- never stored in statesRef, never shown
    // unhidden (see the module doc above). The activation effect swaps in
    // the real document for `noteId` the moment `content` is available,
    // which for a warm first note happens in the very same commit.
    const state = EditorState.create({ doc: "", extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    setReady(true);

    wireVimMode(view);
    syncPreviewMode(view);

    // Capture-phase so this always wins over @replit/codemirror-vim's own
    // key handling on view.dom's descendants (contentDOM). One table decides
    // what each chord means (see shortcuts.ts) -- the shell has its own
    // adapter for when focus is outside the editor.
    function handleCapture(event: KeyboardEvent) {
      // Read the vim engine's own live mode fresh, not a closed-over `cm`
      // -- setState() (every note switch) recreates the vim engine from
      // scratch (see wireVimMode's doc), so a `cm` captured once here would
      // go stale the moment the first switch happened, exactly like the
      // vim-mode-change listener did before this was fixed. Falling back
      // to a mirrored ref would have the same staleness risk if a
      // vim-mode-change event were ever missed; reading CodeMirror-vim's
      // own live state is the actual source of truth. With vim off
      // (mobile/EDIT) there is no engine, so mode is EDIT and the
      // mode-gated rows simply don't match.
      const liveCm = vimEnabled && !readOnly ? getCM(view) : null;
      const liveMode: VimMode | null = liveCm ? mapVimMode(liveCm.state.vim?.mode) : "EDIT";
      const intent = matchGlobalShortcut(event, liveMode);
      if (!intent) return;
      event.preventDefault();
      event.stopPropagation();
      // Read-only views have no `onIntent`, but they still swallow the chord
      // (same precedence as before) so e.g. Ctrl+S can't reach the browser's
      // own save dialog from a shared note.
      onIntentRef.current?.(intent);
    }
    view.dom.addEventListener("keydown", handleCapture, true);

    return () => {
      // Runs automatically -- before React invokes this effect's *next*
      // body (vimEnabled/readOnly changed) or on unmount -- which is why
      // the capture has to happen here rather than at the top of the body
      // above: by the time a new invocation starts, React has already run
      // this same cleanup and `view` is already destroyed. Every open
      // note's live text and cursor (including the active one's edits
      // since its last capture -- dispatch() updates view.state without
      // touching statesRef) are preserved in carryoverRef so a
      // regeneration never loses unsaved work, only the ability to undo
      // past this point.
      /* eslint-disable react-hooks/exhaustive-deps -- statesRef/carryoverRef/scrollRef are stable Map identities (never reassigned, only mutated), not DOM-node refs the "may have changed by cleanup time" warning is meant for; reading them live at cleanup time is the intended behavior. */
      if (activeIdRef.current) {
        statesRef.current.set(activeIdRef.current, view.state);
      }
      for (const [id, s] of statesRef.current) {
        carryoverRef.current.set(id, { doc: s.doc.toString(), selection: s.selection });
      }
      statesRef.current.clear();
      scrollRef.current.clear();
      /* eslint-enable react-hooks/exhaustive-deps */
      activeIdRef.current = null;

      view.dom.removeEventListener("keydown", handleCapture, true);
      view.destroy();
      if (viewRef.current === view) viewRef.current = null;
    };
    // Extensions/compartments are intentionally created once per view
    // generation; settings changes are applied via the effect below instead
    // of recreating the whole view (which would drop selection/undo
    // history). Deliberately depends on nothing but the generation key --
    // see the module doc above for why `content`/`noteId` must not be
    // dependencies here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, vimEnabled]);

  // The switch path: reuses the one mounted view, swapping in the target
  // note's cached document (creating it on first activation, for the very
  // first note included) instead of remounting anything.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !ready) return;
    if (activeIdRef.current === noteId && (content === undefined || statesRef.current.has(noteId))) {
      return;
    }

    // Whatever the view currently shows is about to stop being on screen --
    // capture its *live* state (not the stale object stored at creation
    // time: every dispatch() since then updated view.state in place
    // without touching this map) so switching back later restores edits,
    // cursor, and undo history exactly. Applies even when leaving *to* a
    // cold note (see below).
    if (activeIdRef.current) {
      statesRef.current.set(activeIdRef.current, view.state);
      scrollRef.current.set(activeIdRef.current, view.scrollDOM.scrollTop);
    }

    if (content === undefined) {
      // Cold: there is nothing to switch *to* yet. Swap to a neutral,
      // unkeyed blank placeholder rather than leaving the outgoing note's
      // real document mounted and fully editable underneath the caller's
      // skeleton overlay -- otherwise a stray keystroke landing in a
      // merely visibility:hidden buffer would silently edit the *wrong*
      // note (this placeholder is never written into statesRef under any
      // id, and activeIdRef becomes null, so the updateListener's onChange
      // has nothing to attribute a stray edit to even if focus lingers).
      view.setState(EditorState.create({ doc: "", extensions: sharedExtensionsRef.current ?? [] }));
      wireVimMode(view);
      syncPreviewMode(view);
      activeIdRef.current = null;
      view.contentDOM.blur();
      return;
    }

    let state = statesRef.current.get(noteId);
    if (!state) {
      const carried = carryoverRef.current.get(noteId);
      state = EditorState.create({
        doc: carried?.doc ?? content,
        selection: carried?.selection,
        extensions: sharedExtensionsRef.current ?? [],
      });
      carryoverRef.current.delete(noteId);
      statesRef.current.set(noteId, state);
    }
    view.setState(state);
    wireVimMode(view);
    syncPreviewMode(view);
    activeIdRef.current = noteId;
    view.scrollDOM.scrollTop = scrollRef.current.get(noteId) ?? 0;
    // Force a fresh report even if this note's reveal state happens to
    // match the outgoing note's -- reportTitleReveal's own dedupe would
    // otherwise skip the callback and leave the header showing/hiding the
    // *previous* note's title for a beat.
    titleRevealedRef.current = null;
    reportTitleReveal(view);

    if (vimEnabled && !readOnly) view.focus();
    // vimEnabled/readOnly are genuine dependencies, not just read inside:
    // when they change, the view-lifecycle effect above regenerates
    // viewRef.current from scratch (a fresh, still-blank placeholder) --
    // without them here too, this effect would keep comparing against its
    // *last* noteId/content and, finding neither changed, never re-run to
    // populate the new view at all.
  }, [noteId, content, ready, vimEnabled, readOnly, wireVimMode, syncPreviewMode, reportTitleReveal]);

  // Arrived at the active buffer from a global-search result click: select
  // the first occurrence of the query. Independent of the switch effect
  // above so it still fires even if the match arrives a render later (the
  // caller clears the store's one-shot handoff itself).
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !pendingMatch || readOnly) return;
    const text = view.state.doc.toString();
    const idx = text.toLowerCase().indexOf(pendingMatch.toLowerCase());
    if (idx !== -1) {
      view.dispatch({
        selection: { anchor: idx, head: idx + pendingMatch.length },
        scrollIntoView: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMatch]);

  // Apply live settings changes (from the Settings page or `:set`) without
  // recreating the editor.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !ready) return;
    view.dispatch({
      effects: [
        gutterCompartment.reconfigure(
          lineNumberGutter(!vimEnabled ? "off" : readOnly ? "absolute" : settings.lineNumbers),
        ),
        wrapCompartment.reconfigure(settings.wordWrap ? EditorView.lineWrapping : []),
        tabSizeCompartment.reconfigure(EditorState.tabSize.of(settings.tabSize)),
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.lineNumbers, settings.wordWrap, settings.tabSize, ready, readOnly]);

  return <div ref={containerRef} className="h-full" />;
});
