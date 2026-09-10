import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { resolveShareToken, recordShareView } from "@/lib/shares";
import { SharedNoteView } from "@/components/buffer/SharedNoteView";

// A shared note's whole point is a private, unguessable link -- never
// something to surface in search results, regardless of who has the URL.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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
