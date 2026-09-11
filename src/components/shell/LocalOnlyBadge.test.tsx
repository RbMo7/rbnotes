// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { LocalOnlyBadge } from "@/components/shell/LocalOnlyBadge";

afterEach(cleanup);

describe("LocalOnlyBadge", () => {
  it("shows the Local-only indicator and a way to sign in", () => {
    render(<LocalOnlyBadge />);
    expect(screen.getByText("LOCAL")).toBeTruthy();
    expect(screen.getByText("[:login]")).toBeTruthy();
    expect(screen.getByText("sync")).toBeTruthy();
  });
});
