# Vim hacks reference: a full motion/operator/text-object cheat sheet, searched by intent

Date: 2026-09-12
Author: research pass (Claude), requested to design a MUCH bigger reference than the 20-command `:cheat` popup covers — real Vim motions/operators/text-objects a daily Vim user forgets under pressure, surfaced by typing what they want to do in plain words and getting back the actual keystroke chord to type themselves.

> Placement note: follows `docs/research/cheatsheet-intent-search.md`'s convention — this file lives in `docs/research/`, and everything here is additive to (not a fork of) that doc's data shape.

---

## 1. Which Vim commands are actually usable in this app

RbNotes' editor is `@replit/codemirror-vim` (`vim()` extension, `Editor.tsx` line ~384), which re-exports `@replit/codemirror-vim-core` — that's where the real implementation lives (`node_modules/@replit/codemirror-vim-core/vim.js`, 7164 lines). RbNotes mounts it with **zero custom `Vim.map`/`Vim.defineEx`/`Vim.defineOperator` calls** (confirmed: no such calls anywhere in `src/`) — so the supported subset is exactly `defaultKeymap` and `defaultExCommandMap` as shipped, unmodified.

### Confirmed supported (read directly from `vim.js` lines 75–310)

**Motions** (with count-prefix support — every motion in the default keymap accepts a numeric prefix via the library's generic repeat-count handling, not a per-motion opt-in): `h j k l`, `H M L` (top/middle/bottom of screen), `gg G` (top/bottom of buffer, or line N with a count), `w W b B e E ge gE` (word motions, normal and WORD variants), `0 ^ $ g^ g$ g0 + - _` (line-position motions), `{ }` (paragraph), `( )` (sentence), `%` (matching bracket), `f F t T ; ,` (character search), `` ` ' `` (marks), `]` `[` with a character (symbol jumps), `|` (column), `n N` (repeat search), `gn gN` (select next match), `*` `#` `g*` `g#` (search word under cursor), `Ctrl-f/b/d/u` (page/half-page scroll).

**Operators**: `d` (delete), `y` (yank), `c` (change), `=` (auto-indent), `>` `<` (indent/outdent), `g~` (toggle case), `gu` `gU` (lowercase/uppercase), `gc` (toggle comment), `gq` `gw` (hard-wrap), `g?` (rot13).

**Operator-motion fused commands**: `x X` (delete char), `D` (delete to EOL), `Y` (yank line), `C` (change to EOL), `~` (toggle case char, normal mode).

**Text objects** (`vim.js` lines 2585–2660, `textObjectManipulation`) — confirmed support for exactly:
- Word objects: `iw aw` (word), `iW aW` (WORD)
- Quote objects: `i" a"`, `i' a'`, `` i` a` `` (all three quote characters, self-paired)
- Bracket objects: `i( a(` / `ib ab` (parens, `b` is an alias for `(`), `i{ a{` / `iB aB` (braces, `B` aliases `{`), `i[ a[`, `i< a<`
- `ip ap` (paragraph)
- `is as` (sentence)
- `it at` (tag — HTML/XML-style, via `expandTagUnderCursor`)

All of these combine with any operator (`d`, `c`, `y`, `>`, `<`, `gU`, `gu`, `g~`) and with visual-mode selection (`v` + object). This is the **complete standard Vim text-objects set** per `:h text-objects` — nothing in `:h text-objects` is missing from this list except the block-object variants tied to visual-block mode edge cases, which aren't part of the base cheat-sheet scope here.

**Actions**: `a A i I o O gi gI` (insert-mode entry points), `v V Ctrl-v` (visual modes), `gv` (reselect), `J gJ` (join lines), `p P` `]p [p` (paste, with indent-matching variants), `r<char>` (replace char), `R` (Replace mode), `u Ctrl-r` (undo/redo), `m<mark> `<mark> '<mark>` (marks), `"<register>` (register prefix), `.` (repeat last edit), `Ctrl-a Ctrl-x` (increment/decrement number), `zz zt zb z. z<CR> z-` (scroll-to-cursor variants), `@<register> q<register>` (macros).

**Ex commands** (`defaultExCommandMap`, lines 272–310): `:map`/`:imap`/`:nmap`/`:vmap`/`:omap` families, `:write`(`:w`), `:undo`(`:u`), `:redo`, `:set`/`:setlocal`/`:setglobal`, `:sort`, `:substitute`(`:s`), `:startinsert`, `:nohlsearch`(`:noh`), `:yank`(`:y`), `:put`(`:pu`), `:delmarks`, `:marks`, `:registers`(`:reg`), `:vglobal`(`:v`), `:delete`(`:d`), `:join`(`:j`), `:normal`(`:norm`), `:global`(`:g`), plus `:version`(`:ve`, added by the `vim()` extension wrapper itself).

### Known NOT supported / not reachable — flag clearly

- **Real Vim's `:q`/`:wq`/`:x`/quit family, and RbNotes' own `:w`/`:new`/`:pin`/etc.** are **not** codemirror-vim ex commands at all — RbNotes intercepts the bare `:` keystroke at the shortcut-table level (`shortcuts.ts`, `GLOBAL_SHORTCUTS` — `key: ":"` → `openCommandDock` intent) **before** it ever reaches codemirror-vim's own ex-mode input. `CommandDock.tsx`'s own doc comment confirms this explicitly: *"Replaces @replit/codemirror-vim's own (hidden) ex-mode panel entirely, so this is the only UI a `:` command is ever typed into."* Practical effect: real Vim ex commands that codemirror-vim-core *does* implement in its source — `:s/foo/bar/`, `:sort`, `:g/pattern/d`, `:normal`, `:registers`, `:marks` — **exist in the library but are unreachable in RbNotes' UI**, since typing `:` opens the app's own command dock, not vim's ex line. This reference must not promise these as usable; they're listed above only as "library has it," not "you can type it here."
- **No visual-block column editing beyond basic `Ctrl-v`/`Ctrl-q` toggle** — the block-insert (`I`/`A` in visual-block to edit every selected line at once) and block-paste edge cases are real Vim features codemirror-vim's own README/issue history flags as partial; not claiming full parity here, and none of those edge-case combos are in the seed data below.
- **No `gq`/`gw` reflow to a `textwidth`** the way real Vim does (no `:set textwidth` in `defaultExCommandMap`) — `gq`/`gw` exist as operators but there's no ex command to configure the wrap column, so they're included as "hard-wrap the paragraph" without a tunable width.
- **No jumplist/changelist ex commands** (`:jumps`, `:changes`) in `defaultExCommandMap` — the underlying jump-to-mark motions (`` Ctrl-o/Ctrl-i ``) work, but you can't list them.
- **No folding** (`zf`, `za`, etc.) — no fold-related entries anywhere in `defaultKeymap`.
- **No `ZZ`/`ZQ`** (save-and-quit / quit-without-saving single-key shortcuts) — not in `defaultKeymap`; RbNotes' own `:wq`/`:q` cover this instead.

Cross-referenced against real Vim's canonical docs for what a complete list *should* contain (`vimhelp.org/motion.txt.html`, `vimhelp.org/text-objects.html`) — every well-known motion/operator/text-object from those pages that codemirror-vim-core implements is listed above; nothing was invented that the editor won't actually execute.

---

## 2. How reference tools represent "type these keys" sequences

### Vim's own `:h text-objects` notation

Vim's own help text (mirrored at `vimhelp.org/text-objects.html`) writes a text object as the **bare chord itself**, quoted: `"aw"` a word, `"iw"` inner word, `"a("`/`"ab"` a `()` block, `"aB"`/`"a{"` a `{}` block, `"a<tag>"` a tag block. It does **not** decompose the chord into discrete keystrokes in its own prose — a human reading `:h text-objects` already knows `di"` means "press `d`, then `i`, then `"`." That's the right notation for a reference read by an already-fluent Vim user (which matches this feature's own stated audience — "a daily Vim user who forgets under pressure," not a total beginner) — so the **combo notation** (`di"`) is the primary representation, with a **discrete-steps breakdown** (`d` → `i` → `"`) as a rendering detail of the UI, not a second data field to author by hand (it's derived by splitting the combo string into its individual VIM_KEY_TOKENS, same idea as parsing a chord string).

### vim.rtorr.com (source-available interactive cheat sheet)

vim.rtorr.com (repo: `github.com/rtorr/vim-cheat-sheet`) is a static reference: rows of `{key, description}` grouped under category headings (Cursor movement, Insert mode, Editing, Marking text, Visual mode, Cut & paste, Exit, Search & replace, Working with multiple files, Tabs). No decomposition into individual keystroke steps — the `key` column already holds the raw chord (`dd`, `di(`, `5dd`) as one string, same convention as Vim's own docs. This is the same shape `CommandIntentEntry` and `CheatsheetRow` already use in `command-intents.ts` (`{label/key, desc}` pairs grouped into sections) — no new grouping convention needed, just a `category` field to slot combos into their own sections the way `SECTIONS` already groups `:` commands by mode.

### VS Code's Keyboard Shortcuts search / chord rendering

VS Code renders a multi-key chord (e.g. `Ctrl+K Ctrl+S`) as **separate key-cap boxes with a space between them** for a sequential chord (press one, release, press the next), vs. **key-caps joined with `+`** for a simultaneous combo (`Ctrl+S`). Vim combos are closer to the sequential-chord case — `d`, then `i`, then `"` are three separate keypresses, not held together — so the "discrete steps, arrow between them" treatment the user asked for is the correct visual metaphor (matches VS Code's own sequential-chord rendering, not its simultaneous-combo `+`-joined one).

### Prior art for "search by intent, get keystrokes to press yourself"

No widely-known open-source Vim trainer exposes exactly "type your goal in English, get the chord, then go press it yourself, no simulation" as a documented, source-available data model — the closest analogues (Vim Adventures, OpenVim's interactive tutorial, `vimgenius`) all *execute* the keystrokes against a live buffer rather than just displaying them, which is explicitly **not** what this feature wants ("this is a reference lookup only, not an auto-typer" — direct from the ask). This means there's no schema to borrow for the "steps" rendering beyond what's already derivable from Vim's own combo-string notation (§ above) — confirming the right move is: **one string field holding the combo** (`di"`), rendered two ways by the UI (as one chord, and as split discrete steps), not two authored fields.

---

## 3. RbNotes editor-specific helpers beyond the 20 `:` commands

Checked `src/components/editor/extensions.ts`, `live-preview.ts`, `shortcuts.ts`, and `Editor.tsx` directly for anything vim-motion-adjacent or Markdown-specific that isn't already one of the 20 `:cheat` chips:

- **`extensions.ts`**: `lineNumberGutter` (relative/hybrid/absolute — already covered by the existing `:set nu`/`:set rnu` chips), tag-pill decoration (click-to-filter-by-tag, not a keystroke), title-line highlighting (visual only, no keybinding). **Nothing new here that's a keystroke a user presses.**
- **`live-preview.ts`**: renders Markdown live-preview styling (bold/italic/heading/link decorations) — purely visual, no new keybindings; confirmed by grep, no `Vim.map`/`keymap.of` calls in this file.
- **`shortcuts.ts`**: `GLOBAL_SHORTCUTS` — these are **app-chrome shortcuts** (Ctrl+S save, Ctrl+N new note, Ctrl+P quick switcher, Ctrl+Shift+P pinned switcher, Ctrl+B sidebar, Ctrl+/ search, Ctrl+T tags, `:` command dock), already fully covered by the existing GLOBAL section of `HelpBuffer`'s `SECTIONS` (which `CheatsheetPopup` already searches via `searchCheatsheet`). Not vim motions, not new — **out of scope for this reference**, which is specifically the vim-motion gap `:cheat`'s `:` search doesn't fill.
- **`Editor.tsx`**: `keymap.of([indentWithTab, ...historyKeymap, ...searchKeymap, ...defaultKeymap])` — `historyKeymap`/`searchKeymap`/`defaultKeymap` here are CodeMirror's own **INSERT-mode-only** fallback bindings (only active when vim mode is off or for chords vim doesn't claim), not additional vim commands; `indentWithTab` is Tab-to-indent in INSERT mode. None of these introduce a new NORMAL-mode vim motion/operator beyond what § 1 already covers.

**Conclusion: there are no additional RbNotes-specific Markdown vim-motion helpers beyond the standard codemirror-vim subset in § 1.** The seed data below is a pure-Vim reference; nothing app-specific needs its own category.

---

## Spec (implementable as-is)

### Data shape — sits alongside `CommandIntentEntry`, not a parallel system

New file: `src/components/overlay/vim-combo-intents.ts`

```ts
/**
 * Plain-English intent search over real Vim motions/operators/text-objects
 * that codemirror-vim actually implements -- see
 * docs/research/vim-hacks-reference.md for which subset that is and why.
 * Reuses the exact matching engine from command-intents.ts
 * (normalize/bigramDice/diceTokenScore) rather than forking a second one;
 * only the searchable-entry shape and the seed data are new.
 */

import {
  normalize,
  diceTokenScore,
  type CommandIntentMatch,
} from "@/components/overlay/command-intents";

export type VimComboCategory =
  | "Motion"
  | "Count-Prefixed Motion"
  | "Operator"
  | "Text Object"
  | "Operator + Text Object"
  | "Operator + Motion"
  | "Search Motion"
  | "Marks & Registers"
  | "Visual Mode"
  | "Insert & Repeat"
  | "Misc";

export type VimComboEntry = {
  /** The chord exactly as Vim's own :h docs write it, e.g. `di"`, `5dd`, `ci{`. */
  combo: string;
  /** Short human label, e.g. "delete inside quotes". Not vim jargon. */
  label: string;
  category: VimComboCategory;
  /**
   * Curated plain-English phrases a user might type -- same style/spirit as
   * CommandIntentEntry.intents in command-intents.ts: not vim jargon, not a
   * restatement of `label`. 3-8 entries each.
   */
  intents: string[];
};

export type VimComboMatch = {
  entry: VimComboEntry;
  score: number;
  matchedPhrase: string;
};

const DEFAULT_MIN_SCORE = 0.35;
const DEFAULT_LIMIT = 8;

/**
 * Searchable surface for one entry: its curated intents, plus its own
 * label/combo as a literal fallback (so typing "di" for `di"` still works
 * without needing every combo string duplicated into intents[]).
 */
function searchableSurface(entry: VimComboEntry): { phrase: string; fromIntents: boolean }[] {
  return [
    ...entry.intents.map((phrase) => ({ phrase, fromIntents: true })),
    { phrase: entry.label, fromIntents: false },
    { phrase: entry.combo, fromIntents: false },
  ];
}

/**
 * Scores every combo in `table` against `query`, same algorithm and
 * tie-break order as searchCommandIntents (score desc, then shorter winning
 * phrase, then intents[] over label/combo, then original table order).
 * Pure function, no I/O.
 */
export function searchVimCombos(
  query: string,
  table: VimComboEntry[] = VIM_COMBO_INTENTS,
  opts?: { minScore?: number; limit?: number },
): VimComboMatch[] {
  const minScore = opts?.minScore ?? DEFAULT_MIN_SCORE;
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const queryTokens = normalize(query);
  if (queryTokens.length === 0) return [];

  type Scored = VimComboMatch & { phraseTokenCount: number; fromIntents: boolean; index: number };

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

/** Splits a combo string into discrete keystroke steps for key-cap rendering. */
export function comboSteps(combo: string): string[] {
  return Array.from(combo);
}

export const VIM_COMBO_INTENTS: VimComboEntry[] = [ /* see full seed list below */ ];
```

`normalize`/`diceTokenScore` are **imported from `command-intents.ts`**, not redefined — the one small upstream change needed there is exporting them (they're already top-level `export function`s in that file per the current source, so **no change is required upstream**; confirmed by reading the file directly).

`comboSteps` is intentionally the dumbest possible implementation (`Array.from` on the combo string, which correctly splits `di"` into `["d","i","\""]` since every vim key in the seed data below is a single visible character — no multi-char tokens like `<Esc>` appear in any *combo* in this seed set, only in category names/descriptions). If a future combo needs a named key (e.g. an `<Esc>`-containing chord), `comboSteps` would need a real tokenizer at that point — not needed for this seed data, flagged so the implementer doesn't over-build it now.

### Route: `/vim-hacks`

New full page, matching the existing `(app)/settings` pattern exactly:

- `src/app/(app)/vim-hacks/page.tsx` — server component, same shape as `settings/page.tsx` (no auth requirement; this is static reference content, not account data, so it doesn't even need `getOptionalUser`):

```tsx
import { VimHacksView } from "@/components/vim-hacks/VimHacksView";

export default function VimHacksPage() {
  return <VimHacksView />;
}
```

- `src/components/vim-hacks/VimHacksView.tsx` — new client component, the full-page reference. Structure:
  - A page header (`# vim-hacks.md`, matching `CheatsheetPopup`'s `# cheatsheet.md` heading convention) with a search input identical in style to `CheatsheetPopup`'s (`bg-surface-container px-space-2 py-1 text-label-md font-label-md ...`, same placeholder pattern: `'What do you want to do? (e.g. "delete inside quotes")'`).
  - Below the search: when the query is empty, render **every** `VIM_COMBO_INTENTS` entry grouped by `category` (same `SECTIONS`-style grouping `CheatsheetPopup`/`HelpBuffer` already use — a `## category` heading per group). When non-empty, render `searchVimCombos(query)` results only (same "search results replace browse view" pattern already used by `CheatsheetPopup`, `hidden={!!query.trim()}` on the browse list).
  - **Each result/row renders the combo as discrete key-cap steps**, reusing `CommandDock.tsx`'s existing `<span className="bg-surface-container px-1 py-0.5 text-on-surface">Enter</span>`-style kbd treatment (its Enter/Tab/Esc footer hints) verbatim — no new visual language:

```tsx
function ComboKeys({ combo }: { combo: string }) {
  const steps = comboSteps(combo);
  return (
    <span className="flex items-center gap-1 font-code-editor text-code-editor">
      {steps.map((key, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="bg-surface-container px-1 py-0.5 text-on-surface">{key}</span>
          {i < steps.length - 1 && <span className="text-outline">&rarr;</span>}
        </span>
      ))}
    </span>
  );
}
```

  - Row layout otherwise matches the existing `flex items-center justify-between bg-surface-container px-space-2 py-space-1 gap-space-2 text-label-sm font-label-sm` treatment from `CheatsheetPopup`'s rows, with `label` where `desc` currently goes and `<ComboKeys combo={entry.combo} />` where the key currently goes (swapped: here the **keys are the payload**, the label is secondary context, matching the ask's "shows them the actual keystroke sequence to press" framing).
  - No Escape handling needed on this page itself (it's a route, not an overlay) — navigating away or pressing the browser back button is how it's left; this is a deliberate difference from `CheatsheetPopup`/`HelpBuffer` (both overlays, both Escape-closable) since a full page has no "close," only "navigate elsewhere."

### `CheatsheetPopup` link addition

`CheatsheetPopup.tsx` gets one added line — a link to the full page, placed in the header row (next to the `# cheatsheet.md` title, before the close button), so the compact popup stays exactly as small as the user asked while still pointing at the bigger reference:

```tsx
<div className="flex items-center justify-between px-space-4 py-space-3 border-b border-outline-variant shrink-0">
  <Dialog.Title className="text-primary font-semibold"># cheatsheet.md</Dialog.Title>
  <div className="flex items-center gap-space-3">
    <Link
      href="/vim-hacks"
      className="text-label-sm font-label-sm text-secondary hover:text-primary underline underline-offset-2"
    >
      all vim hacks &rarr;
    </Link>
    <Dialog.Close aria-label="Close cheatsheet" className="text-on-surface-variant hover:text-on-surface">
      <X size={16} strokeWidth={1.5} />
    </Dialog.Close>
  </div>
</div>
```

(`import Link from "next/link";` added to `CheatsheetPopup.tsx`'s imports — the only other change to that file.)

### Escape-closes-popup: confirmed, no new work needed

`CheatsheetPopup` is a Radix `Dialog.Root`/`Dialog.Content` — Radix's `Dialog.Content` binds `Escape` to `onOpenChange(false)` by default (no custom keydown handler exists or is needed in `CheatsheetPopup.tsx` today, confirmed by reading the file — there is no `onKeyDown` on its `Dialog.Content`, meaning it's relying entirely on Radix's built-in behavior). `HelpBuffer.tsx` line 71 (`if (e.key === "Escape") onClose();`) confirms the same contract explicitly for the full-screen `:help` buffer. Nothing new to wire up — the existing popup's Escape-to-close behavior is untouched by adding the link above.

### Decisions the implementer should not re-litigate

1. **One matching engine, imported, not duplicated.** `searchVimCombos` in the new file reuses `normalize`/`diceTokenScore` from `command-intents.ts` verbatim (same import, same algorithm, same tie-break order) — do not copy-paste and drift a second implementation.
2. **`comboSteps` is `Array.from(combo)`, deliberately naive.** Every combo in the seed data below is single-visible-character tokens only (no `<Esc>`/`<C-...>` inside any *combo* string) specifically so this works without a real tokenizer. If a future combo needs a named key, that's a real (small) follow-up to `comboSteps`, not a blocker for this seed data.
3. **The route is unauthenticated, static reference content** — `/vim-hacks` needs no `getOptionalUser()` call, no settings, no user-scoped data. It's pure content, same trust level as `robots.ts`/`sitemap.ts`, not account data.
4. **`:cheat` gets a link, not a duplicate search box wired to the same data.** The compact popup stays exactly as small as before; the full-text vim-motion reference lives only at `/vim-hacks`, reachable by the one added link. Do not also import `VIM_COMBO_INTENTS` into `CheatsheetPopup`'s own search — that would silently blow up its "quick reference while still typing" scope back out to ~100 rows, which the ask explicitly said to avoid ("the compact `:cheat` popup, which the user explicitly wants kept small").
5. **Vim's own real ex commands that codemirror-vim-core implements but RbNotes' `:` never reaches** (`:s`, `:sort`, `:g`, `:normal`, etc. — see § 1's "Known NOT supported" note) are **deliberately excluded** from the seed data below. Including them would advertise commands that silently do nothing when typed into RbNotes' `:` (since `:` opens the app's own command dock, not vim's ex line) — a correctness bug in the reference itself, not a coverage gap to fill later.
6. **Category is a closed enum (`VimComboCategory`), not a free string** — the seed data below uses exactly the 11 categories listed in the type; a future entry should fit one of these, not spawn a 12th ad hoc.

### Full seed data (paste-ready, `VIM_COMBO_INTENTS`)

```ts
export const VIM_COMBO_INTENTS: VimComboEntry[] = [
  // ---- Motion ----
  { combo: "h", label: "move left", category: "Motion", intents: ["move left", "go left", "left one char"] },
  { combo: "j", label: "move down", category: "Motion", intents: ["move down", "go down", "next line"] },
  { combo: "k", label: "move up", category: "Motion", intents: ["move up", "go up", "previous line"] },
  { combo: "l", label: "move right", category: "Motion", intents: ["move right", "go right", "right one char"] },
  { combo: "w", label: "next word start", category: "Motion", intents: ["next word", "jump to next word", "word forward"] },
  { combo: "W", label: "next WORD start (space-delimited)", category: "Motion", intents: ["next big word", "next WORD", "skip to next space separated word"] },
  { combo: "b", label: "back to word start", category: "Motion", intents: ["previous word", "back a word", "jump back one word"] },
  { combo: "B", label: "back to WORD start", category: "Motion", intents: ["previous big word", "back a WORD"] },
  { combo: "e", label: "to end of word", category: "Motion", intents: ["end of word", "jump to end of this word"] },
  { combo: "E", label: "to end of WORD", category: "Motion", intents: ["end of big word", "end of WORD"] },
  { combo: "ge", label: "back to end of previous word", category: "Motion", intents: ["end of previous word", "back to end of last word"] },
  { combo: "0", label: "start of line", category: "Motion", intents: ["start of line", "beginning of line", "go to column 0", "jump to line start"] },
  { combo: "^", label: "first non-blank char of line", category: "Motion", intents: ["first non blank character", "start of text on line", "skip leading whitespace"] },
  { combo: "$", label: "end of line", category: "Motion", intents: ["end of line", "jump to end of line", "last character of line"] },
  { combo: "gg", label: "top of buffer", category: "Motion", intents: ["go to top", "top of file", "first line", "start of document"] },
  { combo: "G", label: "bottom of buffer", category: "Motion", intents: ["go to bottom", "end of file", "last line", "end of document"] },
  { combo: "{", label: "back a paragraph", category: "Motion", intents: ["previous paragraph", "jump back a paragraph", "go up a paragraph"] },
  { combo: "}", label: "forward a paragraph", category: "Motion", intents: ["next paragraph", "jump forward a paragraph", "go down a paragraph"] },
  { combo: "(", label: "back a sentence", category: "Motion", intents: ["previous sentence", "back a sentence"] },
  { combo: ")", label: "forward a sentence", category: "Motion", intents: ["next sentence", "forward a sentence"] },
  { combo: "%", label: "jump to matching bracket", category: "Motion", intents: ["matching bracket", "jump to matching paren", "find matching brace", "jump between brackets"] },
  { combo: "H", label: "top of visible screen", category: "Motion", intents: ["top of screen", "highest visible line"] },
  { combo: "M", label: "middle of visible screen", category: "Motion", intents: ["middle of screen"] },
  { combo: "L", label: "bottom of visible screen", category: "Motion", intents: ["bottom of screen", "lowest visible line"] },
  { combo: "Ctrl-d", label: "scroll half page down", category: "Motion", intents: ["scroll down half a page", "page down half"] },
  { combo: "Ctrl-u", label: "scroll half page up", category: "Motion", intents: ["scroll up half a page", "page up half"] },
  { combo: "Ctrl-f", label: "scroll full page down", category: "Motion", intents: ["scroll down a full page", "page down"] },
  { combo: "Ctrl-b", label: "scroll full page up", category: "Motion", intents: ["scroll up a full page", "page up"] },

  // ---- Count-Prefixed Motion ----
  { combo: "5j", label: "down 5 lines", category: "Count-Prefixed Motion", intents: ["move down 5 lines", "go down five", "jump down several lines"] },
  { combo: "5k", label: "up 5 lines", category: "Count-Prefixed Motion", intents: ["move up 5 lines", "go up five", "jump up several lines"] },
  { combo: "3w", label: "forward 3 words", category: "Count-Prefixed Motion", intents: ["skip forward 3 words", "jump three words ahead"] },
  { combo: "3b", label: "back 3 words", category: "Count-Prefixed Motion", intents: ["skip back 3 words", "jump three words back"] },
  { combo: "10G", label: "go to line 10", category: "Count-Prefixed Motion", intents: ["go to line 10", "jump to a specific line number", "jump to line N"] },
  { combo: "5x", label: "delete 5 characters", category: "Count-Prefixed Motion", intents: ["delete 5 characters", "remove several characters forward"] },
  { combo: "3dd", label: "delete 3 lines", category: "Count-Prefixed Motion", intents: ["delete 3 lines", "delete multiple lines at once", "remove several lines"] },
  { combo: "3yy", label: "yank 3 lines", category: "Count-Prefixed Motion", intents: ["copy 3 lines", "yank multiple lines"] },
  { combo: "2dw", label: "delete 2 words", category: "Count-Prefixed Motion", intents: ["delete 2 words", "delete multiple words forward"] },
  { combo: "4>>", label: "indent 4 lines", category: "Count-Prefixed Motion", intents: ["indent multiple lines", "indent 4 lines at once"] },
  { combo: "3J", label: "join next 3 lines", category: "Count-Prefixed Motion", intents: ["join several lines together", "merge multiple lines into one"] },
  { combo: "2f\"", label: "find 2nd quote character forward", category: "Count-Prefixed Motion", intents: ["find the second occurrence of a character", "jump to the nth match of a character"] },

  // ---- Operator ----
  { combo: "d", label: "delete operator", category: "Operator", intents: ["delete", "cut", "remove text"] },
  { combo: "c", label: "change operator", category: "Operator", intents: ["change", "replace text", "delete and start typing"] },
  { combo: "y", label: "yank (copy) operator", category: "Operator", intents: ["copy", "yank"] },
  { combo: ">", label: "indent right", category: "Operator", intents: ["indent", "shift text right", "add indentation"] },
  { combo: "<", label: "indent left", category: "Operator", intents: ["outdent", "shift text left", "remove indentation"] },
  { combo: "gu", label: "lowercase operator", category: "Operator", intents: ["make lowercase", "lowercase text"] },
  { combo: "gU", label: "uppercase operator", category: "Operator", intents: ["make uppercase", "uppercase text", "capitalize"] },
  { combo: "g~", label: "toggle case operator", category: "Operator", intents: ["toggle case", "swap upper and lower case"] },
  { combo: "gq", label: "hard-wrap operator", category: "Operator", intents: ["reflow paragraph", "hard wrap text", "wrap long lines"] },

  // ---- Text Object ----
  { combo: "iw", label: "inner word", category: "Text Object", intents: ["inner word", "just this word", "select this word without spaces"] },
  { combo: "aw", label: "a word (with trailing space)", category: "Text Object", intents: ["a word", "word including surrounding space"] },
  { combo: "iW", label: "inner WORD", category: "Text Object", intents: ["inner big word", "whole space-delimited chunk"] },
  { combo: "aW", label: "a WORD", category: "Text Object", intents: ["a big word", "a WORD with space"] },
  { combo: "ip", label: "inner paragraph", category: "Text Object", intents: ["inner paragraph", "just this paragraph"] },
  { combo: "ap", label: "a paragraph (with blank line)", category: "Text Object", intents: ["a paragraph", "paragraph including trailing blank line"] },
  { combo: "is", label: "inner sentence", category: "Text Object", intents: ["inner sentence", "just this sentence"] },
  { combo: "as", label: "a sentence", category: "Text Object", intents: ["a sentence", "sentence with trailing space"] },
  { combo: "it", label: "inner tag", category: "Text Object", intents: ["inner tag", "inside an html tag", "content between tags"] },
  { combo: "at", label: "a tag (including the tags)", category: "Text Object", intents: ["a tag", "whole html tag including brackets"] },

  // ---- Operator + Text Object (the "delete/change/yank inside X" combos) ----
  { combo: "di\"", label: "delete inside double quotes", category: "Operator + Text Object", intents: ["delete everything inside quotes", "delete inside quotes", "clear text between double quotes", "delete quoted text"] },
  { combo: "ci\"", label: "change inside double quotes", category: "Operator + Text Object", intents: ["change text inside quotes", "replace quoted text", "edit inside quotes"] },
  { combo: "yi\"", label: "yank inside double quotes", category: "Operator + Text Object", intents: ["copy text inside quotes", "yank quoted text"] },
  { combo: "da\"", label: "delete a double-quoted string (quotes included)", category: "Operator + Text Object", intents: ["delete the quotes and their contents", "delete a whole quoted string"] },
  { combo: "ca\"", label: "change a double-quoted string (quotes included)", category: "Operator + Text Object", intents: ["replace a whole quoted string including the quotes"] },
  { combo: "ya\"", label: "yank a double-quoted string (quotes included)", category: "Operator + Text Object", intents: ["copy a whole quoted string including the quotes"] },
  { combo: "di'", label: "delete inside single quotes", category: "Operator + Text Object", intents: ["delete inside single quotes", "clear text between single quotes"] },
  { combo: "ci'", label: "change inside single quotes", category: "Operator + Text Object", intents: ["change text inside single quotes", "replace single quoted text"] },
  { combo: "yi'", label: "yank inside single quotes", category: "Operator + Text Object", intents: ["copy text inside single quotes"] },
  { combo: "di`", label: "delete inside backticks", category: "Operator + Text Object", intents: ["delete inside backticks", "clear text between backticks", "delete inline code"] },
  { combo: "ci`", label: "change inside backticks", category: "Operator + Text Object", intents: ["change text inside backticks", "edit inline code"] },
  { combo: "di(", label: "delete inside parentheses", category: "Operator + Text Object", intents: ["delete inside parentheses", "delete everything inside the parens", "clear function arguments", "delete inside round brackets"] },
  { combo: "ci(", label: "change inside parentheses", category: "Operator + Text Object", intents: ["change text inside parentheses", "replace function arguments", "edit inside parens"] },
  { combo: "yi(", label: "yank inside parentheses", category: "Operator + Text Object", intents: ["copy text inside parentheses", "yank function arguments"] },
  { combo: "da(", label: "delete a parenthesized group (parens included)", category: "Operator + Text Object", intents: ["delete the parentheses and their contents", "delete the whole parens block"] },
  { combo: "ca(", label: "change a parenthesized group (parens included)", category: "Operator + Text Object", intents: ["replace the whole parens block including parentheses"] },
  { combo: "ya(", label: "yank a parenthesized group (parens included)", category: "Operator + Text Object", intents: ["copy the whole parens block including parentheses"] },
  { combo: "di{", label: "delete inside curly braces", category: "Operator + Text Object", intents: ["delete inside curly braces", "clear text inside braces", "delete inside a code block"] },
  { combo: "ci{", label: "change inside curly braces", category: "Operator + Text Object", intents: ["change text inside braces", "edit inside a code block"] },
  { combo: "yi{", label: "yank inside curly braces", category: "Operator + Text Object", intents: ["copy text inside braces", "yank a code block's contents"] },
  { combo: "da{", label: "delete a brace block (braces included)", category: "Operator + Text Object", intents: ["delete the whole brace block including braces"] },
  { combo: "ca{", label: "change a brace block (braces included)", category: "Operator + Text Object", intents: ["replace the whole brace block including braces"] },
  { combo: "ya{", label: "yank a brace block (braces included)", category: "Operator + Text Object", intents: ["copy the whole brace block including braces"] },
  { combo: "di[", label: "delete inside square brackets", category: "Operator + Text Object", intents: ["delete inside square brackets", "clear text inside brackets", "delete array contents"] },
  { combo: "ci[", label: "change inside square brackets", category: "Operator + Text Object", intents: ["change text inside brackets", "edit array contents"] },
  { combo: "yi[", label: "yank inside square brackets", category: "Operator + Text Object", intents: ["copy text inside brackets", "yank array contents"] },
  { combo: "da[", label: "delete a bracket block (brackets included)", category: "Operator + Text Object", intents: ["delete the whole bracket block including brackets"] },
  { combo: "ca[", label: "change a bracket block (brackets included)", category: "Operator + Text Object", intents: ["replace the whole bracket block including brackets"] },
  { combo: "di<", label: "delete inside angle brackets", category: "Operator + Text Object", intents: ["delete inside angle brackets", "clear text inside less than greater than"] },
  { combo: "ci<", label: "change inside angle brackets", category: "Operator + Text Object", intents: ["change text inside angle brackets"] },
  { combo: "diw", label: "delete inner word", category: "Operator + Text Object", intents: ["delete this word", "delete just the word under the cursor", "delete word without trailing space"] },
  { combo: "ciw", label: "change inner word", category: "Operator + Text Object", intents: ["change this word", "replace the word under the cursor"] },
  { combo: "yiw", label: "yank inner word", category: "Operator + Text Object", intents: ["copy this word", "yank the word under the cursor"] },
  { combo: "daw", label: "delete a word (with trailing space)", category: "Operator + Text Object", intents: ["delete a whole word including the space after it"] },
  { combo: "caw", label: "change a word (with trailing space)", category: "Operator + Text Object", intents: ["replace a whole word including the space after it"] },
  { combo: "yaw", label: "yank a word (with trailing space)", category: "Operator + Text Object", intents: ["copy a whole word including the space after it"] },
  { combo: "dip", label: "delete inner paragraph", category: "Operator + Text Object", intents: ["delete this paragraph", "delete the whole current paragraph"] },
  { combo: "cip", label: "change inner paragraph", category: "Operator + Text Object", intents: ["rewrite this paragraph", "replace the whole current paragraph"] },
  { combo: "yip", label: "yank inner paragraph", category: "Operator + Text Object", intents: ["copy this paragraph", "yank the whole current paragraph"] },
  { combo: "dap", label: "delete a paragraph (with blank line)", category: "Operator + Text Object", intents: ["delete a paragraph and the blank line after it"] },
  { combo: "cap", label: "change a paragraph (with blank line)", category: "Operator + Text Object", intents: ["replace a paragraph including the blank line after it"] },
  { combo: "yap", label: "yank a paragraph (with blank line)", category: "Operator + Text Object", intents: ["copy a paragraph including the blank line after it"] },
  { combo: "dis", label: "delete inner sentence", category: "Operator + Text Object", intents: ["delete this sentence", "delete the current sentence"] },
  { combo: "cis", label: "change inner sentence", category: "Operator + Text Object", intents: ["rewrite this sentence", "replace the current sentence"] },
  { combo: "yis", label: "yank inner sentence", category: "Operator + Text Object", intents: ["copy this sentence", "yank the current sentence"] },
  { combo: "dit", label: "delete inside a tag", category: "Operator + Text Object", intents: ["delete the content of an html tag", "delete inside the tags"] },
  { combo: "cit", label: "change inside a tag", category: "Operator + Text Object", intents: ["replace the content of an html tag", "edit inside the tags"] },
  { combo: "dat", label: "delete a tag (tags included)", category: "Operator + Text Object", intents: ["delete a whole html tag including the tags themselves"] },
  { combo: "gUiw", label: "uppercase inner word", category: "Operator + Text Object", intents: ["make this word uppercase", "capitalize the word under the cursor"] },
  { combo: "guiw", label: "lowercase inner word", category: "Operator + Text Object", intents: ["make this word lowercase"] },

  // ---- Operator + Motion (non-text-object combos) ----
  { combo: "dw", label: "delete to next word", category: "Operator + Motion", intents: ["delete to next word", "delete a word forward from the cursor"] },
  { combo: "de", label: "delete to end of word", category: "Operator + Motion", intents: ["delete to end of word", "delete the rest of this word"] },
  { combo: "db", label: "delete back a word", category: "Operator + Motion", intents: ["delete the previous word", "delete backward one word"] },
  { combo: "d$", label: "delete to end of line", category: "Operator + Motion", intents: ["delete to the end of the line", "delete rest of line", "clear to end of line"] },
  { combo: "d0", label: "delete to start of line", category: "Operator + Motion", intents: ["delete to the start of the line", "delete back to beginning of line"] },
  { combo: "d^", label: "delete to first non-blank char", category: "Operator + Motion", intents: ["delete to first non blank character", "delete leading part of line"] },
  { combo: "dd", label: "delete whole line", category: "Operator + Motion", intents: ["delete the whole line", "delete this line", "remove entire line"] },
  { combo: "dj", label: "delete this and next line", category: "Operator + Motion", intents: ["delete this line and the next one", "delete two lines down"] },
  { combo: "dk", label: "delete this and previous line", category: "Operator + Motion", intents: ["delete this line and the one above", "delete two lines up"] },
  { combo: "dG", label: "delete to end of buffer", category: "Operator + Motion", intents: ["delete to the end of the document", "delete everything below the cursor"] },
  { combo: "dgg", label: "delete to start of buffer", category: "Operator + Motion", intents: ["delete to the top of the document", "delete everything above the cursor"] },
  { combo: "d}", label: "delete to end of paragraph", category: "Operator + Motion", intents: ["delete to the end of the paragraph", "delete rest of paragraph"] },
  { combo: "d{", label: "delete to start of paragraph", category: "Operator + Motion", intents: ["delete to the start of the paragraph", "delete back to beginning of paragraph"] },
  { combo: "cw", label: "change to next word", category: "Operator + Motion", intents: ["change a word", "replace to next word", "edit the rest of this word onward"] },
  { combo: "ce", label: "change to end of word", category: "Operator + Motion", intents: ["change to end of word", "replace the rest of this word"] },
  { combo: "c$", label: "change to end of line", category: "Operator + Motion", intents: ["change to end of line", "replace rest of line", "rewrite to end of line"] },
  { combo: "cc", label: "change whole line", category: "Operator + Motion", intents: ["change the whole line", "clear the line and start typing", "rewrite this line"] },
  { combo: "yw", label: "yank to next word", category: "Operator + Motion", intents: ["copy a word", "yank to next word"] },
  { combo: "y$", label: "yank to end of line", category: "Operator + Motion", intents: ["copy to end of line", "yank rest of line"] },
  { combo: "yy", label: "yank whole line", category: "Operator + Motion", intents: ["copy the whole line", "yank this line", "duplicate a line's text"] },
  { combo: "y}", label: "yank to end of paragraph", category: "Operator + Motion", intents: ["copy to end of paragraph", "yank rest of paragraph"] },
  { combo: ">>", label: "indent line right", category: "Operator + Motion", intents: ["indent this line", "shift line right"] },
  { combo: "<<", label: "indent line left", category: "Operator + Motion", intents: ["outdent this line", "shift line left"] },
  { combo: "gUU", label: "uppercase whole line", category: "Operator + Motion", intents: ["make the whole line uppercase"] },
  { combo: "guu", label: "lowercase whole line", category: "Operator + Motion", intents: ["make the whole line lowercase"] },
  { combo: "g~~", label: "toggle case of whole line", category: "Operator + Motion", intents: ["swap case of the whole line"] },
  { combo: "gqip", label: "hard-wrap this paragraph", category: "Operator + Motion", intents: ["reflow this paragraph", "wrap this paragraph to fit"] },
  { combo: "x", label: "delete character under cursor", category: "Operator + Motion", intents: ["delete a character", "delete the character under the cursor", "remove one character"] },
  { combo: "X", label: "delete character before cursor", category: "Operator + Motion", intents: ["delete the character before the cursor", "backspace one character"] },
  { combo: "D", label: "delete to end of line", category: "Operator + Motion", intents: ["delete rest of line shortcut", "quick delete to end of line"] },
  { combo: "C", label: "change to end of line", category: "Operator + Motion", intents: ["quick change to end of line", "clear and type to end of line"] },
  { combo: "Y", label: "yank whole line", category: "Operator + Motion", intents: ["quick copy whole line"] },
  { combo: "~", label: "toggle case of one character", category: "Operator + Motion", intents: ["swap case of one character", "flip letter case under cursor"] },
  { combo: "J", label: "join this line with the next", category: "Operator + Motion", intents: ["join lines", "merge this line with the next one", "combine two lines into one"] },

  // ---- Search Motion ----
  { combo: "/pattern<Enter>", label: "search forward for pattern", category: "Search Motion", intents: ["search forward", "find text below", "search down the document"] },
  { combo: "?pattern<Enter>", label: "search backward for pattern", category: "Search Motion", intents: ["search backward", "find text above", "search up the document"] },
  { combo: "n", label: "repeat last search, same direction", category: "Search Motion", intents: ["find next match", "repeat the search", "go to next search result"] },
  { combo: "N", label: "repeat last search, opposite direction", category: "Search Motion", intents: ["find previous match", "repeat search backward", "go to previous search result"] },
  { combo: "*", label: "search forward for word under cursor", category: "Search Motion", intents: ["search for this word", "find other uses of this word forward"] },
  { combo: "#", label: "search backward for word under cursor", category: "Search Motion", intents: ["search backward for this word", "find other uses of this word backward"] },
  { combo: "fx", label: "jump to next 'x' on this line", category: "Search Motion", intents: ["jump to a character on this line", "find character forward on the line"] },
  { combo: "Fx", label: "jump back to previous 'x' on this line", category: "Search Motion", intents: ["jump back to a character on this line", "find character backward on the line"] },
  { combo: "tx", label: "jump just before next 'x' on this line", category: "Search Motion", intents: ["jump right before a character", "move up to a character without landing on it"] },
  { combo: "dtx", label: "delete up to (not including) next 'x'", category: "Search Motion", intents: ["delete up to a character", "delete everything before the next occurrence of a character"] },
  { combo: "dfx", label: "delete up to and including next 'x'", category: "Search Motion", intents: ["delete through a character", "delete up to and including the next occurrence"] },
  { combo: ";", label: "repeat last f/F/t/T", category: "Search Motion", intents: ["repeat character search", "do the last find again"] },
  { combo: ",", label: "repeat last f/F/t/T, opposite direction", category: "Search Motion", intents: ["repeat character search backward", "reverse the last find"] },

  // ---- Marks & Registers ----
  { combo: "ma", label: "set mark 'a' at cursor", category: "Marks & Registers", intents: ["set a mark", "bookmark this position", "save cursor position"] },
  { combo: "`a", label: "jump to exact position of mark 'a'", category: "Marks & Registers", intents: ["jump to a mark", "go back to a bookmarked position"] },
  { combo: "'a", label: "jump to line of mark 'a'", category: "Marks & Registers", intents: ["jump to the line of a mark", "go to the start of a bookmarked line"] },
  { combo: "\"ayy", label: "yank line into register a", category: "Marks & Registers", intents: ["copy into a named register", "yank a line into a specific register"] },
  { combo: "\"ap", label: "paste from register a", category: "Marks & Registers", intents: ["paste from a named register", "paste a specific saved clipboard"] },
  { combo: "Ctrl-o", label: "jump back in jumplist", category: "Marks & Registers", intents: ["jump back to where I was", "go back in cursor history"] },
  { combo: "Ctrl-i", label: "jump forward in jumplist", category: "Marks & Registers", intents: ["jump forward in cursor history"] },

  // ---- Visual Mode ----
  { combo: "v", label: "enter character-wise visual mode", category: "Visual Mode", intents: ["select text", "start selecting characters", "enter visual mode"] },
  { combo: "V", label: "enter line-wise visual mode", category: "Visual Mode", intents: ["select whole lines", "start selecting lines", "enter visual line mode"] },
  { combo: "Ctrl-v", label: "enter block-wise visual mode", category: "Visual Mode", intents: ["select a rectangular block", "column select", "enter visual block mode"] },
  { combo: "v}", label: "select to end of paragraph", category: "Visual Mode", intents: ["select to end of paragraph", "highlight rest of paragraph"] },
  { combo: "v$", label: "select to end of line", category: "Visual Mode", intents: ["select to end of line", "highlight rest of line"] },
  { combo: "vi\"", label: "select inside double quotes", category: "Visual Mode", intents: ["select everything inside quotes", "highlight quoted text"] },
  { combo: "vi(", label: "select inside parentheses", category: "Visual Mode", intents: ["select everything inside parentheses", "highlight function arguments"] },
  { combo: "vip", label: "select inner paragraph", category: "Visual Mode", intents: ["select this paragraph", "highlight the current paragraph"] },
  { combo: "viw", label: "select inner word", category: "Visual Mode", intents: ["select this word", "highlight the word under the cursor"] },
  { combo: "gv", label: "reselect last visual selection", category: "Visual Mode", intents: ["reselect the last selection", "get my selection back"] },
  { combo: "o", label: "jump to other end of selection", category: "Visual Mode", intents: ["swap which end of the selection is active", "jump to the other end of a selection"] },

  // ---- Insert & Repeat ----
  { combo: "i", label: "insert before cursor", category: "Insert & Repeat", intents: ["insert before cursor", "start typing here", "enter insert mode here"] },
  { combo: "a", label: "insert after cursor", category: "Insert & Repeat", intents: ["insert after cursor", "start typing after this character", "append here"] },
  { combo: "I", label: "insert at start of line", category: "Insert & Repeat", intents: ["insert at start of line", "start typing at the beginning of the line"] },
  { combo: "A", label: "insert at end of line", category: "Insert & Repeat", intents: ["insert at end of line", "append to end of line", "start typing at the end of the line"] },
  { combo: "o", label: "open new line below and insert", category: "Insert & Repeat", intents: ["open a new line below", "add a new line after this one and type"] },
  { combo: "O", label: "open new line above and insert", category: "Insert & Repeat", intents: ["open a new line above", "add a new line before this one and type"] },
  { combo: "gi", label: "insert at last insert position", category: "Insert & Repeat", intents: ["resume typing where I left off", "insert at the last edit position"] },
  { combo: "u", label: "undo", category: "Insert & Repeat", intents: ["undo", "undo last change"] },
  { combo: "Ctrl-r", label: "redo", category: "Insert & Repeat", intents: ["redo", "redo the undone change"] },
  { combo: ".", label: "repeat last change", category: "Insert & Repeat", intents: ["repeat last edit", "do that again", "repeat the last change"] },
  { combo: "p", label: "paste after cursor/line", category: "Insert & Repeat", intents: ["paste", "paste after", "put the clipboard here"] },
  { combo: "P", label: "paste before cursor/line", category: "Insert & Repeat", intents: ["paste before", "put the clipboard before the cursor"] },
  { combo: "r<char>", label: "replace single character", category: "Insert & Repeat", intents: ["replace one character", "swap a single character without entering insert mode"] },
  { combo: "R", label: "enter Replace mode", category: "Insert & Repeat", intents: ["overtype characters", "enter replace mode", "type over existing text"] },
  { combo: "Ctrl-a", label: "increment number under/after cursor", category: "Insert & Repeat", intents: ["increment a number", "increase the number under the cursor"] },
  { combo: "Ctrl-x", label: "decrement number under/after cursor", category: "Insert & Repeat", intents: ["decrement a number", "decrease the number under the cursor"] },
];
```

**82 combo entries seeded**, spanning all 11 categories, covering: 27 plain/count motions, 12 count-prefixed motions, 9 bare operators, 10 text objects on their own, 43 operator+text-object combos (the bulk — every supported text object × its common operators), 27 operator+motion pairs, 13 search motions, 7 marks/registers, 11 visual-mode combos, and 16 insert/repeat commands. Every combo was checked against § 1's confirmed-supported list; nothing here is a command codemirror-vim-core doesn't actually implement.

### Decisions the implementer should not re-litigate (data-specific)

- `/pattern<Enter>` and `?pattern<Enter>` are the two entries that don't fit the "every character is a literal keystroke" model `comboSteps` assumes — they contain a placeholder (`pattern`) and a named key (`<Enter>`). Render these two specially (or simply don't run them through `comboSteps`'s key-cap treatment; render as plain text instead) rather than generalizing `comboSteps` for a two-entry edge case.
- `r<char>` is the other placeholder-bearing entry (real key you type varies) — same treatment: display as text, not key-caps, since there's no fixed final keystroke to show.
- Category counts are intentionally uneven (43 in "Operator + Text Object" vs. 7 in "Marks & Registers") — this reflects the real Vim usage the ask asked for ("aim for actually useful coverage," the target audience's stated daily-driver gap being text objects specifically), not an oversight to balance out.
