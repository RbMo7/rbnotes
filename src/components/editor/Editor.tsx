"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
import { vim, getCM } from "@replit/codemirror-vim";
import { rbnotesTheme, rbnotesMarkdownHighlight } from "@/components/editor/rbnotes-theme";
import { rbnotesMarkdown, lineNumberGutter } from "@/components/editor/extensions";
import { useWorkspaceStore, type VimMode } from "@/lib/store";
import type { Settings } from "@/lib/schemas";

export type EditorHandle = {
  focus: () => void;
  getContent: () => string;
  getView: () => EditorView | null;
};

type Props = {
  initialContent: string;
  // Set only when arriving from a global-search result click: the first
  // case-insensitive occurrence of this text in `initialContent` is
  // selected and scrolled into view once, on mount.
  initialSearchQuery?: string | null;
  settings: Settings;
  vimEnabled: boolean;
  readOnly?: boolean;
  onChange?: () => void;
  onOpenCommandDock: () => void;
  onNewNote: () => void;
  onOpenQuickSwitcher: () => void;
  onOpenSearch: () => void;
  onToggleSidebar: () => void;
  onForceSave: () => void;
};

function mapVimMode(raw: string | undefined): VimMode {
  if (!raw) return "NORMAL";
  if (raw.startsWith("insert") || raw === "replace") return "INSERT";
  if (raw.startsWith("visual")) return "VISUAL";
  return "NORMAL";
}

export const Editor = forwardRef<EditorHandle, Props>(function Editor(
  {
    initialContent,
    initialSearchQuery,
    settings,
    vimEnabled,
    readOnly = false,
    onChange,
    onOpenCommandDock,
    onNewNote,
    onOpenQuickSwitcher,
    onOpenSearch,
    onToggleSidebar,
    onForceSave,
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

  // Stable across renders so the update listener always calls the latest
  // callback without needing to recreate the whole EditorView.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const callbacksRef = useRef({
    onOpenCommandDock,
    onNewNote,
    onOpenQuickSwitcher,
    onOpenSearch,
    onToggleSidebar,
    onForceSave,
  });
  callbacksRef.current = {
    onOpenCommandDock,
    onNewNote,
    onOpenQuickSwitcher,
    onOpenSearch,
    onToggleSidebar,
    onForceSave,
  };

  useImperativeHandle(ref, () => ({
    focus: () => viewRef.current?.focus(),
    getContent: () => viewRef.current?.state.doc.toString() ?? "",
    getView: () => viewRef.current,
  }));

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const initialMode: VimMode = readOnly ? "RO" : vimEnabled ? "NORMAL" : "EDIT";

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) onChangeRef.current?.();
      if (update.docChanged || update.selectionSet) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        setCursor(line.number, pos - line.from + 1);
      }
    });

    const extensions = [
      history(),
      // @replit/codemirror-vim's vim() extension explicitly hides the
      // browser's native selection rendering (it expects a custom-drawn
      // selection to take over) -- without drawSelection(), selection was
      // logically real (yank/delete etc. worked) but nothing ever painted.
      drawSelection(),
      rbnotesMarkdown,
      rbnotesMarkdownHighlight,
      gutterCompartment.of(lineNumberGutter(readOnly ? "absolute" : settings.lineNumbers)),
      wrapCompartment.of(settings.wordWrap ? EditorView.lineWrapping : []),
      tabSizeCompartment.of(EditorState.tabSize.of(settings.tabSize)),
      themeCompartment.of(rbnotesTheme(initialMode)),
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
      updateListener,
      keymap.of([indentWithTab, ...historyKeymap, ...searchKeymap, ...defaultKeymap]),
    ];

    if (vimEnabled && !readOnly) {
      extensions.unshift(vim({ status: false }));
    }

    const state = EditorState.create({ doc: initialContent, extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    setReady(true);

    // Arrived here from a global-search result click: select the first
    // occurrence of the query so the click actually lands on the matched
    // text instead of just opening the note at wherever the cursor last
    // was. Runs regardless of vimEnabled (a mobile/touch user can search
    // and click a result too) -- only readOnly is excluded, since a shared
    // view has no search entry point to arrive from in the first place.
    if (initialSearchQuery && !readOnly) {
      const idx = initialContent.toLowerCase().indexOf(initialSearchQuery.toLowerCase());
      if (idx !== -1) {
        view.dispatch({
          selection: { anchor: idx, head: idx + initialSearchQuery.length },
          scrollIntoView: true,
        });
      }
    }

    // Opening a note (including a brand-new one from :new) should be
    // typeable immediately -- no click into the canvas first. Skipped on
    // mobile/no-vim (focusing there pops the OS keyboard just from
    // switching notes to read, not because you meant to type) and for a
    // read-only shared view (nothing to type into).
    if (vimEnabled && !readOnly) {
      view.focus();
    }

    const cm = vimEnabled && !readOnly ? getCM(view) : null;

    if (cm) {
      cm.on("vim-mode-change", (e: { mode?: string }) => {
        const next = mapVimMode(e.mode);
        setMode(next);
        // vim-mode-change fires synchronously from inside the vim plugin's
        // own update handling -- CodeMirror throws ("Calls to
        // EditorView.update are not allowed while an update is in
        // progress") on a reentrant dispatch() here, which destroys the
        // vim plugin outright. Deferring one microtask lets the in-flight
        // update finish first.
        queueMicrotask(() => {
          if (viewRef.current === view) {
            view.dispatch({ effects: themeCompartment.reconfigure(rbnotesTheme(next)) });
          }
        });
      });
    }

    // Capture-phase so this always wins over @replit/codemirror-vim's own
    // key handling on view.dom's descendants (contentDOM) -- see
    // command-dispatch.ts for why these commands aren't registered through
    // Vim.defineEx instead.
    function handleCapture(event: KeyboardEvent) {
      const cb = callbacksRef.current;
      const ctrl = event.ctrlKey || event.metaKey;

      if (ctrl && event.key.toLowerCase() === "s") {
        event.preventDefault();
        event.stopPropagation();
        cb.onForceSave();
        return;
      }
      if (ctrl && event.key.toLowerCase() === "n") {
        event.preventDefault();
        event.stopPropagation();
        cb.onNewNote();
        return;
      }
      if (ctrl && event.key.toLowerCase() === "p") {
        event.preventDefault();
        event.stopPropagation();
        cb.onOpenQuickSwitcher();
        return;
      }
      // Ctrl+/ for the global (every note) search overlay -- plain '/' is
      // left alone below so codemirror-vim's own native, in-buffer search
      // keeps working (highlight-all + n/N, the real Vim experience).
      // Not mode-gated, same as the other Ctrl shortcuts above: unlike ':'
      // and '/' on their own, Ctrl+/ can't collide with a literal
      // character typed in INSERT.
      if (ctrl && event.key === "/") {
        event.preventDefault();
        event.stopPropagation();
        cb.onOpenSearch();
        return;
      }
      if (ctrl && event.key.toLowerCase() === "b") {
        event.preventDefault();
        event.stopPropagation();
        cb.onToggleSidebar();
        return;
      }
      if (
        cm &&
        event.key === ":" &&
        !ctrl &&
        !event.altKey &&
        // Read the vim engine's own live mode rather than a mirrored ref --
        // if a vim-mode-change event were ever missed (or fired before this
        // listener attached), a mirrored value could drift and get ':'
        // stuck working in the wrong mode. This is the actual source of
        // truth CodeMirror-vim itself uses.
        mapVimMode(cm.state.vim?.mode) === "NORMAL"
      ) {
        event.preventDefault();
        event.stopPropagation();
        cb.onOpenCommandDock();
      }
    }
    view.dom.addEventListener("keydown", handleCapture, true);

    return () => {
      view.dom.removeEventListener("keydown", handleCapture, true);
      view.destroy();
      viewRef.current = null;
    };
    // Extensions/compartments are intentionally created once per mount;
    // settings changes are applied via the effect below instead of
    // recreating the whole view (which would drop selection/undo history).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, vimEnabled]);

  // Apply live settings changes (from the Settings page or `:set`) without
  // recreating the editor.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !ready) return;
    view.dispatch({
      effects: [
        gutterCompartment.reconfigure(
          lineNumberGutter(readOnly ? "absolute" : settings.lineNumbers),
        ),
        wrapCompartment.reconfigure(settings.wordWrap ? EditorView.lineWrapping : []),
        tabSizeCompartment.reconfigure(EditorState.tabSize.of(settings.tabSize)),
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.lineNumbers, settings.wordWrap, settings.tabSize, ready, readOnly]);

  return <div ref={containerRef} className="h-full" />;
});
