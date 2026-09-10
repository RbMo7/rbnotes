import {
  EditorState,
  EditorSelection,
  StateField,
  StateEffect,
  type Extension,
  type Range,
} from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { VimMode } from "@/lib/store";

/**
 * Obsidian-style "Live Preview": NORMAL and RO hide markdown syntax marks
 * (headings, emphasis, code marks, link syntax, blockquote/list markers,
 * horizontal rules) and render list bullets/rules as glyphs; INSERT,
 * VISUAL and EDIT show the raw source untouched. Mode alone decides --
 * unlike Obsidian, there is deliberately no cursor-line exception.
 *
 * A StateField, not a ViewPlugin: decorations supplied from a plugin
 * function may not contain block widgets or replacing decorations that
 * span a line break (@codemirror/view forbids it), and the horizontal
 * rule and a hidden fence line both need exactly that. Not a Compartment
 * either -- each per-note EditorState carries a compartment's *original*
 * `.of(...)` value, so a `reconfigure()` never survives `view.setState()`
 * to another note. Mode is instead read through a plain ref the caller
 * keeps current, and pushed into the field with a dedicated effect that
 * rides the same transaction as every mode change (see Editor.tsx's
 * wireVimMode and syncPreviewMode).
 */
export type ModeRef = { current: VimMode };

const RAW_MODES: ReadonlySet<VimMode> = new Set(["INSERT", "VISUAL", "EDIT"]);

export const setPreviewMode = StateEffect.define<VimMode>();

class BulletWidget extends WidgetType {
  constructor(readonly marker: string) {
    super();
  }
  eq(other: BulletWidget) {
    return other.marker === this.marker;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-lp-bullet";
    span.textContent = this.marker;
    return span;
  }
}

class RuleWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const div = document.createElement("div");
    div.className = "cm-lp-hr";
    return div;
  }
}

function isBlank(ch: string) {
  return ch === " " || ch === "\t";
}

/**
 * Block marks (`#`, `>`, list markers) are followed by a required space
 * that the parser does not include in the mark node itself -- swallow it
 * too, or the hidden heading/quote/bullet leaves a stray leading space.
 */
function extendOverTrailingSpace(doc: EditorState["doc"], to: number): number {
  let end = to;
  while (end < doc.length && isBlank(doc.sliceString(end, end + 1))) end++;
  return end;
}

function bulletGlyph(markText: string): string {
  return /^[-*+]$/.test(markText) ? "•" : markText;
}

function addLineClass(
  ranges: Range<Decoration>[],
  doc: EditorState["doc"],
  from: number,
  to: number,
  className: string,
) {
  const deco = Decoration.line({ class: className });
  const startLine = doc.lineAt(from).number;
  const endLine = doc.lineAt(to).number;
  for (let n = startLine; n <= endLine; n++) {
    ranges.push(deco.range(doc.line(n).from));
  }
}

type PreviewState = { mode: VimMode; deco: DecorationSet };

function build(state: EditorState, mode: VimMode): PreviewState {
  if (RAW_MODES.has(mode)) return { mode, deco: Decoration.none };

  const doc = state.doc;
  const ranges: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter(node) {
      switch (node.name) {
        case "HeaderMark":
        case "QuoteMark": {
          const to = extendOverTrailingSpace(doc, node.to);
          ranges.push(Decoration.replace({}).range(node.from, to));
          return;
        }
        case "ListMark": {
          const to = extendOverTrailingSpace(doc, node.to);
          const marker = doc.sliceString(node.from, node.to);
          ranges.push(
            Decoration.replace({ widget: new BulletWidget(bulletGlyph(marker)) }).range(
              node.from,
              to,
            ),
          );
          return;
        }
        case "EmphasisMark":
        case "StrikethroughMark":
        case "CodeMark":
        case "CodeInfo":
        case "LinkMark":
          ranges.push(Decoration.replace({}).range(node.from, node.to));
          return;
        case "URL": {
          // An autolink's URL *is* its visible text (`<https://x.com>` has
          // no separate label) -- hiding it would leave nothing visible at
          // all. Only a parenthesized link/image's destination is pure
          // syntax once the link text itself remains.
          if (node.node.parent?.name === "Link" || node.node.parent?.name === "Image") {
            ranges.push(Decoration.replace({}).range(node.from, node.to));
          }
          return;
        }
        case "HorizontalRule": {
          const line = doc.lineAt(node.from);
          ranges.push(
            Decoration.replace({ widget: new RuleWidget(), block: true }).range(
              line.from,
              line.to,
            ),
          );
          return;
        }
        case "Blockquote":
          addLineClass(ranges, doc, node.from, node.to, "cm-lp-quote");
          return;
        case "FencedCode":
          addLineClass(ranges, doc, node.from, node.to, "cm-lp-code");
          return;
      }
    },
  });

  return { mode, deco: Decoration.set(ranges, true) };
}

/**
 * `@replit/codemirror-vim` computes every motion's target offset itself
 * (`h`/`l`/`w`/`0`/`$`, `dd`/`ciw`, ...) and never consults
 * `EditorView.atomicRanges`, which only gates DOM-derived selection and
 * mouse interaction. Without this, `0`/`^` land on a hidden `#` (so `x`
 * silently deletes it), `$` lands inside a hidden `)` and the cursor
 * visually vanishes, and `w`/`ciw` traverse invisible URL text. This pushes
 * every *empty* selection back out of a hidden range the moment a
 * transaction tries to place it there, biased by direction of travel so a
 * leftward and a rightward motion land on opposite, sensible sides.
 */
function snapCursorOut(field: StateField<PreviewState>): Extension {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.selection) return tr;
    const range = tr.selection.main;
    if (!range.empty) return tr;

    const deco = tr.startState.field(field, false)?.deco;
    if (!deco || deco.size === 0) return tr;

    const pos = range.head;
    const hits: { from: number; to: number }[] = [];
    deco.between(Math.max(pos - 1, 0), pos, (from, to) => {
      if (from < pos && pos < to) hits.push({ from, to });
    });
    if (hits.length === 0) return tr;

    const forward = pos >= tr.startState.selection.main.head;
    const mapped = forward ? hits[0].to : hits[0].from;
    return [tr, { selection: EditorSelection.cursor(mapped) }];
  });
}

const livePreviewBaseTheme = EditorView.baseTheme({
  ".cm-lp-bullet": { color: "var(--color-primary)", marginRight: "0.35em" },
  ".cm-lp-hr": {
    borderBottom: "1px solid var(--color-outline-variant)",
    margin: "0.5em 0",
  },
  ".cm-lp-quote": {
    borderLeft: "2px solid var(--color-outline)",
    paddingLeft: "0.75em",
    color: "var(--color-on-surface-variant)",
  },
  ".cm-lp-code": {
    backgroundColor: "var(--color-surface-container-high)",
  },
});

export function livePreview(modeRef: ModeRef): Extension {
  const field = StateField.define<PreviewState>({
    create: (state) => build(state, modeRef.current),
    update(value, tr) {
      let mode = value.mode;
      for (const effect of tr.effects) {
        if (effect.is(setPreviewMode)) mode = effect.value;
      }
      if (
        mode === value.mode &&
        !tr.docChanged &&
        syntaxTree(tr.state) === syntaxTree(tr.startState)
      ) {
        return value;
      }
      return build(tr.state, mode);
    },
    provide: (f) => [
      EditorView.decorations.from(f, (v) => v.deco),
      EditorView.atomicRanges.from(f, (v) => () => v.deco),
    ],
  });

  return [field, snapCursorOut(field), livePreviewBaseTheme];
}
