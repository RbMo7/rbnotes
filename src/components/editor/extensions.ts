import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  ViewUpdate,
  lineNumbers,
  type DecorationSet,
} from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import type { EditorState } from "@codemirror/state";
import { TAG_PATTERN } from "@/lib/tags";

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

// Renders every `#tag` as a real pill (rounded background, see the
// `.cm-tag-pill` rule in rbnotes-theme.ts) instead of plain bold text --
// the same TAG_PATTERN lib/tags.ts uses to build the sidebar's Tags list,
// so a tag only ever looks like a tag where it's actually one.
const tagMatcher = new MatchDecorator({
  regexp: TAG_PATTERN,
  decoration: () => Decoration.mark({ class: "cm-tag-pill" }),
});

export const tagPillDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = tagMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = tagMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);
