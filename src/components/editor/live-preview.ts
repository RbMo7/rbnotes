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

/** A clickable link's document range and destination, found during build(). */
export type LinkHit = { from: number; to: number; url: string };

type PreviewState = { mode: VimMode; deco: DecorationSet; links: LinkHit[] };

/** Given the links found in the current build and a document position, the link (if any) covering it. Pure, so it's testable without a live EditorView. */
export function findLinkAt(links: LinkHit[], pos: number): LinkHit | undefined {
  return links.find((l) => l.from <= pos && pos <= l.to);
}

const SAFE_LINK_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/**
 * A note's link destination is untrusted content -- it can come from a
 * shared note written by someone else, not just the current user. Without
 * this, opening a `[click](javascript:...)` (or `data:`/`vbscript:`/
 * `blob:`/`file:`/any other scripting-capable scheme) link would run
 * arbitrary script in the viewer's tab at this app's origin. Only
 * http/https/mailto are allowed; everything else, including anything that
 * fails to parse as a URL at all, is rejected.
 */
export function isSafeLinkScheme(url: string): boolean {
  try {
    return SAFE_LINK_SCHEMES.has(new URL(url).protocol.toLowerCase());
  } catch {
    return false;
  }
}

function build(state: EditorState, mode: VimMode): PreviewState {
  if (RAW_MODES.has(mode)) return { mode, deco: Decoration.none, links: [] };

  const doc = state.doc;
  const ranges: Range<Decoration>[] = [];
  const links: LinkHit[] = [];

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
        case "Link": {
          // Only real [text](url) links, not Image -- a plain bare return
          // (not `false`) so the walk still descends into this node's
          // LinkMark/URL children, which the cases above still hide.
          const urlNode = node.node.getChild("URL");
          if (!urlNode) return;
          const url = doc.sliceString(urlNode.from, urlNode.to);
          links.push({ from: node.from, to: node.to, url });
          ranges.push(
            Decoration.mark({ class: "cm-lp-link", attributes: { title: url } }).range(
              node.from,
              node.to,
            ),
          );
          return;
        }
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

  return { mode, deco: Decoration.set(ranges, true), links };
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
  ".cm-lp-link": {
    color: "var(--color-primary)",
    textDecoration: "underline",
    cursor: "pointer",
  },
});

/**
 * Click-to-open for a live-preview link (case "Link" in build() above).
 * mousedown, not click: CodeMirror places the cursor on mousedown, so
 * intercepting there and returning true is what stops it from also moving
 * the cursor into the (now-hidden) link syntax. Plain left-click, no
 * modifier -- the link's own hover title (see the "Link" case) is the
 * only affordance needed to know it's clickable.
 */
function linkClickHandler(field: StateField<PreviewState>): Extension {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (event.button !== 0) return false;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) return false;
      const hit = findLinkAt(view.state.field(field).links, pos);
      if (!hit || !isSafeLinkScheme(hit.url)) return false;
      event.preventDefault();
      window.open(hit.url, "_blank", "noopener,noreferrer");
      return true;
    },
  });
}

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

  return [field, snapCursorOut(field), linkClickHandler(field), livePreviewBaseTheme];
}
