"use server";

import { getAuthedUser } from "@/lib/auth";
import * as shares from "@/lib/shares";
import { noteIdSchema } from "@/lib/schemas";

// No revalidatePath here: WorkspaceBuffer already updates its own share
// state client-side from these actions' return values (see
// InspectorPanel's props), so revalidating the note page just forced an
// unnecessary server refetch/re-render on every share/unshare click.

export async function createShareAction(input: unknown) {
  const user = await getAuthedUser();
  const { noteId } = noteIdSchema.parse(input);
  const share = await shares.createOrGetShare(user.id, noteId);
  return { token: share.token };
}

export async function revokeShareAction(input: unknown) {
  const user = await getAuthedUser();
  const { noteId } = noteIdSchema.parse(input);
  await shares.revokeShare(user.id, noteId);
}

export async function getShareInfoAction(input: unknown) {
  const user = await getAuthedUser();
  const { noteId } = noteIdSchema.parse(input);
  const share = await shares.getShareForNote(user.id, noteId);
  if (!share) return { share: null, viewers: [] };
  const viewers = await shares.listShareViewers(share.id);
  return {
    share: { token: share.token },
    viewers: viewers.map((v) => ({
      email: v.viewer.email,
      viewCount: v.viewCount,
      lastViewedAt: v.lastViewedAt.toISOString(),
    })),
  };
}
