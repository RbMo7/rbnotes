import { describe, it, expect, vi } from "vitest";
import { nextToWarm, runWarmUpLoop } from "@/lib/warm-up";
import type { NoteRecord } from "@/lib/note-types";

function note(overrides: Partial<NoteRecord> & { id: string; updatedAt: string }): NoteRecord {
  return {
    title: "untitled",
    pinned: false,
    archived: false,
    createdAt: overrides.updatedAt,
    ...overrides,
  };
}

describe("nextToWarm", () => {
  it("picks the most-recently-updated cold note", () => {
    const notes = [
      note({ id: "a", updatedAt: "2026-01-01T00:00:00.000Z" }),
      note({ id: "b", updatedAt: "2026-01-03T00:00:00.000Z" }),
      note({ id: "c", updatedAt: "2026-01-02T00:00:00.000Z" }),
    ];
    expect(nextToWarm(notes)?.id).toBe("b");
  });

  it("skips already-warm notes (content present, even empty string)", () => {
    const notes = [
      note({ id: "a", updatedAt: "2026-01-02T00:00:00.000Z", content: "" }),
      note({ id: "b", updatedAt: "2026-01-01T00:00:00.000Z" }),
    ];
    expect(nextToWarm(notes)?.id).toBe("b");
  });

  it("returns null once every note is warm", () => {
    const notes = [note({ id: "a", updatedAt: "2026-01-01T00:00:00.000Z", content: "hi" })];
    expect(nextToWarm(notes)).toBeNull();
  });
});

describe("runWarmUpLoop", () => {
  it("warms most-recently-updated first, strictly serial, with a stagger between each", async () => {
    const notes = [
      note({ id: "a", updatedAt: "2026-01-01T00:00:00.000Z" }),
      note({ id: "b", updatedAt: "2026-01-03T00:00:00.000Z" }),
      note({ id: "c", updatedAt: "2026-01-02T00:00:00.000Z" }),
    ];
    const order: string[] = [];
    const warmOne = vi.fn(async (id: string) => {
      order.push(`start:${id}`);
      const target = notes.find((n) => n.id === id)!;
      target.content = "warmed";
      order.push(`end:${id}`);
    });
    const delay = vi.fn(async (ms: number) => {
      order.push(`delay:${ms}`);
    });

    await runWarmUpLoop({
      getNotes: () => notes,
      warmOne,
      delay,
      staggerMs: 150,
      signal: new AbortController().signal,
    });

    expect(order).toEqual([
      "start:b",
      "end:b",
      "delay:150",
      "start:c",
      "end:c",
      "delay:150",
      "start:a",
      "end:a",
      "delay:150",
    ]);
  });

  it("stops immediately once aborted, without starting another fetch", async () => {
    const notes = [
      note({ id: "a", updatedAt: "2026-01-01T00:00:00.000Z" }),
      note({ id: "b", updatedAt: "2026-01-02T00:00:00.000Z" }),
    ];
    const controller = new AbortController();
    const warmOne = vi.fn(async (id: string) => {
      notes.find((n) => n.id === id)!.content = "warmed";
      controller.abort();
    });

    await runWarmUpLoop({
      getNotes: () => notes,
      warmOne,
      delay: async () => {},
      staggerMs: 10,
      signal: controller.signal,
    });

    expect(warmOne).toHaveBeenCalledOnce();
  });

  it("re-derives order fresh each tick -- a note added mid-loop can jump the remaining queue", async () => {
    const notes = [
      note({ id: "a", updatedAt: "2026-01-01T00:00:00.000Z" }),
      note({ id: "b", updatedAt: "2026-01-02T00:00:00.000Z" }),
    ];
    const order: string[] = [];

    await runWarmUpLoop({
      getNotes: () => notes,
      warmOne: async (id) => {
        order.push(id);
        notes.find((n) => n.id === id)!.content = "warmed";
        if (id === "b") {
          notes.push(note({ id: "c", updatedAt: "2026-01-05T00:00:00.000Z" }));
        }
      },
      delay: async () => {},
      staggerMs: 0,
      signal: new AbortController().signal,
    });

    expect(order).toEqual(["b", "c", "a"]);
  });
});
