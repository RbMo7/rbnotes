import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  getNote,
  setNote,
  listNotes,
  tombstoneNote,
  purgeNote,
  purgeSyncedNotes,
  markSynced,
  getOrCreateDeviceId,
  setThemeMeta,
  getThemeMeta,
  isMigratable,
  isPurgeable,
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
    ownerId: null,
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

  it("getThemeMeta returns undefined until setThemeMeta has been called", async () => {
    expect(await getThemeMeta()).toBeUndefined();
    await setThemeMeta("dark");
    expect(await getThemeMeta()).toBe("dark");
    await setThemeMeta("light");
    expect(await getThemeMeta()).toBe("light");
  });

  describe("isMigratable", () => {
    it("is true for a genuinely anonymous-origin note (ownerId: null)", () => {
      expect(isMigratable({ ownerId: null }, "alice")).toBe(true);
    });

    it("is true for the same account resuming its own note", () => {
      expect(isMigratable({ ownerId: "alice" }, "alice")).toBe(true);
    });

    it("is false for a different account's note, regardless of intent -- this is the cross-account-leak guard", () => {
      expect(isMigratable({ ownerId: "alice" }, "bob")).toBe(false);
    });
  });

  describe("isPurgeable", () => {
    it("is true only for the signing-out account's own already-synced note", () => {
      expect(isPurgeable({ ownerId: "alice", syncedAt: "2026-01-01T00:00:00.000Z" }, "alice")).toBe(
        true,
      );
    });

    it("is false for the same account's still-unsynced note -- never destroy a pending edit", () => {
      expect(isPurgeable({ ownerId: "alice", syncedAt: null }, "alice")).toBe(false);
    });

    it("is false for a genuinely anonymous note -- sign-out must never touch Local-only data", () => {
      expect(isPurgeable({ ownerId: null, syncedAt: "2026-01-01T00:00:00.000Z" }, "alice")).toBe(
        false,
      );
    });

    it("is false for a different account's synced note", () => {
      expect(isPurgeable({ ownerId: "bob", syncedAt: "2026-01-01T00:00:00.000Z" }, "alice")).toBe(
        false,
      );
    });
  });

  describe("purgeSyncedNotes", () => {
    it("removes only the signing-out account's own synced notes", async () => {
      await setNote(note({ id: "alice-synced", ownerId: "alice", syncedAt: "2026-01-01T00:00:00.000Z" }));
      await setNote(note({ id: "alice-unsynced", ownerId: "alice", syncedAt: null }));
      await setNote(note({ id: "anonymous", ownerId: null, syncedAt: null }));
      await setNote(note({ id: "bob-synced", ownerId: "bob", syncedAt: "2026-01-01T00:00:00.000Z" }));

      await purgeSyncedNotes("alice");

      const remainingIds = (await listNotes()).map((n) => n.id).sort();
      expect(remainingIds).toEqual(["anonymous", "bob-synced", "alice-unsynced"].sort());
      expect(await getNote("alice-synced")).toBeUndefined();
    });
  });
});
