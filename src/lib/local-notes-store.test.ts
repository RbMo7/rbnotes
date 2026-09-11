import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  getNote,
  setNote,
  listNotes,
  tombstoneNote,
  purgeNote,
  markSynced,
  getOrCreateDeviceId,
  type LocalNote,
} from "@/lib/local-notes-store";

function note(overrides: Partial<LocalNote> & { id: string }): LocalNote {
  return {
    title: "untitled",
    content: "",
    pinned: false,
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    editedAt: "2026-01-01T00:00:00.000Z",
    syncedAt: null,
    deleted: false,
    ...overrides,
  };
}

describe("local-notes-store", () => {
  beforeEach(async () => {
    for (const n of await listNotes({ includeDeleted: true })) {
      await purgeNote(n.id);
    }
  });

  it("round-trips a note through set/get", async () => {
    await setNote(note({ id: "a", content: "hello" }));
    expect(await getNote("a")).toEqual(note({ id: "a", content: "hello" }));
  });

  it("returns undefined for a note that was never written", async () => {
    expect(await getNote("missing")).toBeUndefined();
  });

  it("lists every non-deleted note", async () => {
    await setNote(note({ id: "a" }));
    await setNote(note({ id: "b" }));
    const notes = await listNotes();
    expect(notes.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });

  it("excludes a tombstoned note from list by default, but keeps it retrievable", async () => {
    await setNote(note({ id: "a" }));
    await tombstoneNote("a", "2026-01-02T00:00:00.000Z");

    expect((await listNotes()).map((n) => n.id)).not.toContain("a");
    const tombstoned = await getNote("a");
    expect(tombstoned?.deleted).toBe(true);
    expect(tombstoned?.editedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("includes tombstoned notes when explicitly asked", async () => {
    await setNote(note({ id: "a" }));
    await tombstoneNote("a", "2026-01-02T00:00:00.000Z");

    expect((await listNotes({ includeDeleted: true })).map((n) => n.id)).toContain("a");
  });

  it("purge removes a tombstoned note entirely", async () => {
    await setNote(note({ id: "a" }));
    await tombstoneNote("a", "2026-01-02T00:00:00.000Z");
    await purgeNote("a");

    expect(await getNote("a")).toBeUndefined();
  });

  it("markSynced sets the Synced mark without touching other fields", async () => {
    await setNote(note({ id: "a", content: "draft" }));
    await markSynced("a", "2026-01-03T00:00:00.000Z");

    const synced = await getNote("a");
    expect(synced?.syncedAt).toBe("2026-01-03T00:00:00.000Z");
    expect(synced?.content).toBe("draft");
  });

  it("markSynced is a no-op if the note no longer exists locally", async () => {
    await expect(markSynced("gone", "2026-01-03T00:00:00.000Z")).resolves.toBeUndefined();
  });

  it("getOrCreateDeviceId is stable across calls and never surfaces in listNotes", async () => {
    const first = await getOrCreateDeviceId();
    const second = await getOrCreateDeviceId();
    expect(second).toBe(first);

    await setNote(note({ id: "a" }));
    expect((await listNotes()).map((n) => n.id)).toEqual(["a"]);
  });
});
