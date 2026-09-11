import { describe, it, expect } from "vitest";
import { findLinkAt, isSafeLinkScheme, type LinkHit } from "@/components/editor/live-preview";

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

describe("isSafeLinkScheme", () => {
  it("allows http, https, and mailto (case-insensitive)", () => {
    expect(isSafeLinkScheme("https://example.com")).toBe(true);
    expect(isSafeLinkScheme("http://example.com")).toBe(true);
    expect(isSafeLinkScheme("mailto:someone@example.com")).toBe(true);
    expect(isSafeLinkScheme("HTTPS://EXAMPLE.COM")).toBe(true);
    expect(isSafeLinkScheme("MailTo:someone@example.com")).toBe(true);
  });

  it("rejects every scripting-capable scheme -- this is the XSS guard", () => {
    expect(isSafeLinkScheme("javascript:alert(document.cookie)")).toBe(false);
    expect(isSafeLinkScheme("JavaScript:alert(1)")).toBe(false);
    expect(isSafeLinkScheme("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeLinkScheme("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeLinkScheme("blob:https://example.com/uuid")).toBe(false);
    expect(isSafeLinkScheme("file:///etc/passwd")).toBe(false);
  });

  it("rejects a bare relative path -- no base URL to resolve one against", () => {
    expect(isSafeLinkScheme("/some/path")).toBe(false);
    expect(isSafeLinkScheme("not-a-url-at-all")).toBe(false);
  });

  it("rejects an empty string without throwing", () => {
    expect(isSafeLinkScheme("")).toBe(false);
  });
});
