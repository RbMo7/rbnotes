// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { createRef } from "react";
import { EditorView } from "@codemirror/view";
import { undo } from "@codemirror/commands";
import { Editor, type EditorHandle } from "@/components/editor/Editor";
import { defaultSettings } from "@/lib/schemas";

afterEach(cleanup);

function mountedView(): EditorView {
  const dom = document.querySelector(".cm-editor");
  const view = EditorView.findFromDOM(dom as HTMLElement);
  if (!view) throw new Error("no mounted EditorView");
  return view;
}

describe("Editor -- one view, many documents (issue: persistent workspace shell)", () => {
  it("switching noteId does not remount the view (the .cm-editor DOM node is the same element)", () => {
    const ref = createRef<EditorHandle>();
    const { rerender } = render(
      <Editor ref={ref} noteId="a" content="doc a" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );
    const domBefore = document.querySelector(".cm-editor");

    rerender(
      <Editor ref={ref} noteId="b" content="doc b" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );
    const domAfter = document.querySelector(".cm-editor");

    expect(domAfter).toBe(domBefore);
  });

  it("regression (empty-overwrite guard): switching to a cold note never leaves the outgoing note's real document live and editable underneath the skeleton", () => {
    const ref = createRef<EditorHandle>();
    const { rerender } = render(
      <Editor ref={ref} noteId="a" content="doc a, not empty" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );

    rerender(
      <Editor ref={ref} noteId="b" content={undefined} settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );

    // The mounted view shows a neutral blank placeholder, not `a`'s real
    // content -- a stray keystroke while hidden must never silently edit
    // the wrong buffer (see below: `a`'s content is safely preserved
    // separately, not lost, just not the thing displayed here).
    expect(mountedView().state.doc.toString()).toBe("");
    // Nothing is attributed to `a` anymore, so even a stray edit here
    // couldn't be mistaken for one.
    expect(ref.current?.getContentFor("b")).toBeNull();
  });

  it("regression (wrong-buffer edit guard): `a`'s content is preserved (not lost) while switched away to a cold note, and restored on return", () => {
    const ref = createRef<EditorHandle>();
    const { rerender } = render(
      <Editor ref={ref} noteId="a" content="doc a, not empty" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );
    expect(ref.current?.getContentFor("a")).toBe("doc a, not empty");

    rerender(
      <Editor ref={ref} noteId="b" content={undefined} settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );
    // Still safely cached even though it's not what's on screen.
    expect(ref.current?.getContentFor("a")).toBe("doc a, not empty");

    rerender(
      <Editor ref={ref} noteId="a" content="doc a, not empty" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );
    expect(mountedView().state.doc.toString()).toBe("doc a, not empty");
  });

  it("regression (skeleton-on-switch): a note's undo history survives switching away and back", () => {
    const ref = createRef<EditorHandle>();
    const { rerender } = render(
      <Editor ref={ref} noteId="a" content="hello" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );

    const view = mountedView();
    view.dispatch({ changes: { from: 5, to: 5, insert: " world" } });
    expect(view.state.doc.toString()).toBe("hello world");

    // Switch to a different warm note.
    rerender(
      <Editor ref={ref} noteId="b" content="unrelated" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );
    expect(mountedView().state.doc.toString()).toBe("unrelated");

    // Switch back to `a` -- same content and undo history, not a fresh doc.
    rerender(
      <Editor ref={ref} noteId="a" content="hello" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );
    expect(mountedView().state.doc.toString()).toBe("hello world");

    // Undo must still see the edit made before the switch away.
    undo(mountedView());
    expect(mountedView().state.doc.toString()).toBe("hello");
  });

  it("cursor position survives a switch away and back", () => {
    const ref = createRef<EditorHandle>();
    const { rerender } = render(
      <Editor ref={ref} noteId="a" content="hello world" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );

    mountedView().dispatch({ selection: { anchor: 6 } });
    expect(mountedView().state.selection.main.head).toBe(6);

    rerender(
      <Editor ref={ref} noteId="b" content="other" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );
    rerender(
      <Editor ref={ref} noteId="a" content="hello world" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );

    expect(mountedView().state.selection.main.head).toBe(6);
  });

  it("getContentFor reads a background note's document without it being active", () => {
    const ref = createRef<EditorHandle>();
    const { rerender } = render(
      <Editor ref={ref} noteId="a" content="doc a" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );
    rerender(
      <Editor ref={ref} noteId="b" content="doc b" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );

    expect(ref.current?.getContentFor("a")).toBe("doc a");
    expect(ref.current?.getContentFor("b")).toBe("doc b");
    expect(ref.current?.getContentFor("never-opened")).toBeNull();
  });

  it("regression (stale-save guard): getContentFor(activeNoteId) reflects a live, unsaved edit without switching away first", () => {
    // Autosave and :w/Ctrl+S both call getContentFor(activeNoteId) -- if
    // this ever read the cached per-note state instead of the live view for
    // the *active* note, every save would silently persist whatever the
    // buffer looked like at activation, dropping every keystroke since.
    const ref = createRef<EditorHandle>();
    render(
      <Editor ref={ref} noteId="a" content="hello world" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );

    mountedView().dispatch({ changes: { from: "hello world".length, insert: " -- typed just now" } });

    expect(ref.current?.getContentFor("a")).toBe("hello world -- typed just now");
  });

  it("a vimEnabled/readOnly regeneration (e.g. a desktop<->mobile breakpoint flip) loses undo history but never the live text itself", () => {
    const ref = createRef<EditorHandle>();
    const { rerender } = render(
      <Editor ref={ref} noteId="a" content="hello" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );
    mountedView().dispatch({ changes: { from: 5, to: 5, insert: " world" } });
    expect(mountedView().state.doc.toString()).toBe("hello world");

    // Visit a second, background note too -- its unsaved edit must also
    // survive the regeneration, not just the active one's.
    rerender(
      <Editor ref={ref} noteId="b" content="second" settings={defaultSettings} vimEnabled onChange={() => {}} />,
    );
    mountedView().dispatch({ changes: { from: 6, to: 6, insert: " note" } });
    expect(mountedView().state.doc.toString()).toBe("second note");

    // vimEnabled flips -- the view is rebuilt from scratch.
    const domBefore = document.querySelector(".cm-editor");
    rerender(
      <Editor
        ref={ref}
        noteId="b"
        content="second"
        settings={defaultSettings}
        vimEnabled={false}
        onChange={() => {}}
      />,
    );
    expect(document.querySelector(".cm-editor")).not.toBe(domBefore);
    // The regeneration carries `b`'s just-edited text forward even though
    // the `content` prop passed in is the stale pre-edit value -- the live
    // edit must win, never the cache's lagging-behind copy.
    expect(mountedView().state.doc.toString()).toBe("second note");

    rerender(
      <Editor ref={ref} noteId="a" content="hello" settings={defaultSettings} vimEnabled={false} onChange={() => {}} />,
    );
    expect(mountedView().state.doc.toString()).toBe("hello world");
  });
});
