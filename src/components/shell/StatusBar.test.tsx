// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { useWorkspaceStore } from "@/lib/store";
import { StatusBar } from "@/components/shell/StatusBar";

afterEach(() => {
  cleanup();
  useWorkspaceStore.setState({ activeBufferInfo: null });
});

describe("StatusBar", () => {
  it("shows created date, word count, and hash once the active buffer's info is set", () => {
    useWorkspaceStore.setState({
      activeBufferInfo: { wordCount: 42, hash: "abc1234", createdAt: new Date().toISOString() },
    });
    render(<StatusBar filename="note.md" />);
    expect(screen.getByText("42 words")).toBeTruthy();
    expect(screen.getByText("abc1234")).toBeTruthy();
    expect(screen.getByText(/^created /)).toBeTruthy();
  });

  it("omits them while the active buffer is cold (no info yet)", () => {
    useWorkspaceStore.setState({ activeBufferInfo: null });
    render(<StatusBar filename="note.md" />);
    expect(screen.queryByText(/words$/)).toBeNull();
    expect(screen.queryByText(/^SHA:/)).toBeNull();
  });
});
