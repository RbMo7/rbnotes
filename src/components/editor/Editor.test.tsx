// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { createRef } from "react";
import { EditorView } from "@codemirror/view";
import { getCM, Vim } from "@replit/codemirror-vim";
import { Editor, type EditorHandle } from "@/components/editor/Editor";
import { defaultSettings } from "@/lib/schemas";
import { useWorkspaceStore } from "@/lib/store";

afterEach(cleanup);

function mountedView(): EditorView {
  const dom = document.querySelector(".cm-editor");
  const view = EditorView.findFromDOM(dom as HTMLElement);
  if (!view) throw new Error("no mounted EditorView");
  return view;
}

describe("Editor / vim `/` search prompt", () => {
  it(
    "regression (cm-vim-panel display:none): opening `/` focuses the search " +
      "prompt instead of leaving focus (and keystrokes) on the buffer",
    () => {
      const ref = createRef<EditorHandle>();
      render(
        <Editor
          ref={ref}
          noteId="note-1"
          content="hello world"
          settings={defaultSettings}
          vimEnabled
          onChange={() => {}}
        />,
      );

      expect(ref.current).not.toBeNull();

      // Reach the mounted EditorView the same way execVimEx does, then open
      // the search dialog exactly as a real "/" keypress would.
      const editorDom = document.querySelector(".cm-editor");
      expect(editorDom).toBeTruthy();
      const cmView = EditorView.findFromDOM(editorDom as HTMLElement);
      expect(cmView).toBeTruthy();
      const cm = getCM(cmView as EditorView);
      expect(cm).toBeTruthy();

      Vim.handleKey(cm as Parameters<typeof Vim.handleKey>[0], "/", "user");

      const active = document.activeElement;
      expect(active?.tagName).toBe("INPUT");
      // The panel housing the prompt must actually be visible -- this is
      // the concrete assertion that pins the bug: display:none on
      // .cm-vim-panel (shared with the dialog) silently no-ops focus().
      const panel = active?.closest(".cm-vim-panel");
      expect(panel).toBeTruthy();
      expect(getComputedStyle(panel as Element).display).not.toBe("none");
    },
  );

  it("never intercepts bare `/` at the app level -- engine ownership stands", () => {
    const ref = createRef<EditorHandle>();
    render(
      <Editor
        ref={ref}
        noteId="note-1"
        content="hello world"
        settings={defaultSettings}
        vimEnabled
        onChange={() => {}}
        onIntent={() => {
          throw new Error("bare `/` must never be intercepted as an app intent");
        }}
      />,
    );

    const contentEditable = document.querySelector(".cm-content") as HTMLElement;
    contentEditable.dispatchEvent(
      new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true }),
    );
  });
});

describe("Editor / vim mode tracking (NORMAL/INSERT/VISUAL badges)", () => {
  it("regression (setState destroys the vim engine): entering INSERT/VISUAL mode updates the store for the first note, not just the very first keypress ever", () => {
    const ref = createRef<EditorHandle>();
    render(
      <Editor ref={ref} noteId="a" content="hello" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );
    const cm = getCM(mountedView()) as Parameters<typeof Vim.handleKey>[0];

    Vim.handleKey(cm, "i", "user");
    expect(useWorkspaceStore.getState().mode).toBe("INSERT");

    Vim.handleKey(cm, "<Esc>", "user");
    expect(useWorkspaceStore.getState().mode).toBe("NORMAL");

    Vim.handleKey(cm, "v", "user");
    expect(useWorkspaceStore.getState().mode).toBe("VISUAL");
  });

  it("regression (setState destroys the vim engine): mode tracking still works after switching to a different note", () => {
    // The bug: CodeMirror's view.setState() -- called on every note switch
    // -- unconditionally destroys and recreates every ViewPlugin, including
    // @replit/codemirror-vim's, even though the same vim() extension value
    // is reused. A vim-mode-change listener registered once (at Editor
    // mount) was listening on the very first, already-destroyed engine by
    // the time the first real note activated -- every mode badge in the
    // app was permanently stuck showing NORMAL.
    const ref = createRef<EditorHandle>();
    const { rerender } = render(
      <Editor ref={ref} noteId="a" content="hello" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );
    rerender(
      <Editor ref={ref} noteId="b" content="world" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );

    const cm = getCM(mountedView()) as Parameters<typeof Vim.handleKey>[0];
    Vim.handleKey(cm, "i", "user");
    expect(useWorkspaceStore.getState().mode).toBe("INSERT");
  });

  it("switching buffers resets the mode to NORMAL, matching real Vim's own buffer-switch behavior", () => {
    const ref = createRef<EditorHandle>();
    const { rerender } = render(
      <Editor ref={ref} noteId="a" content="hello" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );
    Vim.handleKey(getCM(mountedView()) as Parameters<typeof Vim.handleKey>[0], "i", "user");
    expect(useWorkspaceStore.getState().mode).toBe("INSERT");

    rerender(
      <Editor ref={ref} noteId="b" content="world" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );
    expect(useWorkspaceStore.getState().mode).toBe("NORMAL");
  });
});
