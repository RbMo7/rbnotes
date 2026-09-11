import type { Settings } from "@/lib/schemas";

/**
 * The operations the command layer expects from the editor, as a small
 * adapter rather than the live CodeMirror view. The editor is the sole
 * production implementation (see Editor.tsx); tests supply a fake. This is
 * the seam that keeps `:rename`'s document surgery out of dispatch and keeps
 * the whole command layer testable without a DOM.
 */
export type EditorOps = {
  /** Replace the document's first H1 line with `# title`, or prepend one. */
  replaceFirstH1: (title: string) => void;
  /** Run a genuine Vim ex command; returns false if it was not handled. */
  execVimEx: (command: string) => boolean;
};

/** Note operations the command layer drives. The archive-vs-delete policy lives behind `delete`. */
export type NoteOps = {
  /** Resolves to whether the write succeeded. */
  save: () => Promise<boolean>;
  isDirty: () => boolean;
  create: () => void;
  rename: (title: string) => void;
  delete: (hard: boolean) => void;
};

/** Workspace chrome the command layer drives. */
export type WorkspaceOps = {
  notify: (message: string) => void;
  openHelp: () => void;
  /** Close the topmost overlay, mirroring Vim's `:q` closing a preview window. */
  quit: () => void;
  toggleSidebar: () => void;
  toggleInspector: () => void;
  share: () => void;
  unshare: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Navigate to the Settings page -- what bare `:set` (no option given) opens. */
  openSettings: () => void;
  /** Navigate to /login -- a no-op (middleware bounces back to "/") if already signed in. */
  login: () => void;
  /** Sign out of a Synced session; notifies instead for a Local-only one (nothing to log out of). */
  logout: () => void;
};

export type CommandContext = {
  note: NoteOps;
  workspace: WorkspaceOps;
};

export type DeleteMode = "archive" | "purge";

/**
 * The raw command strings CommandDock (desktop) and MobileActionMenu
 * (mobile) both submit here -- named once so the two surfaces can't drift
 * apart on the actual command vocabulary `dispatchCommand`'s switch below
 * understands.
 */
export const COMMAND = {
  save: "w",
  newNote: "new",
  delete: "delete",
  share: "share",
  renamePrefix: "rename ",
} as const;

/**
 * The archive-vs-delete policy, in the command layer: an empty buffer is
 * purged (there is nothing worth archiving), as is any buffer the user
 * forces with `:delete!`. Everything else is archived. Lives here so the
 * policy is verified by the command suite, not inside a component.
 */
export function resolveDeleteMode(hard: boolean, content: string): DeleteMode {
  return hard || content.trim().length === 0 ? "purge" : "archive";
}

/**
 * RbNotes' commands (`:w`, `:q`, `:new`, `:rename`, `:delete`, `:share`,
 * app-level `:set` options...) are dispatched here directly, rather than
 * through `Vim.defineEx` -- several of the names we need (`write`, `delete`,
 * `set`) are already reserved in @replit/codemirror-vim's own ex-command
 * table for real Vim behavior (line deletion, vim options), and registering
 * over them would silently break that engine for anyone using genuine Vim
 * ex commands. Anything we don't recognize as an app command falls through
 * to the editor adapter's `execVimEx`, so real Vim ex commands (`:s/foo/bar/`,
 * `:sort`, `:g/pattern/d`, vim's own `:set ignorecase`, ...) keep working
 * exactly as they do in real Vim.
 */
export async function dispatchCommand(raw: string, ops: EditorOps, ctx: CommandContext) {
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
      await ctx.note.save();
      return;
    case "q":
    case "quit":
      // Mirrors real Vim's E37: refuse to leave a dirty buffer unless
      // forced with `:q!`. There is no autosave net anymore (§13.4), so
      // this is the one thing standing between a stray `:q` and lost work.
      if (!bang && ctx.note.isDirty()) {
        ctx.workspace.notify("E37: No write since last change (add ! to override)");
        return;
      }
      ctx.workspace.quit();
      return;
    case "wq":
    case "x": {
      // Real Vim semantics: write, then quit only if the write succeeded.
      const wrote = await ctx.note.save();
      if (wrote) ctx.workspace.quit();
      else ctx.workspace.notify("E212: Can't open file for writing — buffer not closed");
      return;
    }
    case "new":
      ctx.note.create();
      return;
    case "rename": {
      // A note's title IS its first `# heading` (lib/markdown-title.ts) --
      // there's no separate metadata field to write. Renaming means editing
      // that heading line in the document itself, then writing it like any
      // other change, so the two can never drift apart. The document surgery
      // sits behind the editor adapter so this layer stays view-free.
      if (!arg) {
        ctx.workspace.notify("rename: a title is required — :rename <title>");
        return;
      }
      ops.replaceFirstH1(arg);
      ctx.note.rename(arg);
      await ctx.note.save();
      return;
    }
    case "delete":
      ctx.note.delete(bang);
      return;
    case "help":
      ctx.workspace.openHelp();
      return;
    case "insp":
      ctx.workspace.toggleInspector();
      return;
    case "b":
      ctx.workspace.toggleSidebar();
      return;
    case "share":
      ctx.workspace.share();
      return;
    case "unshare":
      ctx.workspace.unshare();
      return;
    case "login":
      ctx.workspace.login();
      return;
    case "logout":
      ctx.workspace.logout();
      return;
    case "set":
      // Bare `:set` (no option) opens the Settings page -- `:set <option>`
      // keeps its real meaning below (editor display options).
      if (!arg) {
        ctx.workspace.openSettings();
        return;
      }
      applyAppSetting(arg, ctx);
      return;
    default:
      if (!ops.execVimEx(input)) {
        ctx.workspace.notify(`E492: not an editor command: ${input}`);
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
      ctx.workspace.updateSettings({ lineNumbers: "absolute" });
      return;
    case "nonu":
    case "nonumber":
      ctx.workspace.updateSettings({ lineNumbers: "off" });
      return;
    case "rnu":
    case "relativenumber":
      ctx.workspace.updateSettings({ lineNumbers: "hybrid" });
      return;
    case "nornu":
    case "norelativenumber":
      ctx.workspace.updateSettings({ lineNumbers: "absolute" });
      return;
    case "wrap":
      ctx.workspace.updateSettings({ wordWrap: true });
      return;
    case "nowrap":
      ctx.workspace.updateSettings({ wordWrap: false });
      return;
    default:
      if (arg.startsWith("ts=") || arg.startsWith("tabsize=")) {
        const n = parseInt(arg.split("=")[1] ?? "", 10);
        if (n >= 1 && n <= 8) ctx.workspace.updateSettings({ tabSize: n });
        return;
      }
      ctx.workspace.notify(`E518: unknown option: ${arg}`);
  }
}
