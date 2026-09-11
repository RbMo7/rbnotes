import { describe, it, expect } from "vitest";
import { groupNotes, type SidebarNote } from "@/lib/grouping";

function note(id: string, overrides: Partial<SidebarNote> = {}): SidebarNote {
  return {
    id,
    title: id,
    updatedAt: new Date(),
    pinned: false,
    archived: false,
    ...overrides,
  };
}

describe("groupNotes", () => {
  it("sorts pinned notes before unpinned ones within a group, most-recent first within each", () => {
    const now = new Date();
    const older = new Date(now.getTime() - 1000);
    const notes = [
      note("unpinned-newer", { updatedAt: now }),
      note("pinned-older", { pinned: true, updatedAt: older }),
      note("pinned-newer", { pinned: true, updatedAt: now }),
      note("unpinned-older", { updatedAt: older }),
    ];

    const [group] = groupNotes(notes);

    expect(group.notes.map((n) => n.id)).toEqual([
      "pinned-newer",
      "pinned-older",
      "unpinned-newer",
      "unpinned-older",
    ]);
  });
});
