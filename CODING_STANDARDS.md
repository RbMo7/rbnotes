# Coding standards

These are the conventions this codebase actually follows, written down so
they stay consistent as it grows. Tooling already enforces formatting and
basic correctness (ESLint via `eslint-config-next`, TypeScript in `strict`
mode) — this file covers what tooling can't check.

## File & folder organization

- `src/app/` — routes only, grouped by access level: `(app)/` for signed-in
  pages, `(auth)/` for the public auth flow. Metadata routes
  (`sitemap.ts`, `robots.ts`, `manifest.ts`, `opengraph-image.tsx`) live at
  the app root, one file per Next.js convention.
- `src/components/<domain>/` — one folder per feature area (`buffer/`,
  `editor/`, `shell/`, `workspace/`, `overlay/`, `auth/`, `dashboard/`,
  `settings/`). A hook or helper used by only one domain's components lives
  in that same folder (e.g. `components/buffer/use-note-operations.ts`,
  `components/workspace/note-path.ts`), not in `src/lib/`.
- `src/lib/` — cross-domain utilities, client-side state (`store.ts`,
  `local-notes-store.ts`), and the query layer (`notes-query.ts`). If more
  than one component domain needs it, it belongs here instead of being
  duplicated or reached into across domains.
- `src/server/actions/` — all `"use server"` entry points, grouped by
  resource (`notes.ts`, `auth.ts`, `device.ts`, `shares.ts`, `settings.ts`).
  Nothing else calls the database or Supabase directly from client code.

## Naming

- Components: PascalCase files and exports, one component per file
  (`NoteListItem.tsx`, `SidebarTabs.tsx`).
- Hooks and plain utility modules: kebab-case files, `use-` prefix for
  hooks (`use-note-operations.ts`, `use-is-desktop.ts`), camelCase export
  matching React's `useX` convention.
- Non-hook utility files: kebab-case, descriptive noun phrases
  (`note-path.ts`, `local-notes-store.ts`), not abbreviated.

## Comments

Comments explain **why**, never **what** — the code already says what.
Write one when a decision has a non-obvious reason: a constraint from
another system, a bug class being avoided, a tradeoff that was considered
and rejected. Skip it when a reader could infer the same thing from the
code itself.

```ts
// Good — explains a non-obvious constraint that would otherwise invite a "fix"
// NoteRecord's dates are ISO strings, not Date objects, deliberately --
// TanStack Query's dehydrate/hydrate boundary round-trips through JSON,
// which silently turns a Date into a string anyway.

// Bad — restates the code
// Loop over all notes and check if archived
```

Multi-paragraph JSDoc-style blocks are normal here for a module's central
export (see `src/lib/site-url.ts`, `src/lib/notes-query.ts`,
`src/server/actions/notes.ts`) when the reasoning genuinely needs that much
context. Don't add one to justify something that isn't actually subtle.

## Server actions

- Every action starts by re-deriving the user from the session via
  `getAuthedUser()`. Never accept a `userId` from the client — Zod schemas
  in `src/lib/schemas.ts` deliberately have no `userId` field, and server
  actions never destructure one from `input`.
- Untyped input (`input: unknown`) is parsed through a Zod schema
  immediately; nothing downstream deals with unvalidated data.
- Actions are thin: parse input, call into `src/lib/notes.ts` (or the
  matching resource module), return only what the caller needs — not the
  full DB row.

## Data & state

- Server state (anything from the DB) flows through TanStack Query,
  centralized in `src/lib/notes-query.ts` — one client-side cache the whole
  app reads from, kept in sync by mutations writing into the cache
  directly rather than refetching.
- Local-only / offline state (unsynced notes, device-local settings) has
  its own store (`local-notes-store.ts`, `local-settings.ts`,
  `store.ts`) and is never mixed into the query cache — the two are kept
  visibly distinct in both the code and (per `CONTEXT.md`) the product
  model of Synced vs. Local-only.

## Validation boundary

All external input (form submissions, server action params) is validated
through a Zod schema from `src/lib/schemas.ts`. Add new input shapes there
rather than inlining ad hoc checks in a component or action.

## TypeScript

- `strict` mode is on; don't add `any` to work around it. Prefer letting
  Zod's inferred types (`z.infer<typeof someSchema>`) flow through rather
  than hand-writing a parallel interface.
- Inline prop types for components (`function Foo({ id, title }: { id: string; title: string })`)
  rather than a separate named `interface` — this repo's components use
  inline destructured types throughout (see `NoteListItem.tsx`).

## Imports

Use the `@/*` path alias for anything outside the current file's own
folder (`@/lib/...`, `@/components/...`, `@/server/actions/...`); use a
relative import only for a sibling in the same folder.

## Tests

- Vitest, colocated next to the file under test:
  `component-name.test.tsx` / `module-name.test.ts` — not a separate
  `__tests__/` tree.
- One `describe` per behavior being tested, not one per file; test names
  read as plain-English assertions (`"defaults to hacker when absent"`).
- Test the schema/logic boundary directly rather than mocking it — e.g.
  `schemas.test.ts` calls `settingsSchema.parse()` for real instead of
  stubbing Zod.
- A file gets a test when it holds non-trivial logic (a schema, a
  reducer, a hook with branching behavior) — not every component
  automatically needs one.

## What the baseline smell list still applies to

On top of the above, judge new code against Fowler's standard code
smells (Mysterious Name, Duplicated Code, Feature Envy, Data Clumps,
Primitive Obsession, Repeated Switches, Shotgun Surgery, Divergent
Change, Speculative Generality, Message Chains, Middle Man, Refused
Bequest) as judgement calls, not hard rules — anything documented above
takes precedence where the two conflict.
