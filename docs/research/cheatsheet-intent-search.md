# Cheatsheet intent search: matching plain-English intent to `:` commands

Date: 2026-09-12
Author: research pass (Claude), requested to design a curated "search by intent" box for `CheatsheetPopup.tsx` — a normal user types "browse notes" or "make it bigger" in plain words and gets back the matching `:` command(s), without full-text/fuzzy-indexing every command's literal description.

> Placement note: following the convention set by `docs/research/market-position.md` and `docs/research/theme-palette.md`, this file lives in `docs/research/`.

---

## 1. How established tools solve "search by intent, not by literal label"

The unanimous pattern across every tool checked: **keywords/synonyms are a separate, explicitly-authored field from the display label**, and matching is a cheap scoring function over the union of {label, keywords}, not a semantic/AI search.

### VS Code Command Palette

- **Primary source**: `contributes.commands` schema, per the official docs (`https://code.visualstudio.com/api/references/contribution-points#contributes.commands`) — fields are `command`, `title`, `category`, `icon`, `enablement`. **There is no `keywords`/synonym field in the command contribution point itself.** VS Code does not solve this problem at the single-command level; it relies on `category` prefixing (e.g. "Git: ...") plus its general fuzzy matcher tolerating abbreviation/substring typing against the `category: title` string. This is a useful negative finding: even VS Code's own extension authors have no first-class synonym field for a single command — confirms the premise that this is being hand-solved, not something to copy the schema of wholesale.
- **Matching algorithm** — `src/vs/base/common/fuzzyScorer.ts` (`https://github.com/microsoft/vscode/blob/main/src/vs/base/common/fuzzyScorer.ts`), the `scoreFuzzy`/`scoreFuzzy2` functions: a dynamic-programming matrix comparing query characters against the target string, requiring the query to match **in order** (not necessarily contiguous) against the target, with bonuses layered on top of a flat +1-per-matched-character base:
  - consecutive-match runs: up to 3 chars get the full bonus (6), the remainder gets half (3) — rewards contiguous runs without letting arbitrarily long runs dominate.
  - start-of-word bonus: +8.
  - after-separator bonus (`/ \ _ - .` etc.): +4–5.
  - camelCase inner-uppercase bonus: +2.
  - identical-case bonus: +1.
  This is a **character-level** subsequence scorer tuned for typing partial filenames/identifiers — appropriate for VS Code's huge, arbitrary-string command/file universe, but overkill (and the wrong shape) for a 20-item curated list where the actual gap is *vocabulary* ("browse" never appearing near `:b`), not typing speed/abbreviation.

### Raycast

- **Primary source**: Raycast's extension manifest docs (`https://developers.raycast.com/information/manifest`) — each **command** entry accepts a `keywords: string[]` field, described as extra terms "for which the extension/command can be searched," separate from `title`. This is the closest first-party analogue to what's being proposed here: a hand-authored array of synonym strings sitting next to the display title, consulted by the launcher's search independent of whether the words appear in the title.

### Alfred

- **Primary source**: Alfred's own docs (`https://www.alfredapp.com/help/workflows/inputs/keyword/`, `https://www.alfredapp.com/help/workflows/advanced/keywords/`). Alfred's mechanism is different in kind (no per-object synonym list) — instead, **a single Keyword Input field accepts multiple keywords separated by `||`** (Alfred 5.1+), e.g. `sidebar||browse||files`, all wired to the one downstream workflow object; the `alfred_workflow_keyword` environment variable tells the workflow which alias fired. This is the same *concept* (n aliases → 1 action) expressed as a delimited string on the trigger rather than an array on the action.

### cmdk (the library underlying most modern "Cmd+K" palettes, incl. the Linear/Vercel-style ones commonly cited)

- **Primary source**: `pacocoursey/cmdk` README (`https://github.com/pacocoursey/cmdk`) — `Command.Item` takes an explicit `keywords: string[]` prop "to help with filtering," documented as: *"Keywords act as aliases for the item value, and can also affect the rank of the item."* The library's own description of its default filter: it builds an extended searchable string as `value + ' ' + keywords.join(' ')` and scores that against the query. This is the most directly transferable prior art — **display value and searchable keywords are separate fields, concatenated only at match time**, exactly the shape recommended in §3.
- Linear's and Slack's own command-menu implementations are closed-source; no public schema/doc surfaced describing their internal synonym tagging (Slack's own developer docs cover *building* a Slack command, not Slack's own internal palette's keyword table). Not claiming more than that gap.

### Vim's own help-tag system

- **Primary source**: Vim's help-authoring convention (`:h help-writing`, mirrored at `https://vimhelp.org/helphelp.txt.html`) — a help tag is any string between asterisks, `*tag-name*`, and **multiple tags can be stacked on the same line**, each an independent anchor to the identical location. The canonical example is every Vim option's own doc heading, e.g. `options.txt`'s entry for line numbers carries **both** `*'number'* *'nu'*` on one line — so `:h nu` and `:h number` both land on the exact same paragraph. This is a pure "N labels, 1 destination" model with no scoring at all: an exact-tag lookup either hits one of the stacked tags or falls through to `:helpgrep` (a literal/regex grep across all help text, the "last resort" path Vim itself treats as inferior to a tag hit). Directly analogous to: `:b`'s entry should carry tags/keywords `nu`, `number`... i.e. `browse`, `sidebar`, `notes list`, etc., all pointing at the one `:b` chip, with no requirement that "browse" appear in `:b`'s prose description.

### Takeaway

Every real precedent stores keywords as **a separate, explicit, small array field**, never derives them from the label/description text. None of them do semantic/embedding search for this; VS Code's fuzzy character-scorer is the one outlier, and it exists to solve a different problem (typing speed against an enormous, uncurated identifier space) than the one here (~20 curated commands, vocabulary gap). This justifies going with a hand-written `keywords`-style array (§3) scored by simple token overlap (§2), not adopting VS Code's scorer or adding a fuzzy-matching dependency.

---

## 2. Matching algorithm: normalized token-overlap (Dice coefficient), with a character-bigram fallback for near-misses

**Recommendation: Sørensen–Dice coefficient over normalized word tokens, computed per intent phrase, with a lightweight bigram-Dice fallback per unmatched token to absorb typos/plurals.** This needs no dependency, is O(commands × phrases × tokens) which is trivially fast at this scale (~20 commands × ~7 phrases × ~2 tokens), and — unlike a raw substring or Jaccard-only check — properly rewards a query that shares *most* of its words with a short intent phrase over one that shares only one word out of many.

### Why Dice over the alternatives

- **Plain substring/`includes()` match**: fails the exact motivating case — "browse" is not a substring of any existing description, so this does nothing without the keyword array anyway; even with the array, a substring check gives one bit of information (yes/no) per phrase and no way to rank "show sidebar" (2/2 words match "show sidebar") above "sidebar settings panel" (1/4 words match) if both happen to contain the query word.
- **Full Levenshtein string-distance on whole phrases**: wrong unit — it penalizes word *order* and length differences between short queries ("browse") and longer phrases ("show sidebar") that have nothing to do with actual similarity of *meaning*; not what's needed for multi-word phrase vs. short query.
- **Jaccard index** (`|A∩B| / |A∪B|`) is close, but Dice (`2|A∩B| / (|A|+|B|)`) weights shared tokens more heavily and is the standard choice specifically for short strings/phrases (it's what the well-known `string-similarity`/`fastest-levenshtein`-adjacent literature and search engines use for short-text token overlap) — with a 1-2 word query against 1-3 word phrases, Dice's denominator behaves better than Jaccard's at these small set sizes (a single shared token out of {1,2} scores 0.67 under Dice vs. 0.5 under Jaccard, which better matches human intuition that "1 of 2 words matched" is a strong signal, not a coin flip).
- **Character-level fuzzy scoring (VS Code's approach)**: right idea, wrong grain — it's built to reward typing prefixes/abbreviations of a single long identifier, not overlap between two independently-worded short phrases.

### The algorithm, in full

```
normalize(s):
  lowercase, strip punctuation (keep letters/digits/spaces), collapse whitespace,
  split on spaces -> string[] tokens

diceTokenScore(queryTokens, phraseTokens):
  if either is empty -> 0
  matched = 0
  for qt in queryTokens:
    if phraseTokens has an exact token equal to qt: matched += 1
    else:
      # fallback: best bigram-Dice against any phrase token, for typos/plurals
      # e.g. "sidebars" vs "sidebar", "shairing" vs "sharing"
      best = max over pt in phraseTokens of bigramDice(qt, pt)
      if best >= 0.6: matched += 0.7   # partial credit, never full credit
  return (2 * matched) / (queryTokens.length + phraseTokens.length)

bigramDice(a, b):
  bigrams(x) = set of all 2-char substrings of x (pad short words as-is)
  A = bigrams(a), B = bigrams(b)
  if A and B both empty -> a === b ? 1 : 0
  return (2 * |A ∩ B (multiset-aware or set-aware is fine at this scale)|) / (|A| + |B|)
```

This is ~25-30 lines of TypeScript, zero dependencies, and every step is a plain array/set operation.

### Exact function signature

```ts
export type CommandIntentMatch = {
  entry: CommandIntentEntry;   // see §Spec — extends CommandChip
  score: number;               // 0..1, highest-scoring phrase for this command
  matchedPhrase: string;       // which intent phrase (or the desc) produced that score
};

/**
 * Scores every command in `table` against `query` and returns matches above
 * `minScore`, highest score first. Pure function, no I/O, safe to call on
 * every keystroke (debounce is a UI concern, not this function's).
 */
export function searchCommandIntents(
  query: string,
  table: CommandIntentEntry[] = COMMAND_INTENTS,
  opts?: { minScore?: number; limit?: number },
): CommandIntentMatch[];
```

- **Per-command score** = the max Dice score over: every string in that command's `intents[]`, its `desc`, and its `label`/`full` (so literal matches — someone typing "pin" for `:pin` — still work without needing "pin" duplicated into the intents array).
- **`minScore` default: `0.35`.** Chosen so a single strong token match on a 2-word phrase clears the bar (`1 match / (1+2)` tokens = 0.4 for a 1-word query against a 2-word phrase) while a single weak/partial (bigram-fallback) token match on a longer phrase does not (`0.7 match / (1+4)` = 0.14). This is the one genuinely arbitrary constant in this spec — tune it against the seed list in §4 if real usage shows false positives/negatives; there is no principled derivation for the exact cutoff, only that it must sit between those two computed examples.
- **`limit` default: `5`** — cheatsheet search is a narrow list, not a ranked SERP; showing more than a handful defeats the "quick reference while still typing" purpose already described in `CheatsheetPopup.tsx`'s own doc comment.

### Tie-breaking

When two commands score equal:
1. **Prefer the command whose winning phrase is shorter (fewer tokens)** — a tie against a 1-word phrase is more specific/confident than the same numeric tie against a 4-word phrase (mirrors how a Dice score of 0.67 from "1 of 2" is a stronger signal than an equal-looking score manufactured from a longer, partially-fuzzy match).
2. **Then prefer the command whose winning phrase came from `intents[]` over one that came from `desc`/`label`** — an explicit curated synonym is a stronger authorial signal than an incidental description-word hit.
3. **Then preserve original `COMMAND_CHIPS` array order** (stable sort) — deterministic, and keeps the more "core"/frequently-used commands (which the array already lists first: `:w`, `:wq`, `:q`... before `:login`/`:logout`) winning ties, which is a reasonable prior with no other signal to break on.

---

## 3. RbNotes' real command set (from `command-dispatch.ts` and `CommandDock.tsx`, not invented)

Confirmed by reading both files directly:

- `COMMAND_CHIPS` in `src/components/buffer/CommandDock.tsx` (lines 15-36) is the canonical, de-duplicated chip list — 20 entries, each `{ label, full, desc, danger? }`.
- Cross-checked against the `switch (bareName)` in `dispatchCommand` (`src/components/editor/command-dispatch.ts` lines 110-201): every `case` there (`w`/`write`, `q`/`quit`, `wq`/`x`, `new`, `rename`, `delete`, `pin`, `help`, `cheat`, `pins`, `insp`, `b`, `home`, `share`, `unshare`, `login`, `logout`, `set` with its sub-options `nu`/`nonu`/`rnu`/`nornu`/`wrap`/`nowrap`/`ts=N`) is represented by exactly one `COMMAND_CHIPS` row (the three `:set ...` chips collapse several real sub-options into the 3 chips users are actually shown). No chip references a command `dispatchCommand` doesn't handle, and no handled command is missing a chip. **20 commands confirmed — matches the "~20-command list" scope.**

No commands were invented; `:pins`, `:insp`, `:home`, `:unshare`, `:login`/`:logout` are all real, current entries in `COMMAND_CHIPS`, not hypothetical.

---

## Spec (implementable as-is)

### Data shape

Add a new file, e.g. `src/components/overlay/command-intents.ts`:

```ts
import type { CommandChip } from "@/components/buffer/CommandDock";
// CommandChip is currently NOT exported from CommandDock.tsx (it's a local
// type) -- add `export` to that one type declaration (line 6) so this file
// can extend rather than redeclare it. This is the one small upstream edit
// the implementer needs to make; nothing else in CommandDock.tsx changes.

export type CommandIntentEntry = CommandChip & {
  /**
   * Curated synonyms/phrases a non-power-user might type, in plain words --
   * NOT vim jargon, NOT a restatement of `desc`. 5-10 entries each. This is
   * the only thing this feature hand-authors; everything else is inherited
   * from CommandChip (label/full/desc/danger).
   */
  intents: string[];
};

export const COMMAND_INTENTS: CommandIntentEntry[] = [ /* see full seed list below */ ];
```

Keying strategy: `full` (e.g. `"w"`, `"set wrap"`) is already the unique identifier CommandDock and command-dispatch agree on (it's literally what gets submitted to `dispatchCommand`) — `COMMAND_INTENTS` entries key off `full`, not a new id field, so there is exactly one source of truth for "which command is this" across dock, dispatch, and intent search.

### Matching function

Signature, scoring, and tie-breaking exactly as specified in §2 above (`searchCommandIntents(query, table?, opts?)` → `CommandIntentMatch[]`). Put it in the same `command-intents.ts` file, as a pure function with no React/DOM dependency, so it's unit-testable in isolation (this is the function the TDD pass should write tests against first: normalize(), bigramDice(), diceTokenScore(), then searchCommandIntents(), in that order, bottom-up).

### Where it goes in `CheatsheetPopup.tsx`

Current structure (read directly, lines 1-58): a Radix `Dialog.Content` with (1) a header row (`# cheatsheet.md` title + close button, `border-b border-outline-variant`), then (2) a scrollable body (`flex-1 min-h-0 overflow-y-auto p-space-4 flex flex-col gap-space-4`) that maps `SECTIONS` into titled blocks of key/desc rows.

**Insertion point: a new sticky search input between the header and the scrollable body**, i.e. immediately after the closing `</div>` of the header row (currently line 33) and before the `<div className="flex-1 min-h-0 overflow-y-auto ...">` (currently line 34). Concretely:

```tsx
<div className="px-space-4 py-space-2 border-b border-outline-variant shrink-0">
  <input
    type="text"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    placeholder="What do you want to do? (e.g. \"browse notes\", \"save\")"
    className="w-full bg-surface-container px-space-2 py-1 text-label-md font-label-md text-on-surface placeholder:text-on-surface-variant/60 outline-none border-none"
    autoFocus
  />
  {query.trim() && (
    <div className="mt-space-2 flex flex-col gap-space-1">
      {searchCommandIntents(query).map(({ entry }) => (
        <div
          key={entry.full}
          className="flex items-center justify-between bg-surface-container px-space-2 py-space-1 gap-space-2 text-label-sm font-label-sm"
        >
          <span className="text-primary font-semibold shrink-0">{entry.label}</span>
          <span className="text-on-surface-variant text-right">{entry.desc}</span>
        </div>
      ))}
      {searchCommandIntents(query).length === 0 && (
        <div className="text-on-surface-variant/60 text-label-sm font-label-sm px-space-2 py-1">
          No matching command
        </div>
      )}
    </div>
  )}
</div>
```

- `query`/`setQuery` is local `useState("")` inside `CheatsheetPopup` (reset via the existing `Dialog.Root open={open}` — add a `useEffect` keyed on `open` that clears it on close, matching the reset-on-open pattern `CommandDock.tsx` already uses at lines 78-98).
- Result rows reuse the **exact same visual style** as the existing key/desc rows in the `SECTIONS` map (line 42-49: `flex items-center justify-between bg-surface-container px-space-2 py-space-1 gap-space-2 text-label-sm font-label-sm`, `text-primary font-semibold` for the key, `text-on-surface-variant text-right` for the desc) — no new visual language introduced.
- When `query` is non-empty, consider also dimming/hiding the `SECTIONS` list below it (optional polish, not required for correctness) so the popup reads as "search results replace the browse view while typing" rather than showing both at once — leaving this as the implementer's call since it's a UX nicety, not a data/matching decision.
- No new dependency: plain `<input>`, existing Tailwind utility classes, the hand-rolled matcher from §2.

### Full seeded intent-slug list (paste-ready)

```ts
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
```

### Decisions the implementer should not re-litigate

- `minScore = 0.35`, `limit = 5` are seeded defaults, not derived constants — tune only against observed false positives/negatives in tests, not by re-deriving from first principles.
- `CommandChip` needs one `export` keyword added in `CommandDock.tsx`; that is the only change to existing files this spec requires. `command-intents.ts` is additive.
- No fuzzy-matching/search dependency is to be added; `normalize`/`bigramDice`/`diceTokenScore`/`searchCommandIntents` are the complete implementation surface, written by hand per §2.
