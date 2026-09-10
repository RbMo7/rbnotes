import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// Ported 1:1 from the Stitch design tokens (src/app/globals.css), not
// reinterpreted — CodeMirror's default theme must never show through.
const colors = {
  surfaceContainerLowest: "#0c0e10",
  surfaceContainerLow: "#1a1c1e",
  surfaceContainer: "#1e2022",
  surfaceContainerHigh: "#282a2c",
  onSurface: "#e2e2e5",
  onSurfaceVariant: "#bccbb9",
  outline: "#869585",
  outlineVariant: "#3d4a3d",
  primary: "#4be277",
  onPrimary: "#003915",
  secondary: "#b9c8de",
  secondaryContainer: "#39485a",
  tertiaryFixedDim: "#ffb4a9",
};

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
      },
      "&.cm-focused": { outline: "none" },
      ".cm-line": { padding: "0 2px" },
      ".cm-gutters": {
        backgroundColor: colors.surfaceContainerLowest,
        color: `${colors.outline}99`,
        border: "none",
        minWidth: "4.5rem",
        paddingLeft: "0.75rem",
      },
      ".cm-lineNumbers .cm-gutterElement": {
        padding: "0 1rem 0 0",
        textAlign: "right",
      },
      ".cm-activeLineGutter": {
        backgroundColor: `${colors.surfaceContainerHigh}66`,
        color: colors.primary,
        fontWeight: "700",
      },
      ".cm-activeLine": {
        backgroundColor: `${colors.surfaceContainerHigh}40`,
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
        backgroundColor: `${colors.primary}40`,
      },
      ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: colors.primary,
        color: colors.onPrimary,
      },
      ".cm-placeholder": {
        color: `${colors.onSurfaceVariant}66`,
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
    { tag: t.quote, color: colors.onSurfaceVariant, fontStyle: "italic" },
    { tag: t.contentSeparator, color: colors.outlineVariant },
    { tag: t.meta, color: colors.outline },
  ]),
);
