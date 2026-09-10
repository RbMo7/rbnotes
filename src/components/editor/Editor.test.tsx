// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { createRef } from "react";
import { EditorView } from "@codemirror/view";
import { getCM, Vim } from "@replit/codemirror-vim";
import { Editor, type EditorHandle } from "@/components/editor/Editor";
import { defaultSettings } from "@/lib/schemas";

afterEach(cleanup);

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
