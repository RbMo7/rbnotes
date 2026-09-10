// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TerminalWindow } from "@/components/auth/TerminalWindow";

afterEach(cleanup);

describe("TerminalWindow ex-commands", () => {
  it("runs a matching command on Enter and restores the label afterward", () => {
    const wq = vi.fn();
    render(
      <TerminalWindow titleBarLabel="AUTH.BUFFER" commands={{ wq }}>
        <div />
      </TerminalWindow>,
    );

    fireEvent.keyDown(document, { key: ":" });
    fireEvent.keyDown(document, { key: "w" });
    fireEvent.keyDown(document, { key: "q" });
    expect(screen.getByText(":wq")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Enter" });
    expect(wq).toHaveBeenCalledOnce();
    expect(screen.getByText("AUTH.BUFFER")).toBeTruthy();
  });

  it("Escape cancels the command line without running anything", () => {
    const wq = vi.fn();
    render(
      <TerminalWindow titleBarLabel="AUTH.BUFFER" commands={{ wq }}>
        <div />
      </TerminalWindow>,
    );

    fireEvent.keyDown(document, { key: ":" });
    fireEvent.keyDown(document, { key: "w" });
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByText("AUTH.BUFFER")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Enter" });
    expect(wq).not.toHaveBeenCalled();
  });

  it("an unrecognized command is a silent no-op, not an error", () => {
    const wq = vi.fn();
    render(
      <TerminalWindow titleBarLabel="AUTH.BUFFER" commands={{ wq }}>
        <div />
      </TerminalWindow>,
    );

    fireEvent.keyDown(document, { key: ":" });
    fireEvent.keyDown(document, { key: "x" });
    fireEvent.keyDown(document, { key: "Enter" });

    expect(wq).not.toHaveBeenCalled();
    expect(screen.getByText("AUTH.BUFFER")).toBeTruthy();
  });

  it("never opens the command line while focus is inside a text field", () => {
    const wq = vi.fn();
    render(
      <TerminalWindow titleBarLabel="AUTH.BUFFER" commands={{ wq }}>
        <input aria-label="email" />
      </TerminalWindow>,
    );

    const input = screen.getByLabelText("email");
    input.focus();
    fireEvent.keyDown(input, { key: ":" });

    expect(screen.getByText("AUTH.BUFFER")).toBeTruthy();
    expect(screen.queryByText(":")).toBeNull();
  });

  it("does nothing when no commands prop is given", () => {
    render(<TerminalWindow titleBarLabel="AUTH.BUFFER">Hello</TerminalWindow>);
    fireEvent.keyDown(document, { key: ":" });
    expect(screen.getByText("AUTH.BUFFER")).toBeTruthy();
  });
});
