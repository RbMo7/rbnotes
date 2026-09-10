import { describe, it, expect } from "vitest";
import { QUOTES, pickRandomQuote } from "@/lib/quotes";

describe("pickRandomQuote", () => {
  it("is deterministic given an injected RNG", () => {
    expect(pickRandomQuote(() => 0)).toBe(QUOTES[0]);
    expect(pickRandomQuote(() => 0.9999)).toBe(QUOTES[QUOTES.length - 1]);
  });

  it("always returns a quote in range for any value in [0, 1)", () => {
    for (const r of [0, 0.1, 0.5, 0.75, 0.999]) {
      expect(QUOTES).toContain(pickRandomQuote(() => r));
    }
  });
});
