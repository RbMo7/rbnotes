"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
import { vim, getCM, Vim } from "@replit/codemirror-vim";
import { rbnotesTheme, rbnotesMarkdownHighlight } from "@/components/editor/rbnotes-theme";
import { rbnotesMarkdown, lineNumberGutter } from "@/components/editor/extensions";
import { matchGlobalShortcut, type Intent } from "@/components/editor/shortcuts";
import { isH1Line } from "@/lib/markdown-title";
import { useWorkspaceStore, type VimMode } from "@/lib/store";
import type { Settings } from "@/lib/schemas";

export type EditorHandle = {
  focus: () => void;
  getContent: () => string;
  /** Replace the document's first H1 line with `# title`, or prepend one. */
  replaceFirstH1: (title: string) => void;
  /** Run a genuine Vim ex command; returns false if the engine rejected it. */
  execVimEx: (command: string) => boolean;
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
  // The only bridge from the editor to app actions. Read-only callers (the
  // shared-note view) simply omit it -- no no-op callback wall.
  onIntent?: (intent: Intent) => void;
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
    onIntent,
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

  // Stable across renders so the listeners always call the latest callbacks
  // without needing to recreate the whole EditorView.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onIntentRef = useRef(onIntent);
  onIntentRef.current = onIntent;

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
      replaceFirstH1,
      execVimEx,
    }),
    [replaceFirstH1, execVimEx],
  );

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
    // key handling on view.dom's descendants (contentDOM). One table decides
    // what each chord means (see shortcuts.ts) -- the shell has its own
    // adapter for when focus is outside the editor.
    function handleCapture(event: KeyboardEvent) {
      if (readOnly) return;
      // Read the vim engine's own live mode rather than a mirrored ref --
      // if a vim-mode-change event were ever missed, a mirrored value could
      // drift and get ':' stuck working in the wrong mode. This is the
      // actual source of truth CodeMirror-vim itself uses. With vim off
      // (mobile/EDIT) there is no engine, so mode is EDIT and the
      // mode-gated rows simply don't match.
      const liveMode: VimMode | null = cm ? mapVimMode(cm.state.vim?.mode) : "EDIT";
      const intent = matchGlobalShortcut(event, liveMode);
      if (!intent) return;
      event.preventDefault();
      event.stopPropagation();
      onIntentRef.current?.(intent);
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
