import { describe, it, expect } from "vitest";
import { findLinkAt, type LinkHit } from "@/components/editor/live-preview";

describe("findLinkAt", () => {
  const links: LinkHit[] = [
    { from: 5, to: 10, url: "https://a.example" },
    { from: 20, to: 25, url: "https://b.example" },
  ];

  it("finds the link covering a position inside its range", () => {
    expect(findLinkAt(links, 7)?.url).toBe("https://a.example");
    expect(findLinkAt(links, 22)?.url).toBe("https://b.example");
  });

  it("treats the range boundaries as inclusive", () => {
    expect(findLinkAt(links, 5)?.url).toBe("https://a.example");
    expect(findLinkAt(links, 10)?.url).toBe("https://a.example");
  });

  it("returns undefined for a position between or outside links", () => {
    expect(findLinkAt(links, 15)).toBeUndefined();
    expect(findLinkAt(links, 0)).toBeUndefined();
    expect(findLinkAt(links, 100)).toBeUndefined();
  });

  it("returns undefined when there are no links", () => {
    expect(findLinkAt([], 5)).toBeUndefined();
  });
});
