// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { createRef } from "react";
import { EditorView } from "@codemirror/view";
import { getCM, Vim } from "@replit/codemirror-vim";
import { Editor, type EditorHandle } from "@/components/editor/Editor";
import { defaultSettings } from "@/lib/schemas";

afterEach(cleanup);

function mountedView(): EditorView {
  const dom = document.querySelector(".cm-editor");
  const view = EditorView.findFromDOM(dom as HTMLElement);
  if (!view) throw new Error("no mounted EditorView");
  return view;
}

function contentText(): string {
  return document.querySelector(".cm-content")?.textContent ?? "";
}

describe("Editor / Live Preview reading mode", () => {
  it("hides markdown marks in NORMAL, shows them raw in INSERT, and hides them again after Esc", async () => {
    const ref = createRef<EditorHandle>();
    render(
      <Editor
        ref={ref}
        noteId="a"
        content="# Title\n\n**bold** [text](https://example.com)"
        settings={defaultSettings}
        vimEnabled
        onChange={() => {}}
      />,
    );

    expect(contentText()).not.toContain("# ");
    expect(contentText()).not.toContain("**");
    expect(contentText()).not.toContain("https://example.com");
    expect(contentText()).toContain("Title");
    expect(contentText()).toContain("bold");
    expect(contentText()).toContain("text");

    const cm = getCM(mountedView()) as Parameters<typeof Vim.handleKey>[0];
    Vim.handleKey(cm, "i", "user");
    await Promise.resolve(); // flush the queued mode-change dispatch

    expect(contentText()).toContain("# Title");
    expect(contentText()).toContain("**bold**");
    expect(contentText()).toContain("https://example.com");

    Vim.handleKey(cm, "<Esc>", "user");
    await Promise.resolve();

    expect(contentText()).not.toContain("# ");
    expect(contentText()).not.toContain("**");
    expect(contentText()).not.toContain("https://example.com");
  });

  it("regression (stale mode on cached state): a note left in INSERT renders clean again after switching away and back", async () => {
    const ref = createRef<EditorHandle>();
    const { rerender } = render(
      <Editor
        ref={ref}
        noteId="a"
        content="# Title"
        settings={defaultSettings}
        vimEnabled
        onChange={() => {}}
      />,
    );

    const cmA = getCM(mountedView()) as Parameters<typeof Vim.handleKey>[0];
    Vim.handleKey(cmA, "i", "user");
    await Promise.resolve();
    expect(contentText()).toContain("# Title");

    // Switch away mid-INSERT, with no Esc first -- a real quick-switcher
    // jump can do exactly this.
    rerender(
      <Editor
        ref={ref}
        noteId="b"
        content="# Other"
        settings={defaultSettings}
        vimEnabled
        onChange={() => {}}
      />,
    );
    expect(contentText()).not.toContain("# Other");
    expect(contentText()).toContain("Other");

    // Back to "a": vim always resets to NORMAL on a buffer switch, and the
    // cached state's live-preview field must follow -- not stay frozen at
    // whatever it last was (INSERT/raw) since setState() doesn't re-run
    // the field's create().
    rerender(
      <Editor
        ref={ref}
        noteId="a"
        content="# Title"
        settings={defaultSettings}
        vimEnabled
        onChange={() => {}}
      />,
    );
    expect(contentText()).not.toContain("# Title");
    expect(contentText()).toContain("Title");
  });

  it("renders clean in the read-only shared view, with no vim engine present", () => {
    render(
      <Editor
        noteId="shared"
        content="# Title\n\n**bold**"
        settings={defaultSettings}
        vimEnabled={false}
        readOnly
      />,
    );

    expect(contentText()).not.toContain("#");
    expect(contentText()).not.toContain("**");
    expect(contentText()).toContain("Title");
    expect(contentText()).toContain("bold");
  });

  it("keeps an empty cursor selection out of a hidden replaced range, biased by direction of travel", () => {
    const ref = createRef<EditorHandle>();
    render(
      <Editor
        ref={ref}
        noteId="a"
        content="# Title"
        settings={defaultSettings}
        vimEnabled
        onChange={() => {}}
      />,
    );
    const view = mountedView();

    // The "# " mark spans [0, 2) once its trailing space is folded in.
    view.dispatch({ selection: { anchor: 0 } });
    view.dispatch({ selection: { anchor: 1 } }); // moving rightward into it
    expect(view.state.selection.main.head).toBe(2);

    view.dispatch({ selection: { anchor: 2 } });
    view.dispatch({ selection: { anchor: 1 } }); // moving leftward back into it
    expect(view.state.selection.main.head).toBe(0);
  });
});
