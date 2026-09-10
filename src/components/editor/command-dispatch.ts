import { Vim, getCM } from "@replit/codemirror-vim";
import type { EditorView } from "@codemirror/view";
import type { Settings } from "@/lib/schemas";
import { isH1Line } from "@/lib/markdown-title";

export type CommandContext = {
  /** Resolves to whether the write succeeded. */
  save: () => Promise<boolean>;
  quit: (force: boolean) => void;
  isDirty: () => boolean;
  createNew: () => void;
  rename: (title: string) => void;
  deleteNote: (hard: boolean) => void;
  openHelp: () => void;
  toggleSidebar: () => void;
  toggleInspector: () => void;
  share: () => void;
  unshare: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  notify: (message: string) => void;
};

/**
 * RbNotes' commands (`:w`, `:q`, `:new`, `:rename`, `:delete`, `:share`,
 * app-level `:set` options...) are dispatched here directly, rather than
 * through `Vim.defineEx` -- several of the names we need (`write`, `delete`,
 * `set`) are already reserved in @replit/codemirror-vim's own ex-command
 * table for real Vim behavior (line deletion, vim options), and registering
 * over them would silently break that engine for anyone using genuine Vim
 * ex commands. Anything we don't recognize as an app command falls through
 * to `Vim.handleEx`, so real Vim ex commands (`:s/foo/bar/`, `:sort`,
 * `:g/pattern/d`, vim's own `:set ignorecase`, ...) keep working exactly as
 * they do in real Vim.
 */
export async function dispatchCommand(raw: string, view: EditorView, ctx: CommandContext) {
  const input = raw.trim();
  if (!input) return;

  const spaceIdx = input.indexOf(" ");
  const name = spaceIdx === -1 ? input : input.slice(0, spaceIdx);
  const arg = spaceIdx === -1 ? "" : input.slice(spaceIdx + 1).trim();
  const bang = name.endsWith("!");
  const bareName = bang ? name.slice(0, -1) : name;

  switch (bareName) {
    case "w":
    case "write":
      await ctx.save();
      return;
    case "q":
    case "quit":
      // Mirrors real Vim's E37: refuse to leave a dirty buffer unless
      // forced with `:q!`. There is no autosave net anymore (§13.4), so
      // this is the one thing standing between a stray `:q` and lost work.
      if (!bang && ctx.isDirty()) {
        ctx.notify("E37: No write since last change (add ! to override)");
        return;
      }
      ctx.quit(bang);
      return;
    case "wq":
    case "x": {
      // Real Vim semantics: write, then quit only if the write succeeded.
      const wrote = await ctx.save();
      if (wrote) ctx.quit(true);
      else ctx.notify("E212: Can't open file for writing — buffer not closed");
      return;
    }
    case "new":
      ctx.createNew();
      return;
    case "rename": {
      // A note's title IS its first `# heading` (lib/markdown-title.ts) --
      // there's no separate metadata field to write. Renaming means
      // editing that heading line in the document itself, then writing it
      // like any other change, so the two can never drift apart.
      if (!arg) {
        ctx.notify("rename: a title is required — :rename <title>");
        return;
      }
      const doc = view.state.doc;
      let targetLine = 0;
      for (let i = 1; i <= doc.lines; i++) {
        if (isH1Line(doc.line(i).text)) {
          targetLine = i;
          break;
        }
      }
      if (targetLine) {
        const line = doc.line(targetLine);
        view.dispatch({ changes: { from: line.from, to: line.to, insert: `# ${arg}` } });
      } else {
        view.dispatch({ changes: { from: 0, to: 0, insert: `# ${arg}\n\n` } });
      }
      ctx.rename(arg);
      await ctx.save();
      return;
    }
    case "delete":
      ctx.deleteNote(bang);
      return;
    case "help":
      ctx.openHelp();
      return;
    case "insp":
      ctx.toggleInspector();
      return;
    case "b":
      ctx.toggleSidebar();
      return;
    case "share":
      ctx.share();
      return;
    case "unshare":
      ctx.unshare();
      return;
    case "set":
      applyAppSetting(arg, ctx);
      return;
    default: {
      const cm = getCM(view);
      if (!cm) return;
      try {
        Vim.handleEx(cm as Parameters<typeof Vim.handleEx>[0], input);
      } catch {
        ctx.notify(`E492: not an editor command: ${input}`);
      }
    }
  }
}

// App-level display settings (line numbers, wrap, tab size) are intercepted
// out of `:set` before it ever reaches Vim's own option system -- Vim's
// real options (ignorecase, hlsearch, ...) are untouched and still resolve
// via the default branch above.
function applyAppSetting(arg: string, ctx: CommandContext) {
  switch (arg) {
    case "nu":
    case "number":
      ctx.updateSettings({ lineNumbers: "absolute" });
      return;
    case "nonu":
    case "nonumber":
      ctx.updateSettings({ lineNumbers: "off" });
      return;
    case "rnu":
    case "relativenumber":
      ctx.updateSettings({ lineNumbers: "hybrid" });
      return;
    case "nornu":
    case "norelativenumber":
      ctx.updateSettings({ lineNumbers: "absolute" });
      return;
    case "wrap":
      ctx.updateSettings({ wordWrap: true });
      return;
    case "nowrap":
      ctx.updateSettings({ wordWrap: false });
      return;
    default:
      if (arg.startsWith("ts=") || arg.startsWith("tabsize=")) {
        const n = parseInt(arg.split("=")[1] ?? "", 10);
        if (n >= 1 && n <= 8) ctx.updateSettings({ tabSize: n });
        return;
      }
      ctx.notify(`E518: unknown option: ${arg}`);
  }
}

export type CommandChip = { label: string; full: string; danger?: boolean };

export const COMMAND_CHIPS: CommandChip[] = [
  { label: ":w", full: "w" },
  { label: ":rename <title>", full: "rename " },
  { label: ":new", full: "new" },
  { label: ":wq", full: "wq" },
  { label: ":delete", full: "delete", danger: true },
  { label: ":share", full: "share" },
  { label: ":set rnu", full: "set rnu" },
  { label: ":help", full: "help" },
];
