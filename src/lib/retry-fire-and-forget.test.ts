import { describe, it, expect, vi } from "vitest";
import { retryFireAndForget } from "@/lib/retry-fire-and-forget";

describe("retryFireAndForget", () => {
  it("does not retry on success", async () => {
    const fn = vi.fn(async () => "ok");
    await retryFireAndForget(fn, 3, 0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries until success within the attempt budget", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("ok");
    await retryFireAndForget(fn, 3, 0);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up silently after exhausting attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(retryFireAndForget(fn, 3, 0)).resolves.toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
