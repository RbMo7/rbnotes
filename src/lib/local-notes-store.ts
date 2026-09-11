"use client";

import { createStore, get, set, del, values } from "idb-keyval";

/**
 * Seam 1 (offline-first spec): the browser-durable copy of a note, kept
 * separately from the in-memory TanStack Query cache (lib/notes-query.ts).
 * `editedAt` is the client-side Edited mark -- set the instant a local
 * change happens, never blocked by network. `syncedAt` is the Synced mark --
 * null until a push to the server has actually succeeded (see
 * CONTEXT.md's "Storage & sync" section for the canonical terms).
 *
 * A note is never hard-deleted on delete; `deleted` (Tombstone) is set
 * instead, so the delete itself has something to sync. `purgeNote` is the
 * separate, later step that actually removes the record, called only once
 * a delete is known to be safe to forget (see local-sync.ts).
 *
 * `ownerId` is the account (its id) that created or last owns this record,
 * or `null` for a genuinely Local-only note (CONTEXT.md) with no account
 * involved at all. It exists to answer a question `syncedAt` alone can't:
 * "unsynced" and "anonymous-origin" are NOT the same thing -- a note
 * created while signed in, that just hasn't reached the server yet, is
 * unsynced but still belongs to that account. Conflating the two was a
 * real cross-account leak (a stranded unsynced note from one account could
 * get adopted by a different account signing in on the same device); see
 * `isMigratable`/`isPurgeable` below and the amendment in
 * docs/adr/0002-offline-first-local-storage.md.
 */
export type LocalNote = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  editedAt: string;
  syncedAt: string | null;
  deleted: boolean;
  ownerId: string | null;
};

/**
 * Sign-in eligibility: a record adopts into the signing-in account only if
 * it's genuinely anonymous-origin (`ownerId === null`) or it's the same
 * account resuming its own previously-stranded, not-yet-synced note on
 * this device. Never a different account's `ownerId` -- that's the
 * cross-account leak this type exists to prevent, regardless of
 * `syncedAt`.
 */
export function isMigratable(
  note: Pick<LocalNote, "ownerId">,
  currentUserId: string,
): boolean {
  return note.ownerId === null || note.ownerId === currentUserId;
}

/**
 * Sign-out purge eligibility: only a record owned by the signing-out
 * account AND already confirmed synced (recoverable from the server) is
 * safe to delete. A same-account record that's still unsynced is left
 * alone -- not lost, not purged, just inert locally until that account
 * signs back in on this device (where `isMigratable` picks it back up).
 */
export function isPurgeable(
  note: Pick<LocalNote, "ownerId" | "syncedAt">,
  signingOutUserId: string,
): boolean {
  return note.ownerId === signingOutUserId && note.syncedAt !== null;
}

// A dedicated IndexedDB database/store, separate from any other client
// storage this app might add later -- idb-keyval's default store is
// process-wide, so scoping explicitly avoids a silent collision. The device
// id lives in a wholly separate database (idb-keyval only ever creates the
// one object store it's first asked for per database name) so listNotes's
// values() scan over "notes" can never mistake it for a note record.
const store = createStore("rbnotes-local", "notes");
const metaStore = createStore("rbnotes-local-meta", "meta");

// Every idb-keyval call goes through these -- IndexedDB can be genuinely
// absent (SSR, some test environments, private browsing in older Safari),
// and callers (useAutosave, DeviceTracking) must never crash or reject
// unhandled over what's meant to be a best-effort durability layer.
async function safeGet<T>(key: IDBValidKey, s: ReturnType<typeof createStore>): Promise<T | undefined> {
  try {
    return await get<T>(key, s);
  } catch {
    return undefined;
  }
}
async function safeSet(key: IDBValidKey, value: unknown, s: ReturnType<typeof createStore>): Promise<void> {
  try {
    await set(key, value, s);
  } catch {
    // Best-effort -- see note above.
  }
}
async function safeDel(key: IDBValidKey, s: ReturnType<typeof createStore>): Promise<void> {
  try {
    await del(key, s);
  } catch {
    // Best-effort -- see note above.
  }
}
async function safeValues<T>(s: ReturnType<typeof createStore>): Promise<T[]> {
  try {
    return await values<T>(s);
  } catch {
    return [];
  }
}

export async function getNote(id: string): Promise<LocalNote | undefined> {
  return safeGet<LocalNote>(id, store);
}

export async function setNote(note: LocalNote): Promise<void> {
  await safeSet(note.id, note, store);
}

export async function listNotes(
  options: { includeDeleted?: boolean } = {},
): Promise<LocalNote[]> {
  const all = await safeValues<LocalNote>(store);
  return options.includeDeleted ? all : all.filter((n) => !n.deleted);
}

/** Soft delete: sets the Tombstone flag and bumps the Edited mark, keeps the record. */
export async function tombstoneNote(id: string, editedAt: string): Promise<void> {
  const existing = await safeGet<LocalNote>(id, store);
  if (!existing) return;
  await safeSet(id, { ...existing, deleted: true, editedAt }, store);
}

/** Actually removes a note's local record -- only once its delete is confirmed synced (or never existed server-side). */
export async function purgeNote(id: string): Promise<void> {
  await safeDel(id, store);
}

/**
 * Removes this account's already-synced local copies -- called on sign-out
 * so a previous account's confirmed-synced notes don't linger in this
 * browser's storage once it's back to being an anonymous session. Genuine
 * Local-only notes (`ownerId === null`) are always untouched, and -- since
 * `isPurgeable` requires both ownership AND `syncedAt !== null` -- so is
 * this account's own still-unsynced note: it stays put, recoverable the
 * next time this account signs in on this device, rather than being
 * silently destroyed.
 */
export async function purgeSyncedNotes(signingOutUserId: string): Promise<void> {
  const all = await safeValues<LocalNote>(store);
  await Promise.all(
    all.filter((n) => isPurgeable(n, signingOutUserId)).map((n) => safeDel(n.id, store)),
  );
}

/** Records a successful push to the server without touching any other field. */
export async function markSynced(id: string, syncedAt: string): Promise<void> {
  const existing = await safeGet<LocalNote>(id, store);
  if (!existing) return;
  await safeSet(id, { ...existing, syncedAt }, store);
}

const DEVICE_ID_KEY = "device-id";

/**
 * The random id an anonymous Device (CONTEXT.md) pings the server with --
 * generated once, persisted in this same local database so it survives a
 * refresh, and never tied to note content. Falls back to a fresh,
 * unpersisted id if IndexedDB itself is unavailable -- that device simply
 * won't be recognized on the next visit, which is an acceptable analytics
 * gap, not a functional one.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await safeGet<string>(DEVICE_ID_KEY, metaStore);
  if (existing) return existing;
  const id = crypto.randomUUID();
  await safeSet(DEVICE_ID_KEY, id, metaStore);
  return id;
}

const THEME_KEY = "theme";

/**
 * A redundant IndexedDB mirror of the active theme, alongside
 * localStorage's copy (local-settings.ts, which stays the synchronous
 * read path SettingsHydrator's lazy initializer needs -- IndexedDB reads
 * are always async and can't serve that). Pure backup: private browsing
 * or a cleared localStorage can lose the theme choice while IndexedDB
 * survives, or vice versa, so writing to both costs little and covers
 * more failure modes than either alone.
 */
export async function setThemeMeta(theme: string): Promise<void> {
  await safeSet(THEME_KEY, theme, metaStore);
}

export async function getThemeMeta(): Promise<string | undefined> {
  return safeGet<string>(THEME_KEY, metaStore);
}
