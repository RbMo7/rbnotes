/**
 * Reproduces the Stitch sidebar exactly: TODAY / THIS WEEK / EARLIER by
 * `updatedAt`, with archived notes pulled into their own ARCHIVE group
 * regardless of recency, matching the two screenshotted groups plus the
 * archive bucket implied by the `inventory_2` icon rows.
 */

export type SidebarNote = {
  id: string;
  title: string;
  updatedAt: Date;
  pinned: boolean;
  archived: boolean;
};

export type NoteGroup = {
  label: "TODAY" | "THIS WEEK" | "EARLIER" | "ARCHIVE";
  notes: SidebarNote[];
};

export function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function groupNotes(notes: SidebarNote[]): NoteGroup[] {
  const now = new Date();
  const today = startOfDay(now);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const archive: SidebarNote[] = [];
  const todayGroup: SidebarNote[] = [];
  const weekGroup: SidebarNote[] = [];
  const earlierGroup: SidebarNote[] = [];

  for (const note of notes) {
    if (note.archived) {
      archive.push(note);
      continue;
    }
    if (note.updatedAt >= today) {
      todayGroup.push(note);
    } else if (note.updatedAt >= weekAgo) {
      weekGroup.push(note);
    } else {
      earlierGroup.push(note);
    }
  }

  const groups: NoteGroup[] = [];
  if (todayGroup.length) groups.push({ label: "TODAY", notes: todayGroup });
  if (weekGroup.length) groups.push({ label: "THIS WEEK", notes: weekGroup });
  if (earlierGroup.length) groups.push({ label: "EARLIER", notes: earlierGroup });
  if (archive.length) groups.push({ label: "ARCHIVE", notes: archive });
  return groups;
}

/** "11:42" for today, "Oct 12" otherwise — exactly the Stitch sidebar rows. */
export function formatSidebarTimestamp(date: Date): string {
  const today = startOfDay(new Date());
  if (date >= today) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}
