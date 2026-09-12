import { comboSteps } from "@/components/overlay/vim-combo-intents";

// Entries whose combo string isn't purely single-visible-character
// keystrokes (a placeholder like `pattern`, or a named key like `<Enter>`)
// -- rendered as plain text instead of split into key-cap steps, per
// docs/research/vim-hacks-reference.md's explicit call-out. There are only
// two shapes of this in the whole seed set: a search-pattern combo and the
// `r<char>` replace-one-character combo.
function isStepRenderable(combo: string): boolean {
  return !combo.includes("<") && !combo.includes("pattern");
}

/**
 * A vim combo rendered as discrete key-cap steps (`d` -> `i` -> `"`), reusing
 * CommandDock.tsx's existing Enter/Tab/Esc kbd-style span markup verbatim.
 * Shared by VimHacksView (the full reference page) and CheatsheetPopup (whose
 * own search also surfaces vim-hack matches now, not just `:` commands).
 */
export function ComboKeys({ combo }: { combo: string }) {
  // label-sm, not code-editor: this renders inline inside label-sm rows
  // (CheatsheetPopup's result rows, VimHacksView's ComboRow) -- code-editor's
  // much taller line-height (1.75rem vs label-sm's 0.875rem) was inflating
  // every combo row far past its neighbors' height, which is what made the
  // "commands" and "vim hacks" result sections look inconsistently spaced
  // despite sharing the exact same row wrapper classes.
  // text-primary/font-semibold: the same treatment CheatsheetPopup's
  // "commands" rows use for their key (":delete", "dd / yy / p") -- these
  // are two halves of the same result list and were reading as two
  // different UIs because the keys used different colors.
  if (!isStepRenderable(combo)) {
    return <span className="font-label-md text-label-md text-primary font-semibold">{combo}</span>;
  }
  const steps = comboSteps(combo);
  return (
    <span className="flex items-center gap-1 font-label-md text-label-md">
      {steps.map((key, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="bg-surface-container-high px-1 py-0.5 text-primary font-semibold">{key}</span>
          {i < steps.length - 1 && <span className="text-outline">&rarr;</span>}
        </span>
      ))}
    </span>
  );
}
