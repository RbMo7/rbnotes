-- Trigram index for fast substring search on notes.title/content. Not
-- declared in schema.prisma: Prisma 6.19.3 has no previewFeatures enabled,
-- and both the extensions-in-datasource and GIN-operator-class schema
-- syntax require preview flags of unconfirmed stability at this version --
-- same reasoning as the hand-written RLS-lockdown migration. Managed here
-- as plain DDL instead.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX notes_title_trgm_idx ON "notes" USING GIN ("title" gin_trgm_ops);
CREATE INDEX notes_content_trgm_idx ON "notes" USING GIN ("content" gin_trgm_ops);
