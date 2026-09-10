import { notFound } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { resolveShareToken, recordShareView } from "@/lib/shares";
import { SharedNoteView } from "@/components/buffer/SharedNoteView";

export default async function SharedNotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const viewer = await getAuthedUser();

  const share = await resolveShareToken(token);
  if (!share) notFound();

  await recordShareView(share.id, share.note.userId, viewer.id);

  return (
    <SharedNoteView
      title={share.note.title}
      content={share.note.content}
      ownerEmail={share.note.user.email}
      updatedAt={share.note.updatedAt}
    />
  );
}
