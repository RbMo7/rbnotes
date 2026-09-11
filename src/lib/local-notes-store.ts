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
};

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
