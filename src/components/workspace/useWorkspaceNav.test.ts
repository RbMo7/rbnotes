// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const pathnameRef = { current: "/notes/a" };
vi.mock("next/navigation", () => ({ usePathname: () => pathnameRef.current }));

import { useWorkspaceNav } from "@/components/workspace/useWorkspaceNav";

function popstate(state: unknown) {
  window.dispatchEvent(new PopStateEvent("popstate", { state }));
}

describe("useWorkspaceNav", () => {
  beforeEach(() => {
    pathnameRef.current = "/notes/a";
    window.history.replaceState(null, "", "/notes/a");
  });

  it("seeds the active buffer from the entry URL", () => {
    const { result } = renderHook(() => useWorkspaceNav());
    expect(result.current.activeNoteId).toBe("a");
  });

  it("open() switches instantly (no async gap) and pushes a real history entry", () => {
    const { result } = renderHook(() => useWorkspaceNav());

    act(() => result.current.open("b"));

    expect(result.current.activeNoteId).toBe("b");
    expect(window.location.pathname).toBe("/notes/b");
    expect(window.history.state).toEqual({ noteId: "b" });
  });

  it("regression (history traversal): Back (popstate) restores the previously opened buffer", () => {
    const { result } = renderHook(() => useWorkspaceNav());
    act(() => result.current.open("b"));
    act(() => result.current.open("c"));
    expect(result.current.activeNoteId).toBe("c");

    // The browser would fire this with the state `open("b")` pushed earlier.
    act(() => popstate({ noteId: "b" }));
    expect(result.current.activeNoteId).toBe("b");

    act(() => popstate({ noteId: "a" }));
    expect(result.current.activeNoteId).toBe("a");
  });

  it("Forward (popstate) restores the buffer that was switched away from", () => {
    const { result } = renderHook(() => useWorkspaceNav());
    act(() => result.current.open("b"));
    act(() => popstate({ noteId: "a" })); // simulate Back to a
    expect(result.current.activeNoteId).toBe("a");

    act(() => popstate({ noteId: "b" })); // simulate Forward back to b
    expect(result.current.activeNoteId).toBe("b");
  });

  it("falls back to parsing the URL when popstate carries no state (pre-app history entry)", () => {
    const { result } = renderHook(() => useWorkspaceNav());
    act(() => result.current.open("b"));

    window.history.replaceState(null, "", "/notes/a");
    act(() => popstate(null));

    expect(result.current.activeNoteId).toBe("a");
  });

  it("settle() replaces rather than pushes -- home resolution doesn't leave a bounce-back entry", () => {
    pathnameRef.current = "/notes";
    window.history.replaceState(null, "", "/notes");
    const { result } = renderHook(() => useWorkspaceNav());
    expect(result.current.activeNoteId).toBeNull();

    const lengthBefore = window.history.length;
    act(() => result.current.settle("a"));

    expect(result.current.activeNoteId).toBe("a");
    expect(window.location.pathname).toBe("/notes/a");
    expect(window.history.length).toBe(lengthBefore);
  });

  it("clearToHome() moves to the explicit empty state (not the URL-derived fallback)", () => {
    const { result } = renderHook(() => useWorkspaceNav());
    act(() => result.current.clearToHome());
    expect(result.current.activeNoteId).toBeNull();
    expect(window.location.pathname).toBe("/notes");
  });

  it("regression (no-trap): handling Back/Forward (popstate) never itself pushes or replaces a history entry", () => {
    // The "Back past the oldest entry exits the workspace" guarantee holds
    // purely by *not interfering*: this hook must never call
    // preventDefault() on a popstate event or mutate history from within
    // its own popstate handler (either would turn a step back into the
    // browser's real prior history into another step *within* the app,
    // trapping the user).
    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    renderHook(() => useWorkspaceNav());

    const event = new PopStateEvent("popstate", { state: { noteId: "z" } });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    act(() => window.dispatchEvent(event));

    expect(preventDefaultSpy).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
    pushSpy.mockRestore();
    replaceSpy.mockRestore();
  });

  it("self-heals from a genuine external navigation (pathname changes without our own open/settle)", () => {
    const { result, rerender } = renderHook(() => useWorkspaceNav());
    act(() => result.current.open("b"));
    expect(result.current.activeNoteId).toBe("b");

    // Something outside this hook navigated (a real Link, a hard reload) --
    // Next's usePathname reflects the new URL.
    pathnameRef.current = "/notes/z";
    rerender();

    expect(result.current.activeNoteId).toBe("z");
  });
});
