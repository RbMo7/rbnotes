import "server-only";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

function isUniqueEmailConflict(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    Array.isArray(err.meta?.target) &&
    err.meta.target.includes("email")
  );
}

/**
 * Keeps the mirrored `Profile` row in sync with the current Supabase auth
 * user. Not a plain `upsert` keyed on id: Supabase can hand out a *new*
 * auth user id for an email that already has a Profile row here (the
 * account was deleted and re-registered with the same email -- a normal
 * user-facing flow, not just a theoretical edge case). A naive
 * `upsert({ where: { id } })` fails in that case with a unique-email
 * constraint violation on create. Self-heal by freeing the stale row's
 * email so the current session can claim it; that old row's notes, if any,
 * belong to an auth account that no longer exists anyway.
 */
async function syncProfile(id: string, email: string) {
  const byId = await db.profile.findUnique({ where: { id } });
  if (byId) {
    return byId.email === email ? byId : db.profile.update({ where: { id }, data: { email } });
  }

  try {
    return await db.profile.create({ data: { id, email } });
  } catch (err) {
    if (!isUniqueEmailConflict(err)) throw err;

    // Two distinct races land here, and only one calls for quarantining
    // anything: (a) a concurrent request for this exact id won and already
    // created the row -- just use it; (b) the email genuinely belongs to a
    // different, stale id (the Supabase account was deleted and
    // re-registered with the same email) -- only then quarantine that
    // row's email so this session can claim it.
    const nowById = await db.profile.findUnique({ where: { id } });
    if (nowById) return nowById;

    await db.profile.update({
      where: { email },
      data: { email: `${email}.orphaned-${Date.now()}` },
    });
    return db.profile.create({ data: { id, email } });
  }
}

/**
 * The single source of truth for "who is making this request." Every
 * server action and data-access function in lib/notes.ts and lib/shares.ts
 * calls this — never a client-supplied userId — before touching the
 * database.
 */
export async function getAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login");
  }

  return syncProfile(user.id, user.email);
}

/** Like getAuthedUser, but returns null instead of redirecting. */
export async function getOptionalUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return null;

  return syncProfile(user.id, user.email);
}
