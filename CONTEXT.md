# rbnotes

A vim-flavored notes app: notes are buffers, buffers are edited in a CodeMirror vim engine, and everything the user sees comes from one client-side cache of notes.

## Language

### Search

**Local search**:
In-buffer search triggered by `/`, owned entirely by the vim engine — the app never intercepts it. Incremental: jumps to matches while the pattern is typed, `n`/`N` to repeat, `E486` when nothing matches.
_Avoid_: find, slash search, vim search

**Global search**:
App-level search across every note's content, triggered by `Ctrl+/`. A chosen result opens that note's buffer and hands off the query as a one-shot pending match.
_Avoid_: search palette, full search

### Cache & freshness

**Warm buffer / cold buffer**:
A buffer is warm when its content is already in the client cache; cold when it isn't. A cold buffer is never editable-empty — only its skeleton — so a save can never overwrite real content with an empty document.

**Warm-up**:
The one-time batched fetch of every note's content into the client cache, fired once right after first paint. First paint blocks only on metadata; warm-up is invisible.

**Friction**:
Any visible waiting state — spinner, skeleton, disabled control, blocked input — that follows a user action. The product bar is zero friction after first paint.
_Avoid_: loading, spinner

### Editor

**Buffer**:
A note open in the editor. A buffer keeps its cursor, scroll, and undo across switches — returning lands exactly where you left off. A note id that has no buffer is `E484: no such buffer` — never an empty buffer.
_Avoid_: file, document, tab

**Workspace**:
The persistent shell buffers live in. Switching buffers is instant client state inside the workspace, never a navigation.
_Avoid_: page, route

**Dashboard**:
The landing screen shown on every fresh load — sign-in, new tab, restart — before any buffer is open: recent notes, a "+ new note" action, and account access. Reached again anytime by clicking the wordmark. Never appears mid-session; switching buffers inside the workspace stays instant and never returns here.
_Avoid_: home page, start screen

**Autosave**:
Silent background persist after a short idle. Success is silent; failure toasts with retry. `:w` and `Ctrl+S` are a force-flush: the same persist, immediately.
_Avoid_: save button, manual save

**Command dock**:
The `:`-command surface of the shell (writes, new notes, etc.).
_Avoid_: command bar, terminal
