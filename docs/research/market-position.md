# Market position research: rbnotes vs. the notes-app landscape

Date: 2026-09-11
Author: research pass (Claude), requested to assess rbnotes' feature set against competing notes apps and answer three viability questions.

> Note on placement: this repo has no existing research-notes convention (no `docs/research/` directory existed, unlike `docs/adr/` for decisions or `.scratch/` for specs). This file was placed at `docs/research/market-position.md` as a reasonable new location; if the team adopts a different convention later, this should move.

---

## 1. What rbnotes actually is (from the code, not the pitch)

Read directly: `CONTEXT.md`, `docs/adr/0001-persistent-workspace.md`, `docs/adr/0002-offline-first-local-storage.md`, `.scratch/offline-first-sync/spec.md`, `prisma/schema.prisma`, `package.json`, and the `src/app/`, `src/components/editor/`, `src/components/dashboard/`, `src/server/actions/` trees.

### Core architecture

- **Vim-native editor, for real.** `package.json` lists `@replit/codemirror-vim: ^6.4.0` alongside the CodeMirror 6 stack (`@codemirror/state`, `@codemirror/view`, `@codemirror/lang-markdown`, etc.). This is a genuine vim keybinding engine (used by other real products, e.g. Replit), not a hand-rolled subset of shortcuts. `src/components/editor/Editor.tsx`, `shortcuts.ts`, and `command-dispatch.ts` build the app's `:`-command dock and shortcut layer on top of it. `CONTEXT.md`'s "Local search" entry confirms `/`-search is owned entirely by the vim engine, not intercepted by the app — i.e. this isn't cosmetic vim styling, the editor really is CodeMirror's vim mode.
- **Persistent workspace, not page-per-note.** ADR 0001: buffers (open notes) live in one persistent client shell; switching notes is instant client state, not a route transition/remount. First paint blocks only on note metadata; full content is warmed in one batched fetch right after.
- **Offline-first, local storage as source of truth.** ADR 0002 + the `.scratch/offline-first-sync/spec.md` (status: `ready-for-agent`, i.e. designed but not necessarily fully shipped at the time of this snapshot) describe: every note stored in browser IndexedDB as the actual source of truth; sync to Postgres (via Supabase) is a one-directional, last-write-wins push layered on top, triggered by autosave/blur/reconnect/periodic retry. Anonymous (signed-out) use is fully-featured "Local-only" — zero server calls for note content, no sign-up required. Signing in doesn't change the editing model, it just adds the push.
- **What's actually persisted server-side** (`prisma/schema.prisma`): `Profile` (mirrors Supabase Auth user), `Note` (id, userId, title, content, pinned, archived, timestamps, soft-delete), `NoteShare` + `NoteShareView` (working link-sharing with per-viewer view counts), and `AnonymousDevice` (id, firstSeenAt, lastSeenAt — a bare usage-counting ping, no note content, not linked to an account unless the device signs in).
- **Mobile is a real, separate presentation, not a squeezed-down desktop view.** `CONTEXT.md` "Mobile" section + ADR 0001's "Amendment (mobile screens)": below the mobile breakpoint the same persistent Workspace renders a full-screen List screen (browse/search) and Note screen (one buffer) instead of the vim engine + sidebar + command dock, with a plain non-modal "Action menu" replacing `:`-commands. Same underlying state, same warmed buffers, different surface — confirmed by `src/components/dashboard/Dashboard.tsx`, `RecentNotesList.tsx`.
- **Sharing works today.** `src/server/actions/shares.ts` — `createShareAction`/`revokeShareAction`/`getShareInfoAction` are real, authenticated, call into `src/lib/shares.ts`, and there's a public view route (`src/app/s/[token]/`). This is not aspirational.

### What does NOT exist (confirmed by grep, not by omission)

Ran `grep -rniE "stripe|billing|subscription|payment|\bprice\b" src/ prisma/` — **zero hits** in either tree. There is no payment integration, no plan/entitlement field on `Profile` or anywhere else, no billing UI, nothing named subscription/price/payment anywhere in the codebase. The free/paid split is currently a **storage-layer architectural decision** (ADR 0002: signed-out = local-only, signed-in = synced), not an enforced product tier. Anyone can create an account today and get sync for free — there is no gate.

### No marketing surface at all

`src/app/` top level: `(app)/` (routes: `/notes`, `/settings`), `(auth)/` (login, register, forgot-password, reset), `auth/callback`, `s/[token]` (public share view), plus `layout.tsx`, `opengraph-image.tsx`, `robots.ts`, `sitemap.ts`. **No landing page, no marketing copy, no pricing page, no onboarding flow.** The root of `(app)/page.tsx` is the Dashboard itself (recent notes, new note, account) — i.e. the "front door" of the app today *is* the product, gated behind login/register or a local-only session, with nothing between a stranger arriving at the domain and being asked to create a note. This is a materially different situation from "has a landing page but weak differentiation" — there is currently no page that explains to a new visitor what rbnotes is or why to use it.

---

## 2. Competitive landscape

Primary-source pricing/positioning, pulled directly from each product's own site (fetched 2026-09-11) except where noted.

| Product | Free tier | Paid tier(s) | Core positioning | Vim/keyboard-native? |
|---|---|---|---|---|
| **Notion** | $0/member — 5MB uploads, 7-day history, 10 guests | Plus $10/mo, Business $20/mo, Enterprise custom | "One tool to run your company" — all-in-one workspace/wiki/DB for teams | No |
| **Obsidian** | Free, unlimited, local markdown files | Sync $4–$8/mo (billed annually; $5–$10 monthly) tiered by vault count/storage/history; Publish priced separately (not found on Sync page) | "Sharpen your thinking" — local-first, plugin-extensible personal knowledge base | **Yes — built-in.** Settings → Editor → Advanced → "Vim key bindings," using CodeMirror's vim emulation (same underlying approach as rbnotes). A community "Vimrc Support" plugin layers a persistent `.obsidian.vimrc`, custom leader keys, ex-commands on top. |
| **Apple Notes** | Bundled with iCloud's free 5GB (shared across all iCloud services) | iCloud+ 50GB $0.99/mo up to 2TB $9.99/mo (no annual billing option) | Default/bundled note-taking, tightly OS-integrated, E2E-encrypted locked notes | No |
| **Bear** | Free — unlimited notes, full markdown/tagging/focus mode, but **single device only** | Bear Pro $2.99/mo or $29.99/yr — adds multi-device iCloud sync, 28+ themes, 15 icons, OCR search | "Markdown notes you'll love" — beautiful native Mac/iOS-only markdown notes | No |
| **Standard Notes** | Free — unlimited notes, full E2E encryption, cross-device sync, no card required | Productivity $90/yr (~$7.50/mo), Professional $120/yr (~$12.50/mo) — unlock paid editors (incl. a dedicated **Vim Editor** extension), themes, unlimited version history, daily encrypted backups, self-hosting on Professional | Privacy-first, E2E-encrypted, local-first notes with an extensible editor system | **Partially** — not vim-native by default, but ships an optional "Vim Editor" extension behind the paywall; the base app is not modal/keyboard-driven. |
| **Logseq** | Free, fully open-source, no feature gating — unlimited pages/blocks/graphs, local markdown/org-mode files | Backer (sync) $5/mo or $60/yr; Sponsor $15/mo for experimental builds; "Logseq Pro" (hosted real-time collab/sync) in testing, pricing TBA | "Privacy-first, open-source knowledge base" — local-first outliner for networked thought | No |
| **Craft** | $0/mo — 1,500 blocks, 1GB storage, 7-day history, 15 AI credits | Plus $6.40–8/mo (unlimited content, sync, sharing, 50 AI credits), Family $12–15/mo, Team $50/mo | Beautiful, AI-assisted docs/notes for daily workflow, strong on design & structure | No |

Sources:
- Notion: https://www.notion.com/pricing (fetched)
- Obsidian home: https://obsidian.md/ (fetched); Obsidian Sync: https://obsidian.md/sync (fetched); Obsidian vim bindings: https://community.obsidian.md/plugins/obsidian-vimrc-support and https://tomdeneire.medium.com/obsidian-for-vim-users-5979d571f71e (search-cross-checked — confirms native Settings → Editor → Advanced → "Vim key bindings" toggle, plugin only adds `.vimrc` support on top)
- Apple/iCloud: https://support.apple.com/en-us/108047 (iCloud+ plans, via search)
- Bear: https://bear.app (fetched) cross-checked against https://blog.bear.app/2023/04/bear-2-will-have-a-new-price-only-for-new-customers/ and aggregator pricing pages (search) — note free tier is single-device only, sync is the paywalled feature, same shape as rbnotes' local/synced split
- Standard Notes: official pricing page (https://standardnotes.com/pricing and https://standardnotes.com/plans) returned HTTP 403 to automated fetch both directly and via alternate paths; figures above triangulated from multiple third-party trackers referencing the official page (spotsaas.com, saasworthy.com) which agree on $90/yr Productivity, $120/yr Professional, and the Vim Editor/extension detail — treat these as secondary-sourced, not primary-fetched, and worth a manual re-check if precision matters
- Logseq: https://logseq.com (fetched, positioning only) + third-party aggregators for pricing (costbench.com, aitoolpick.org) since no dedicated official pricing page was located — Logseq's own docs/GitHub confirm the core app is free/OSS with sync as a paid convenience layer, consistent with the aggregator figures
- Craft: https://www.craft.do/pricing (fetched)

### Deeper comparison: Standard Notes and Obsidian (closest architectural peers)

Both are named in the task as the closest comparisons because ADR 0002's shape — local storage as the universal base, server sync as the paid add-on — is exactly their model, not Notion/Craft's (cloud-first, local cache) or Apple/Bear's (OS-vendor sync bundled into a device subscription).

- **Obsidian**: local markdown files are the actual filesystem source of truth (not just IndexedDB inside a browser sandbox — real files a user can back up, grep, or move with `rsync`). Sync is purely a convenience feature bolted on for users who want it, priced per vault-count/storage/history tier. Obsidian's plugin ecosystem (thousands of community plugins) is arguably its actual moat, not sync. Directly relevant: Obsidian already has vim bindings baked in as a first-class setting, which undercuts "vim support" alone as rbnotes' differentiator against this specific competitor — rbnotes' differentiator against Obsidian has to be that vim is the *native, only* editing mode built around a real modal engine with its own command dock (`CONTEXT.md`), not a bolt-on toggle in a much larger, plugin-oriented app.
- **Standard Notes**: architecturally the closer match to rbnotes' actual paid/free split — a genuinely free, full-featured, E2E-encrypted, cross-device-synced base tier, with paid tiers unlocking *editors*, *themes*, *version history depth*, and *self-hosting*, not unlocking sync itself (sync is free even on Standard Notes' free tier, unlike rbnotes' current design where sync is exactly what login/paid is meant to gate per ADR 0002). Standard Notes also already sells a "Vim Editor" as one of its paid extensions — meaning even this closest architectural peer has *some* vim story, though it's an optional editor mode bolted onto a rich-text-first app, not the whole app's interaction model the way rbnotes is.

---

## 3. Synthesis — answering the three real questions

### How does rbnotes stand feature-for-feature and architecturally?

**Genuinely distinctive:** a real, whole-app modal vim engine (CodeMirror + `@replit/codemirror-vim`) as the *only* desktop editing mode, with a matching `:`-command dock, buffer/workspace vocabulary, and mobile fallback that deliberately drops modal editing rather than faking it — is rare. Of the seven competitors surveyed, only Obsidian ships true vim key bindings, and there it's an opt-in setting inside a much broader plugin-based app, not the app's identity. Standard Notes sells vim as one paid editor option among several. No competitor here treats vim as the primary, default, whole-product interaction model the way rbnotes' `CONTEXT.md` and editor code do. That is a real, narrow, and currently unclaimed position.

**Table stakes, already matched or exceeded elsewhere:** offline-first local storage as source of truth (Obsidian's entire model is stronger here — real files, not browser IndexedDB tied to one origin); markdown notes (universal across the list); link sharing (Standard Notes, Craft, Notion all have this, generally with more polish — public URLs, permissions, expiry); a free tier with no signup (Obsidian, Logseq go further — free with *no* server dependency ever, not just "local-only until you sign in"); soft-delete/tombstones and last-write-wins sync (Standard Notes and Obsidian Sync both already solve this at a more mature level, including actual conflict/version history UI that rbnotes' ADR 0002 explicitly defers). rbnotes has no plugin ecosystem, no themes system beyond what's in `rbnotes-theme.ts`, no mobile native app (mobile is a responsive web presentation), and no AI features (increasingly standard in Notion/Craft). Architecturally, rbnotes is executing a smaller, cleaner version of exactly what Obsidian and Standard Notes already do well and at scale — the honest read is "well-built implementation of a proven architecture pattern, with one real UI/interaction differentiator," not "novel architecture."

### What does having no billing/paywall implementation actually mean right now?

It is **not a blocker to getting users** — Logseq and Obsidian both prove a fully free (or free-with-optional-donation-tier) product is a completely viable way to build an audience before ever charging anyone, and both grew their user base for years before/alongside monetizing. rbnotes today is, in effect, a fully free product: any visitor can use Local-only mode with zero friction, and any visitor who signs in gets full sync for free too, since nothing in the code distinguishes a "should be paying" signed-in user from a free one.

What's concretely missing for ADR 0002's free/paid split to become real, in order of what would actually need building:
1. **A plan/entitlement field** — nothing on `Profile` (or elsewhere) currently records whether an account is free or paid; `prisma/schema.prisma` would need at minimum a `plan` enum or a separate `Subscription` model.
2. **A payment processor integration** — Stripe (or equivalent: Paddle, LemonSqueezy) is entirely absent; this is the actual "zero hits" finding from the grep. Needed: checkout flow, webhook handler to update entitlement on payment events, and a customer-portal link for cancellation/plan changes.
3. **Enforcement points** — server actions in `src/server/actions/notes.ts` and the sync scheduler described in the spec currently have no concept of "sync is a paid feature only" — the spec explicitly says "presence of a session is what determines Local-only vs. Synced — no separate signup/plan flag yet; billing enforcement is a later, separate concern" (`.scratch/offline-first-sync/spec.md`, Implementation Decisions). So today, free sign-in = free sync, permanently, until this is built.
4. **An upgrade flow / UI** — no pricing page (confirmed absent in `src/app/`), no upgrade CTA, no account-settings surface showing plan status.

None of this is large relative to the app's existing complexity — it's a well-understood, boring problem (Stripe Checkout + webhook + a boolean or enum) — but it is fully unbuilt, and given the deliberate "settle this later" language in the spec's own Out of Scope section, it doesn't look like an oversight so much as a correctly-sequenced deferral: get the storage architecture right first, decide monetization mechanics once there's usage data to decide with.

### How would this realistically gain even one user?

This is a **niche-first distribution problem, not a broad-market one**, and the niche is small, specific, and already congregates in known places — which is actually an advantage for a solo side project with zero marketing surface, because niche audiences respond to direct, ungimmicked technical posts far better than they respond to landing pages or pricing tables.

The target user is not "people who take notes." It's "people who already live in a terminal or Vim/Neovim and feel friction every time a notes app makes them reach for a mouse or learn yet another non-modal shortcut scheme." That is a real, findable, and vocal community:

- **r/vim and r/neovim** — a "Show and tell" or straightforward post ("I built a notes app with real vim bindings because nothing else had them natively") is exactly the kind of content these subreddits reward, especially with a live link and no signup wall to try it (rbnotes' Local-only mode is perfect for this — a stranger from Reddit can land on the Dashboard and start typing immediately, no account, per ADR 0002's design).
- **Hacker News "Show HN"** — the given differentiator (real modal vim engine, not "vim-inspired keybindings") is precisely the kind of specific, verifiable technical claim that survives HN's skepticism; vague "vim-inspired" claims get torn apart there, but `@replit/codemirror-vim` is checkable in the repo/bundle, which matters to that audience.
- **Vim/Neovim Discord and Matrix communities** — smaller, more direct, but the same audience; a plugin- or tool-sharing channel is a natural fit.
- **dev.to / a short technical writeup** — "why I built a notes app around CodeMirror's vim mode instead of a plugin" is a legitimate, narrow technical post that this specific audience searches for and shares.

The critical enabler already exists in the architecture: because Local-only mode requires no signup (ADR 0002, `CONTEXT.md`), the entire distribution motion can be "here's a link, it works instantly, no account" — which is the single lowest-friction pitch possible to a skeptical, signup-averse technical audience, and it's already built, not something that needs to be added first. The realistic first-user path is not a broad marketing push (there's currently no landing page to push people to anyway) — it's one honest, specific post in one of the four channels above, pointing at the app itself as the demo.

---

## Summary (for the requester)

rbnotes' one real, rare differentiator is a genuine whole-app modal vim engine (`@replit/codemirror-vim`) as the primary editing mode — something none of Notion, Apple Notes, Bear, Logseq, or Craft offer at all, and something even Obsidian and Standard Notes (the two closest architectural peers) only offer as an optional bolt-on inside a much bigger product, not as the product's identity. Everything else about rbnotes — offline-first local storage, markdown, link sharing, free/paid-by-sync — is solid execution of patterns Obsidian and Standard Notes already do at greater maturity, so the pitch has to lead with vim, not with architecture. There is no billing implementation anywhere in the codebase (confirmed by grep — zero hits for stripe/billing/subscription/payment/price), which is not a blocker to getting a first user since the app is fully usable and free today, but real monetization per ADR 0002 needs a plan/entitlement field, a Stripe-or-equivalent integration, enforcement in the sync path, and an upgrade UI — all currently and deliberately unbuilt. Getting a first user is a niche-distribution problem with an unusually clear channel: r/vim, r/neovim, Show HN, and vim/neovim Discord communities are where people who want exactly this already are, and the app's no-signup Local-only mode means the entire pitch can be "here's a link, try it now" with nothing else to build first.
