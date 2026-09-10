/**
 * The Stitch design always shows notes as filenames — "daily-scratchpad.md",
 * "rabbitmq.md" — never as plain titles. `Note.title` is stored as the bare
 * name (e.g. "daily scratchpad"); this is the one place ".md" gets appended
 * for display, so the whole app renders the same filename consistently.
 */
export function displayFilename(title: string): string {
  const slug = title.trim().toLowerCase().replace(/\s+/g, "-") || "untitled";
  return `${slug}.md`;
}

export function formatWordCount(content: string): number {
  const trimmed = content.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function formatRelativeCreated(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

/** Short content hash for the buffer sub-header's "SHA: b83f1e9" chip. */
export function shortHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(16).padStart(7, "0").slice(0, 7);
}
