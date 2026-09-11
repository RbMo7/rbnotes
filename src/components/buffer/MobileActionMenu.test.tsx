// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MobileActionMenu } from "@/components/buffer/MobileActionMenu";

afterEach(cleanup);

describe("MobileActionMenu", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <MobileActionMenu open={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows plain labeled actions, no : syntax", () => {
    render(<MobileActionMenu open onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText("Save")).toBeTruthy();
    expect(screen.getByText("New note")).toBeTruthy();
    expect(screen.getByText("Share")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
    expect(screen.queryByText(":w")).toBeNull();
    expect(screen.queryByText("Tab-Complete Buffer")).toBeNull();
  });

  it("Save submits the raw 'w' command and closes", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<MobileActionMenu open onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText("Save"));
    expect(onSubmit).toHaveBeenCalledWith("w");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("New note submits 'new' and closes", () => {
    const onSubmit = vi.fn();
    render(<MobileActionMenu open onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText("New note"));
    expect(onSubmit).toHaveBeenCalledWith("new");
  });

  it("Share submits 'share' and closes", () => {
    const onSubmit = vi.fn();
    render(<MobileActionMenu open onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText("Share"));
    expect(onSubmit).toHaveBeenCalledWith("share");
  });

  it("Delete submits 'delete' (soft/archive) with no bang, and closes", () => {
    const onSubmit = vi.fn();
    render(<MobileActionMenu open onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText("Delete"));
    expect(onSubmit).toHaveBeenCalledWith("delete");
  });

  it("Rename reveals a plain title field and submits 'rename <title>'", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<MobileActionMenu open onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText("Rename"));

    const input = screen.getByLabelText("New title");
    fireEvent.change(input, { target: { value: "Shopping list" } });
    fireEvent.submit(input.closest("form")!);

    expect(onSubmit).toHaveBeenCalledWith("rename Shopping list");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closing resets the rename field for next time", () => {
    const { rerender } = render(
      <MobileActionMenu open onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    fireEvent.click(screen.getByText("Rename"));
    expect(screen.getByLabelText("New title")).toBeTruthy();

    rerender(<MobileActionMenu open={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    rerender(<MobileActionMenu open onClose={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.queryByLabelText("New title")).toBeNull();
    expect(screen.getByText("Rename")).toBeTruthy();
  });
});
