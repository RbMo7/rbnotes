/**
 * A note's title is the note's own first `# heading` -- there is no
 * separate title field for the user to keep in sync by hand. `:rename`
 * (see command-dispatch.ts) works by editing that heading line directly,
 * not by writing to a separate metadata field, so the two can never drift
 * apart. Isomorphic (no server-only import): used both server-side, when
 * persisting a save, and client-side, to locate the heading line to splice.
 */
const H1_LINE = /^#(?!#)\s+(.+?)\s*$/;

export function deriveTitleFromContent(content: string): string {
  for (const line of content.split("\n")) {
    const match = H1_LINE.exec(line);
    if (match) return match[1].trim() || "untitled";
  }
  return "untitled";
}

export function isH1Line(lineText: string): boolean {
  return H1_LINE.test(lineText);
}
