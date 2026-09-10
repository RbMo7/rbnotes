-- Defense in depth: Prisma connects as the Postgres owner and bypasses RLS,
-- so all real access control lives in application code (src/lib/notes.ts,
-- src/lib/shares.ts), which always derives userId from the verified
-- Supabase session. This migration enables RLS with NO permissive policies
-- on every app table, so a leaked publishable/anon key -- which only ever
-- carries `authenticated`/`anon` Postgres roles, never the owner role --
-- reads and writes nothing directly against Postgres.

ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "note_shares" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "note_share_views" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "profiles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "notes" FORCE ROW LEVEL SECURITY;
ALTER TABLE "note_shares" FORCE ROW LEVEL SECURITY;
ALTER TABLE "note_share_views" FORCE ROW LEVEL SECURITY;
