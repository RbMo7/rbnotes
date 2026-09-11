"use client";

import { useMemo } from "react";
import { useNotesQuery } from "@/lib/notes-query";
import { startOfDay } from "@/lib/grouping";

/**
 * Replaces the old random-quote banner: a quote is a nice first
 * impression once, but returning users hit this screen constantly and
 * a one-line "N notes, M today" tells them something real instead.
 * Renders nothing when there are zero notes -- RecentNotesList's own
 * empty state already invites a first note, no need to say "0 notes"
 * twice on the same screen.
 */
export function DashboardStats() {
  const { data: notes = [] } = useNotesQuery();

  const { total, today } = useMemo(() => {
    const active = notes.filter((n) => !n.archived);
    const dayStart = startOfDay(new Date());
    return {
      total: active.length,
      today: active.filter((n) => new Date(n.updatedAt) >= dayStart).length,
    };
  }, [notes]);

  if (total === 0) return null;

  return (
    <p className="font-label-sm text-label-sm text-outline text-center">
      {total} note{total === 1 ? "" : "s"}
      {today > 0 && (
        <>
          {" "}
          · <span className="text-primary">{today}</span> today
        </>
      )}
    </p>
  );
}
