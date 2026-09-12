import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// CSS custom property references, not literal hex -- CodeMirror's
// EditorView.theme()/HighlightStyle both emit real stylesheets via
// style-mod, so a `var(--color-*)` string here is live CSS exactly like a
// Tailwind bg-surface class is: it tracks whichever [data-theme="..."]
// block is active (see globals.css), instead of freezing colors at
// extension-creation time. (A hardcoded hex snapshot here previously meant
// the editor's own background/text/syntax colors never responded to a
// theme switch at all -- the surrounding chrome would repaint, but the
// buffer itself stayed on the very first theme it was created under.)
const colors = {
  surfaceContainerLowest: "var(--color-surface-container-lowest)",
  surfaceContainerLow: "var(--color-surface-container-low)",
  surfaceContainer: "var(--color-surface-container)",
  surfaceContainerHigh: "var(--color-surface-container-high)",
  onSurface: "var(--color-on-surface)",
  onSurfaceVariant: "var(--color-on-surface-variant)",
  outline: "var(--color-outline)",
  outlineVariant: "var(--color-outline-variant)",
  primary: "var(--color-primary)",
  onPrimary: "var(--color-on-primary)",
  secondary: "var(--color-secondary)",
  secondaryContainer: "var(--color-secondary-container)",
  tertiaryFixedDim: "var(--color-tertiary-fixed-dim)",
};

// A hex-plus-alpha-suffix trick (`${hex}99`) only works on literal hex
// strings -- can't concatenate onto a var() reference. color-mix() is the
// live-CSS equivalent, and needs the percentage spelled out per call site
// (the old suffixes: 99 -> 60%, 66 -> 40%, 40 -> 25%).
function mix(varRef: string, percent: number): string {
  return `color-mix(in srgb, ${varRef} ${percent}%, transparent)`;
}

/**
 * The full CM6 theme: JetBrains Mono at the `code-editor` type scale
 * (0.875rem / 1.75rem line-height), the hybrid-relative gutter treatment,
 * block NORMAL-mode cursor vs. thin blinking INSERT-mode bar, and the
 * active-line bleed the NORMAL screenshot shows.
 */
export function rbnotesTheme(mode: "NORMAL" | "INSERT" | "VISUAL" | "EDIT" | "RO") {
  const blockCursor = mode === "NORMAL" || mode === "VISUAL";

  return EditorView.theme(
    {
      "&": {
        color: colors.onSurface,
        backgroundColor: colors.surfaceContainerLowest,
        fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace",
        fontSize: "0.875rem",
        height: "100%",
      },
      ".cm-content": {
        caretColor: colors.primary,
        fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace",
        lineHeight: "1.75rem",
        padding: "1rem 1.5rem",
      },
      ".cm-scroller": {
        fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace",
        lineHeight: "1.75rem",
        // A default macOS/overlay scrollbar only appears while actively
        // scrolling, so a note whose content overflows the buffer looked
        // identical to one that didn't -- nothing hinted there was more
        // below. Styling it (Firefox via scrollbar-color, Chromium/Safari
        // via the pseudo-elements below) forces the always-visible "classic"
        // rendering instead, so overflow is visible at rest.
        scrollbarWidth: "thin",
        scrollbarColor: `${mix(colors.outline, 60)} transparent`,
      },
      ".cm-scroller::-webkit-scrollbar": {
        width: "10px",
        height: "10px",
      },
      ".cm-scroller::-webkit-scrollbar-track": {
        backgroundColor: "transparent",
      },
      ".cm-scroller::-webkit-scrollbar-thumb": {
        backgroundColor: mix(colors.outline, 60),
        borderRadius: "9999px",
        border: `2px solid ${colors.surfaceContainerLowest}`,
      },
      ".cm-scroller::-webkit-scrollbar-thumb:hover": {
        backgroundColor: colors.outline,
      },
      "&.cm-focused": { outline: "none" },
      ".cm-line": { padding: "0 2px" },
      ".cm-gutters": {
        backgroundColor: colors.surfaceContainerLowest,
        color: mix(colors.outline, 60),
        border: "none",
        minWidth: "4.5rem",
        paddingLeft: "0.75rem",
      },
      ".cm-lineNumbers .cm-gutterElement": {
        padding: "0 1rem 0 0",
        textAlign: "right",
      },
      ".cm-activeLineGutter": {
        backgroundColor: mix(colors.surfaceContainerHigh, 40),
        color: colors.primary,
        fontWeight: "700",
      },
      ".cm-activeLine": {
        backgroundColor: mix(colors.surfaceContainerHigh, 25),
      },
      // Solid block cursor in NORMAL/VISUAL (real Vim feel); thin blinking
      // bar in INSERT — matches the two Stitch screenshots exactly.
      ".cm-cursor, .cm-dropCursor": blockCursor
        ? {
            borderLeft: "none",
            backgroundColor: colors.primary,
            width: "0.6ch",
          }
        : {
            borderLeftColor: colors.primary,
            borderLeftWidth: "2px",
            animation: "cm-rbnotes-blink 1.06s step-end infinite",
          },
      "@keyframes cm-rbnotes-blink": {
        "50%": { opacity: 0 },
      },
      ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
        backgroundColor: `${colors.secondaryContainer} !important`,
      },
      ".cm-searchMatch": {
        backgroundColor: mix(colors.primary, 25),
      },
      ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: colors.primary,
        color: colors.onPrimary,
      },
      ".cm-placeholder": {
        color: mix(colors.onSurfaceVariant, 40),
      },
      // The note's own title line (extensions.ts's titleLineHighlight marks
      // line 1 with this class, only when it actually reads as a heading) --
      // bigger and in the accent color, so it reads as unmistakably *the*
      // title rather than just another `#` heading the doc happens to have.
      // `!important`: the heading text's own span already carries an
      // explicit font-size/color from rbnotesMarkdownHighlight's t.heading1
      // rule (same element, generated class) -- a plain override here would
      // lose to it depending on DOM nesting the syntax highlighter controls,
      // not us; `!important` wins outright regardless of that nesting.
      ".cm-title-line, .cm-title-line span": {
        fontSize: "1.5rem !important",
        lineHeight: "2rem !important",
        fontWeight: "800 !important",
        color: `${colors.primary} !important`,
        letterSpacing: "-0.01em",
      },
      // The in-document look for a `#tag` (extensions.ts's tagPillDecorations
      // marks it with this class) -- a real pill, not just bold colored
      // text, so it visually reads as a tag rather than emphasized prose.
      ".cm-tag-pill": {
        backgroundColor: colors.secondaryContainer,
        color: colors.secondary,
        borderRadius: "0.25rem",
        padding: "0.05em 0.4em",
        fontWeight: "600",
        cursor: "pointer",
      },
      // We mount vim() with `status: false` (our own statusline replaces its
      // built-in one), so .cm-vim-panel is NEVER used for a persistent
      // status bar in this app -- @replit/codemirror-vim reuses that exact
      // class for its `/` and `:` prompt dialogs too (see its
      // createVimPanel/statusPanel, which share one class name). An earlier
      // version of this theme hid `.cm-vim-panel` outright to suppress the
      // redundant status bar, which also hid the search/ex-command dialog --
      // a display:none element can never receive focus, so `inp.focus()`
      // silently no-ops and every keystroke meant for the prompt fell
      // through to the live buffer as normal editing input instead. Style
      // it to match our theme instead of hiding it.
      ".cm-panels": { border: "none" },
      ".cm-vim-panel": {
        backgroundColor: colors.surfaceContainer,
        borderTop: `1px solid ${colors.outlineVariant}`,
        padding: "0.25rem 1rem",
        fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace",
        fontSize: "0.875rem",
      },
      ".cm-vim-panel input": {
        background: "transparent",
        border: "none",
        outline: "none",
        color: colors.onSurface,
        fontFamily: "inherit",
        fontSize: "inherit",
        width: "100%",
      },
    },
    { dark: true },
  );
}

/**
 * Markdown syntax highlighting matching the buffer screenshots: `#`/`##`
 * marks and headings in primary/secondary, inline code and fenced blocks on
 * a raised surface, list bullets in primary, links underlined in primary,
 * strikethrough (task-done) text muted.
 */
export const rbnotesMarkdownHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.heading1, color: colors.onSurface, fontWeight: "700", fontSize: "1.25rem" },
    { tag: t.heading2, color: colors.onSurface, fontWeight: "600", fontSize: "1.125rem" },
    { tag: t.heading3, color: colors.onSurface, fontWeight: "600" },
    { tag: t.processingInstruction, color: colors.secondary, fontWeight: "700" }, // # marks
    { tag: t.strong, color: colors.onSurface, fontWeight: "700" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strikethrough, color: colors.outline, textDecoration: "line-through" },
    {
      tag: t.monospace,
      color: colors.tertiaryFixedDim,
      backgroundColor: colors.surfaceContainerHigh,
    },
    { tag: t.link, color: colors.primary, textDecoration: "underline" },
    { tag: t.url, color: colors.onSurfaceVariant },
    { tag: t.list, color: colors.primary },
    // lezer-markdown tags OrderedList/BulletList AND everything inside them
    // (marks + paragraph content) with tags.list -- without this override,
    // list-item body text inherits the bullet's primary color instead of
    // the normal text color. Must come after the t.list rule above so it
    // wins for nodes carrying both tags.
    { tag: t.content, color: colors.onSurface },
    { tag: t.quote, color: colors.onSurfaceVariant, fontStyle: "italic" },
    { tag: t.contentSeparator, color: colors.outlineVariant },
    { tag: t.meta, color: colors.outline },
  ]),
);
