# rbnotes

A vim-flavored notes app: notes are buffers, and everything the user sees comes from one client-side cache of notes. At desktop widths, buffers are edited in a CodeMirror vim engine; below the mobile breakpoint, the same buffers are edited in a plain, non-modal surface instead — mobile is a different presentation of the same Workspace, never a separate app.

## Language

### Search

**Local search**:
In-buffer search triggered by `/`, owned entirely by the vim engine — the app never intercepts it. Incremental: jumps to matches while the pattern is typed, `n`/`N` to repeat, `E486` when nothing matches. Has no mobile equivalent: without a vim engine there is nothing to own it, so mobile relies on Global search only.
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

### Storage & sync

**Local-only note**:
A note that lives only in the browser's storage and never reaches the server. The default for any anonymous session — free, frictionless, no sign-in required.
_Avoid_: offline note, unsynced note

**Synced note**:
A note owned by a signed-in account. Edited the same way as a Local-only note — same storage, same Autosave — but a Synced note also pushes to the server, one direction only, on top of the local copy. Signing in is what turns Local-only notes into Synced notes, not a separate save mode.
_Avoid_: online note, paid note, cloud note

**Edited mark**:
Client-side timestamp set on every change, the instant it happens. Never waits on network, never blocked by being offline.
_Avoid_: last updated

**Synced mark**:
Server-confirmed timestamp, set only once a push to the server actually lands. Behind the Edited mark means the change hasn't reached the server yet — normal while offline, not an error.
_Avoid_: updated timestamp

**Tombstone**:
A note marked deleted locally but not yet purged. Deletes travel through the same push as any other edit — a note can never vanish locally before the server has had the chance to see it deleted too.

**Owner**:
The account (or `null`, for genuinely Local-only) that created or last owns a note's local copy. Distinct from Synced/unsynced: an unsynced note created while signed in still has an Owner — it just hasn't reached the server yet. Deciding who a local note may sync into, or be cleared from, by *Synced-vs-unsynced* alone conflates two different questions and was a real cross-account leak; Owner is what actually answers "whose is this."
_Avoid_: userId (when talking about a local note's origin — say Owner instead)

**Device**:
An anonymous, local-only browser install — never a person. Only tracked to count free-tier usage (first seen / last seen); carries no note content and no identity until the browser signs in.
_Avoid_: anonymous user, visitor

### Mobile

**Action menu**:
Mobile's presentation of the Command dock's actions (save, rename, new, delete, share) as plain labeled buttons — no `:` syntax, no chip grid, and no vim-only settings like `:set rnu`. Same actions as the Command dock, different surface.
_Avoid_: mobile command dock

**List screen**:
Mobile's no-buffer-open state: search, tags, and every note in one full-screen view. Merges the Dashboard's landing role with the sidebar's browse role, which stay separate surfaces on desktop.
_Avoid_: mobile dashboard, mobile sidebar

**Note screen**:
Mobile's one-buffer-open state, reached by tapping a note from the List screen; back is an ordinary navigation to the List screen, the same Dashboard-route transition the wordmark already triggers. Presented within the same persistent Workspace shell as desktop — the shell itself never remounts, and warmed buffers stay warm across it.
_Avoid_: mobile buffer view, note page
