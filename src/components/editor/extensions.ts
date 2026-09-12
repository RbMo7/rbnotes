import {
  Decoration,
  EditorView,
  GutterMarker,
  MatchDecorator,
  ViewPlugin,
  ViewUpdate,
  gutter,
  gutters,
  type DecorationSet,
} from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import type { EditorState } from "@codemirror/state";
import { TAG_PATTERN } from "@/lib/tags";
import { isH1Line } from "@/lib/markdown-title";

export type LineNumberMode = "off" | "absolute" | "relative" | "hybrid";

class LineNumberMarker extends GutterMarker {
  constructor(readonly text: string) {
    super();
  }
  eq(other: LineNumberMarker) {
    return this.text === other.text;
  }
  toDOM() {
    return document.createTextNode(this.text);
  }
}

function maxLineNumber(lines: number): number {
  let last = 9;
  while (last < lines) last = last * 10 + 9;
  return last;
}

/**
 * The NORMAL screenshot's gutter: the cursor's own line shows its real
 * (absolute) number while every other line counts its distance from it —
 * classic Vim `:set rnu nu` "hybrid" numbering.
 *
 * Built on the low-level `gutter()` API rather than the `lineNumbers()`
 * helper: that helper's `lineMarkerChange` only compares the (never-
 * changing) config facet identity, so CodeMirror skips recomputing every
 * line's number on a pure cursor move -- it only resyncs the gutter on a
 * doc/viewport change. That made relative/hybrid numbers silently freeze
 * under real Vim motions (NORMAL mode never touches the document), while
 * INSERT mode looked fine purely because typing *does* change the doc and
 * happens to force a resync as a side effect. `lineMarkerChange` here reacts
 * to `update.selectionSet` directly, so a bare cursor move refreshes the
 * numbers regardless of mode.
 */
export function lineNumberGutter(mode: LineNumberMode) {
  if (mode === "off") return [];

  const format = (lineNo: number, state: EditorState): string => {
    const cursorLine = state.doc.lineAt(state.selection.main.head).number;
    if (mode === "absolute") return String(lineNo);
    if (lineNo === cursorLine) return String(lineNo);
    // relative and hybrid both count distance from the cursor off its line
    return String(Math.abs(lineNo - cursorLine));
  };

  return [
    gutters(),
    gutter({
      class: "cm-lineNumbers",
      lineMarker: (view, line) =>
        new LineNumberMarker(format(view.state.doc.lineAt(line.from).number, view.state)),
      lineMarkerChange: (update) => update.selectionSet,
      initialSpacer: (view) =>
        new LineNumberMarker(format(maxLineNumber(view.state.doc.lines), view.state)),
      updateSpacer: (spacer, update) => {
        const max = format(maxLineNumber(update.view.state.doc.lines), update.view.state);
        return max === (spacer as LineNumberMarker).text ? spacer : new LineNumberMarker(max);
      },
    }),
  ];
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

const titleLineMark = Decoration.line({ class: "cm-title-line" });

function computeTitleLineDeco(view: EditorView): DecorationSet {
  const firstLine = view.state.doc.line(1);
  // A note's title IS this line (lib/markdown-title.ts) -- but only when it
  // actually reads as one; an untyped/placeholder first line shouldn't be
  // singled out visually as if it already were the title.
  if (!isH1Line(firstLine.text)) return Decoration.none;
  return Decoration.set([titleLineMark.range(firstLine.from)]);
}

/**
 * Makes the note's own title line -- its first `# heading` -- read as
 * unmistakably *the* title rather than just another heading: TopBar's own
 * title only ever echoes this same line (see Editor.tsx's
 * onTitleRevealChange), so it needs to look distinct even from a same-level
 * `#` heading used mid-document. rbnotesMarkdownHighlight's `t.heading1`
 * rule already sizes every `#` heading, uniformly by syntax alone -- it
 * can't single out line 1 specifically, which is exactly why this is a
 * separate position-aware decoration (a plain `.cm-line` class) rather than
 * a highlight-style tweak. Its CSS (rbnotes-theme.ts) needs `!important`:
 * the line class and t.heading1's own generated class both match the same
 * heading text, and only `!important` reliably wins that instead of
 * whichever the syntax highlighter's own DOM nesting happens to prefer.
 */
export const titleLineHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = computeTitleLineDeco(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) this.decorations = computeTitleLineDeco(update.view);
    }
  },
  { decorations: (v) => v.decorations },
);
