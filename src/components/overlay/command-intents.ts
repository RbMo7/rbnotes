/**
 * Plain-English intent search over the app's `:` command set -- see
 * docs/research/cheatsheet-intent-search.md for the algorithm's rationale
 * (Dice coefficient over normalized tokens, bigram-Dice fallback for
 * typos/plurals) and the survey of prior art it's derived from.
 */

import type { CommandChip } from "@/components/buffer/CommandDock";

export type CommandIntentEntry = CommandChip & {
  /**
   * Curated synonyms/phrases a non-power-user might type, in plain words --
   * not vim jargon, not a restatement of `desc`. `label`/`full`/`desc` are
   * still part of the searchable surface (see `searchableSurface` below),
   * so a literal match ("pin" for `:pin`) works without duplicating it here.
   */
  intents: string[];
};

export type CommandIntentMatch = {
  entry: CommandIntentEntry;
  /** 0..1, the highest-scoring phrase for this command. */
  score: number;
  /** Which phrase (an intent, or desc/label/full) produced that score. */
  matchedPhrase: string;
};

/** Lowercases, strips punctuation, and splits on whitespace into tokens. */
export function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function bigrams(s: string): Set<string> {
  if (s.length < 2) return new Set([s]);
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}

/**
 * Sørensen-Dice coefficient over each word's 2-char substrings -- a cheap
 * near-miss check for typos/plurals ("sidebar" vs "sidebars"), not a
 * general string-similarity metric. 1 for identical strings, 0 for two
 * strings sharing no bigrams at all.
 */
export function bigramDice(a: string, b: string): number {
  const setA = bigrams(a);
  const setB = bigrams(b);
  if (a.length < 2 && b.length < 2) return a === b ? 1 : 0;
  let intersection = 0;
  for (const bg of setA) if (setB.has(bg)) intersection++;
  return (2 * intersection) / (setA.size + setB.size);
}

const BIGRAM_FALLBACK_THRESHOLD = 0.6;
const BIGRAM_FALLBACK_CREDIT = 0.7;

/**
 * Dice coefficient over normalized word tokens: how much of `queryTokens`
 * is accounted for by `phraseTokens`, weighted toward exact token matches
 * with partial (never full) credit for a near-miss bigram match on an
 * unmatched token, to absorb typos/plurals.
 */
export function diceTokenScore(queryTokens: string[], phraseTokens: string[]): number {
  if (queryTokens.length === 0 || phraseTokens.length === 0) return 0;
  let matched = 0;
  for (const qt of queryTokens) {
    if (phraseTokens.includes(qt)) {
      matched += 1;
      continue;
    }
    const best = Math.max(...phraseTokens.map((pt) => bigramDice(qt, pt)));
    if (best >= BIGRAM_FALLBACK_THRESHOLD) matched += BIGRAM_FALLBACK_CREDIT;
  }
  return (2 * matched) / (queryTokens.length + phraseTokens.length);
}

const DEFAULT_MIN_SCORE = 0.35;
const DEFAULT_LIMIT = 5;

type PhraseCandidate = { phrase: string; fromIntents: boolean };

/** Every phrase an entry can be found by: its curated intents, plus its own label/full/desc as a literal fallback. */
function searchableSurface(entry: CommandIntentEntry): PhraseCandidate[] {
  return [
    ...entry.intents.map((phrase) => ({ phrase, fromIntents: true })),
    { phrase: entry.desc, fromIntents: false },
    { phrase: entry.label, fromIntents: false },
    { phrase: entry.full, fromIntents: false },
  ];
}

/**
 * Scores every command in `table` against `query` and returns matches above
 * `minScore`, highest score first. Pure function, no I/O, safe to call on
 * every keystroke (debounce is a UI concern, not this function's).
 *
 * Ties break, in order: (1) the winning phrase's token count, shorter first
 * -- a tie against a 1-word phrase is a more confident signal than the same
 * score from a longer, partially-fuzzy match; (2) a winning phrase from the
 * curated `intents[]` beats one from `desc`/`label`/`full` -- an explicit
 * synonym is a stronger authorial signal than an incidental literal hit;
 * (3) original `table` order, stable -- deterministic, and keeps
 * `COMMAND_INTENTS`' own ordering (more frequently-used commands listed
 * first) as the tiebreaker of last resort.
 */
export function searchCommandIntents(
  query: string,
  table: CommandIntentEntry[] = COMMAND_INTENTS,
  opts?: { minScore?: number; limit?: number },
): CommandIntentMatch[] {
  const minScore = opts?.minScore ?? DEFAULT_MIN_SCORE;
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const queryTokens = normalize(query);
  if (queryTokens.length === 0) return [];

  type Scored = CommandIntentMatch & { phraseTokenCount: number; fromIntents: boolean; index: number };

  const scored: Scored[] = table.map((entry, index) => {
    let best: Scored = {
      entry,
      score: 0,
      matchedPhrase: "",
      phraseTokenCount: Infinity,
      fromIntents: false,
      index,
    };
    for (const { phrase, fromIntents } of searchableSurface(entry)) {
      const phraseTokens = normalize(phrase);
      const score = diceTokenScore(queryTokens, phraseTokens);
      if (score > best.score) {
        best = { entry, score, matchedPhrase: phrase, phraseTokenCount: phraseTokens.length, fromIntents, index };
      }
    }
    return best;
  });

  return scored
    .filter((m) => m.score >= minScore)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.phraseTokenCount !== b.phraseTokenCount) return a.phraseTokenCount - b.phraseTokenCount;
      if (a.fromIntents !== b.fromIntents) return a.fromIntents ? -1 : 1;
      return a.index - b.index;
    })
    .slice(0, limit)
    .map(({ entry, score, matchedPhrase }) => ({ entry, score, matchedPhrase }));
}

export type CheatsheetRow = { key: string; desc: string };
export type CheatsheetSection = { title: string; keys: [string, string][] };

/**
 * Search surface for the cheatsheet's search box: every literal row it
 * already shows (vim motions, global keybinds, `:` commands -- HelpBuffer's
 * `SECTIONS`), plus `:` commands reachable only through a curated intent
 * synonym. Two matching strategies merged, not one, because they solve
 * different complaints:
 *
 * - Plain substring/prefix match across every row's key+desc handles both
 *   short "narrow the list as I type" queries ("s", "se") and a literal
 *   word that only ever appears in a *keybind's* description, never in any
 *   `:` command's own intents -- "search" only exists in Ctrl+/'s "search
 *   every note", which `searchCommandIntents` alone can never see since it
 *   only knows about the curated `:` command table, not `SECTIONS` as a
 *   whole (the bug this fixes: typing "search" found nothing even though
 *   the cheatsheet visibly shows that row).
 * - `searchCommandIntents` still runs on top, adding `:` commands reachable
 *   only via a synonym ("browse notes" -> :b) that no substring match could
 *   ever find, since the words genuinely don't appear together anywhere.
 *
 * Literal matches are listed first (a directly-typed word is a more
 * confident signal than a synonym), each key deduplicated once.
 */
export function searchCheatsheet(
  query: string,
  sections: CheatsheetSection[],
  intentTable: CommandIntentEntry[] = COMMAND_INTENTS,
): CheatsheetRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const seen = new Set<string>();
  const rows: CheatsheetRow[] = [];

  for (const section of sections) {
    for (const [key, desc] of section.keys) {
      if (seen.has(key)) continue;
      if (key.toLowerCase().includes(q) || desc.toLowerCase().includes(q)) {
        seen.add(key);
        rows.push({ key, desc });
      }
    }
  }

  for (const { entry } of searchCommandIntents(query, intentTable)) {
    if (seen.has(entry.label)) continue;
    seen.add(entry.label);
    rows.push({ key: entry.label, desc: entry.desc });
  }

  return rows;
}

/**
 * Every command's curated intent phrases -- plain words a non-power user
 * might type, not vim jargon and not a restatement of `desc`. Keyed off
 * `full` (already the unique identifier CommandDock and command-dispatch
 * agree on: it's literally what gets submitted to `dispatchCommand`), so
 * there's exactly one source of truth for "which command is this" across
 * the dock, the dispatcher, and this search. See
 * docs/research/cheatsheet-intent-search.md §4 for how this list was derived.
 */
export const COMMAND_INTENTS: CommandIntentEntry[] = [
  {
    label: ":w", full: "w", desc: "save",
    intents: ["save", "save note", "save my note", "write", "keep changes", "persist", "save changes", "don't lose my work"],
  },
  {
    label: ":wq", full: "wq", desc: "save & close",
    intents: ["save and close", "save and quit", "save and exit", "finish editing", "done editing", "wrap up", "save then close"],
  },
  {
    label: ":q", full: "q", desc: "close",
    intents: ["close", "close note", "exit note", "quit", "leave note", "close tab", "close this"],
  },
  {
    label: ":new", full: "new", desc: "new note",
    intents: ["new note", "create note", "add note", "start a note", "blank note", "make a new note", "write something new"],
  },
  {
    label: ":rename <title>", full: "rename ", desc: "rename note",
    intents: ["rename", "rename note", "change title", "change name", "retitle", "edit title", "give it a new name"],
  },
  {
    label: ":pin", full: "pin", desc: "toggle pin",
    intents: ["pin", "pin this", "pin note", "unpin", "favorite", "star this", "keep at top", "bookmark"],
  },
  {
    label: ":pins", full: "pins", desc: "pinned notes switcher",
    intents: ["pinned notes", "show pinned", "favorites list", "starred notes", "jump to pinned", "switch pinned notes"],
  },
  {
    label: ":delete", full: "delete", desc: "delete note", danger: true,
    intents: ["delete", "delete note", "remove note", "trash this", "throw away", "get rid of it", "archive note"],
  },
  {
    label: ":share", full: "share", desc: "share link",
    intents: ["share", "share note", "share link", "get link", "send to someone", "public link", "collaborate"],
  },
  {
    label: ":unshare", full: "unshare", desc: "revoke link",
    intents: ["unshare", "revoke link", "stop sharing", "remove access", "disable link", "make it private again"],
  },
  {
    label: ":set rnu", full: "set rnu", desc: "hybrid line #s",
    intents: ["relative line numbers", "hybrid line numbers", "vim style line numbers", "line numbers relative"],
  },
  {
    label: ":set nu", full: "set nu", desc: "absolute line #s",
    intents: ["show line numbers", "line numbers", "turn on line numbers", "number the lines", "absolute line numbers"],
  },
  {
    label: ":set wrap", full: "set wrap", desc: "word wrap",
    intents: ["word wrap", "wrap text", "wrap lines", "long lines wrapping", "stop lines going off screen", "line wrapping"],
  },
  {
    label: ":b", full: "b", desc: "toggle sidebar",
    intents: ["browse notes", "browse", "notes list", "show sidebar", "hide sidebar", "file list", "toggle sidebar", "see all notes"],
  },
  {
    label: ":home", full: "home", desc: "go to dashboard",
    intents: ["go home", "dashboard", "go to dashboard", "back to notes list", "main screen", "exit to home"],
  },
  {
    label: ":insp", full: "insp", desc: "toggle inspector",
    intents: ["inspector", "toggle inspector", "note info", "metadata", "details panel", "show note details"],
  },
  {
    label: ":help", full: "help", desc: "shortcuts help",
    intents: ["help", "shortcuts", "keyboard shortcuts", "how do i use vim keys", "show help", "commands list"],
  },
  {
    label: ":cheat", full: "cheat", desc: "cheatsheet",
    intents: ["cheatsheet", "cheat sheet", "quick reference", "command reference", "what commands are there"],
  },
  {
    label: ":login", full: "login", desc: "sign in",
    intents: ["login", "log in", "sign in", "sign into account", "sign in to my account"],
  },
  {
    label: ":logout", full: "logout", desc: "sign out",
    intents: ["logout", "log out", "sign out", "sign out of account", "log out of my account"],
  },
];
