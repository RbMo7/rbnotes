import { lineNumbers } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import type { EditorState } from "@codemirror/state";

export type LineNumberMode = "off" | "absolute" | "relative" | "hybrid";

/**
 * The NORMAL screenshot's gutter: the cursor's own line shows its real
 * (absolute) number while every other line counts its distance from it —
 * classic Vim `:set rnu nu` "hybrid" numbering. `formatNumber` re-runs on
 * every view update, including pure selection moves, so this stays live
 * as the cursor moves with no extra plumbing.
 */
export function lineNumberGutter(mode: LineNumberMode) {
  if (mode === "off") return [];

  return lineNumbers({
    formatNumber: (lineNo: number, state: EditorState) => {
      const cursorLine = state.doc.lineAt(state.selection.main.head).number;
      if (mode === "absolute") return String(lineNo);
      if (lineNo === cursorLine) return String(lineNo);
      if (mode === "relative") return String(Math.abs(lineNo - cursorLine));
      // hybrid: relative everywhere except the active line
      return String(Math.abs(lineNo - cursorLine));
    },
  });
}

export const rbnotesMarkdown = markdown({
  base: markdownLanguage,
  extensions: [GFM],
  codeLanguages: [],
});
