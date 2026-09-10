"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createNoteAction } from "@/server/actions/notes";
import { useNotesMutations } from "@/lib/notes-query";

/**
 * No screen in Stitch shows a zero-notes state, so this is derived strictly
 * from the buffer canvas's own vocabulary: the `~` empty-line filler that
 * marks unused space past EOF in every editor screenshot.
 */
export function EmptyBuffer() {
  const router = useRouter();
  const { addNote } = useNotesMutations();
  const [pending, startTransition] = useTransition();

  const handleNewNote = () => {
    startTransition(async () => {
      const note = await createNoteAction({});
      addNote(note);
      router.push(`/notes/${note.id}`);
    });
  };

  return (
    <div className="w-full px-space-8 pt-space-8">
      <div className="w-full bg-surface-dim rounded-lg overflow-hidden">
        <div className="flex-1 py-space-4 px-space-6 font-code-editor text-code-editor leading-[1.75rem]">
          <p className="text-on-surface-variant">No buffer open.</p>
          <button
            onClick={handleNewNote}
            disabled={pending}
            className="mt-space-2 text-primary hover:underline disabled:opacity-60"
          >
            :new — create your first buffer [^N]
          </button>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="text-outline/25 select-none">
              ~
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
