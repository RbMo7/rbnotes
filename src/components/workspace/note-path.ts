const NOTE_PATH = /^\/notes\/([^/]+)\/?$/;

/** Pure: `/notes/<id>` -> `<id>`, everything else (including bare `/notes`) -> null. */
export function parseNoteIdFromPath(pathname: string): string | null {
  return NOTE_PATH.exec(pathname)?.[1] ?? null;
}

export function noteHref(noteId: string): string {
  return `/notes/${noteId}`;
}
