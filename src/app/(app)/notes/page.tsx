import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { getMostRecentNoteId } from "@/lib/notes";
import { EmptyBuffer } from "@/components/buffer/EmptyBuffer";

export default async function NotesIndexPage() {
  const user = await getAuthedUser();
  const noteId = await getMostRecentNoteId(user.id);
  if (noteId) redirect(`/notes/${noteId}`);
  return <EmptyBuffer />;
}
