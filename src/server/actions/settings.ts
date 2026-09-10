"use server";

import { getAuthedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { settingsSchema } from "@/lib/schemas";

export async function saveSettingsAction(input: unknown) {
  const user = await getAuthedUser();
  const settings = settingsSchema.parse(input);
  await db.profile.update({ where: { id: user.id }, data: { settings } });
  // No revalidatePath: both SettingsView and BufferWorkspace already hold
  // their own optimistic client-side settings state, so revalidating just
  // forced an unnecessary refetch/re-render of the whole app shell on
  // every settings change. The next fresh page load naturally picks up
  // the persisted value regardless.
}
