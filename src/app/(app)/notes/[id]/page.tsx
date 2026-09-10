import { notFound } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { getNote, getBufferNumber } from "@/lib/notes";
import { settingsSchema, defaultSettings } from "@/lib/schemas";
import { BufferWorkspace } from "@/components/buffer/BufferWorkspace";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getAuthedUser();

  // getNote scopes strictly to `userId` -- a note that exists but belongs to
  // someone else resolves to null here, same as a note that doesn't exist
  // at all. That's deliberate: it must never distinguish "not yours" from
  // "not found".
  const note = await getNote(user.id, id);
  if (!note) notFound();

  const bufferNumber = await getBufferNumber(user.id, note);
  const parsedSettings = settingsSchema.safeParse(user.settings);
  const settings = parsedSettings.success ? parsedSettings.data : defaultSettings;

  return (
    <BufferWorkspace
      key={note.id}
      note={{
        id: note.id,
        title: note.title,
        content: note.content,
        createdAt: note.createdAt,
      }}
      bufferNumber={bufferNumber}
      initialSettings={settings}
    />
  );
}
