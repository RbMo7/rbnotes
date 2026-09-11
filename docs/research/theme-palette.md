# Theme palette research: Hacker / Dark / Light

Date: 2026-09-11
Author: research pass (Claude), requested to (a) recommend a replacement accent for the current "too green/hackery" theme (renamed "Hacker") and (b) design two new Standard-Notes-inspired themes ("Dark", "Light"), using the exact `--color-*` custom property names already defined in `src/app/globals.css`.

> Placement note: following the convention set by `docs/research/market-position.md`, this file lives in `docs/research/`.

---

## 1. Baseline: how rbnotes' color system actually works

Confirmed by reading `src/app/globals.css` (lines 1–90) and spot-checking components:

- Every color in the app is one of ~30 Material-Design-3-shaped custom properties defined once under `@theme` (`--color-surface`, `--color-on-surface`, `--color-primary`, etc.), consumed exclusively via Tailwind utility classes (`bg-surface`, `text-on-surface`, `text-primary`, …). `grep -rEn "#[0-9a-fA-F]{3,8}" src/components` turns up **zero** hardcoded hex colors in component code — the one hit was a hex value inside a code comment in `src/components/overlay/QuickSwitcher.tsx`, not live styling. This confirms the task's premise: adding themes is a pure CSS-variable-swap problem, zero component changes required.
- Icons are `lucide-react` (`package.json`: `"lucide-react": "^1.43.0"`), rendered as monochrome strokes that inherit `currentColor` from surrounding text-color utilities — there is no separate icon-color system. A single accent hue driving all icon tinting (via `text-primary`/`text-on-surface-variant` etc. on icon wrappers) is therefore the only lever available, matching how Standard Notes itself does icon coloring (see §2).
- The codebase already has a `data-<flag>={boolean}` → `data-[<flag>=true]:` Tailwind styling convention in active use, e.g. `src/components/shell/Sidebar.tsx`:
  - `data-collapsed={collapsed}`, `data-mobile-open={mobileOpen}` on the sidebar root, consumed by classes like `max-lg:data-[mobile-open=true]:translate-x-0`
  - `data-active={pathname === "/settings"}` consumed by `data-[active=true]:text-on-surface`
  This is the same shape a `data-theme="hacker"|"dark"|"light"` root attribute + `[data-theme="x"] { --color-*: ... }` blocks would take — see §4.

---

## 2. Standard Notes' actual palette and icon approach — from primary sources

**What I could verify with exact values (primary source):**

Standard Notes' official CSS theming library, `StyleKit` (github.com/standardnotes/StyleKit — **archived June 9, 2022**, so this reflects their theming foundation rather than a live snapshot of today's app, but it is the only place SN has publicly shipped literal hex values for their design tokens). `src/css/main.scss` defines these `--sn-stylekit-*` custom properties (this is the **light/"Default"** theme's values — StyleKit ships light as the base, with dark and other themes as override files layered on the same variable names, exactly like this project's own `[data-theme]` plan):

| Token | Hex | Role |
|---|---|---|
| `--sn-stylekit-background-color` | `#ffffff` | app background |
| `--sn-stylekit-foreground-color` | `#000000` | primary text |
| `--sn-stylekit-contrast-background-color` | `#f6f6f6` | secondary/panel background |
| `--sn-stylekit-contrast-foreground-color` | `#2e2e2e` | secondary text |
| `--sn-stylekit-border-color` | `#dfe1e4` | hairline borders |
| `--sn-stylekit-neutral-color` | `#989898` | neutral icon/text |
| `--sn-stylekit-info-color` | `#086DD6` | **primary accent / links / info** |
| `--sn-stylekit-info-color-darkened` | `#065cb5` | accent hover/pressed |
| `--sn-stylekit-success-color` | `#007662` | success (muted teal-green, not neon) |
| `--sn-stylekit-warning-color` | `#EBAD00` | warning (amber, not saturated yellow) |
| `--sn-stylekit-danger-color` | `#cc2128` | danger (brick red, not neon red) |
| `--sn-stylekit-paragraph-text-color` | `#454545` | body copy |
| `--sn-stylekit-input-placeholder-color` | `#a8a8a8` | placeholder text |

Source: `https://github.com/standardnotes/StyleKit/blob/main/src/css/main.scss` (fetched directly).

**Key takeaway for the accent question:** Standard Notes' own reference accent is a **desaturated, mid-toned cool blue (`#086DD6`)** — not a saturated "brand blue," not a neon color of any kind. Every semantic color in their system (info, success, warning, danger) is pulled down in saturation relative to what you'd see in a typical SaaS or "hacker" neon palette. This is the clearest primary-source signal of their design philosophy: **restraint over saturation**. This directly informs the "professional, not neon" ask for the Hacker theme's accent (§3).

**What I could not verify with exact current values:** Standard Notes' present-day web app (the `standardnotes/app` monorepo) has superseded the archived StyleKit with its own internal design tokens; I was not able to pull literal current hex values for the live dark/light app chrome via search or fetch (GitHub file browsing for the current monorepo's theme package returned no accessible directory listing, and `standardnotes.com/features` returned HTTP 403 to automated fetch). **I'm reporting this gap explicitly rather than inventing numbers.** What's well-established from long-standing public knowledge of the product (screenshots, its own historical theme names, and the StyleKit foundation it grew from) rather than a specific fetched source:
- Standard Notes' theme names have included **Default, Dark, Focused, Titanium, Futura, Midnight, Autobiography, Carbon**, and (from the current search results) **Solarized Dark** among community/first-party options; "Default" (light) and "Dark" are the two first-party baseline themes with paid-tier themes layered on top per `standardnotes.com/help/plugins/themes`.
- SN's dark theme is a **cool neutral gray-black** (not warm/brown-black, not pure `#000000`) — consistent with the StyleKit base using true `#ffffff`/`#000000` as light-mode endpoints rather than tinted neutrals, which is the opposite instinct from this project's current green-tinted `on-surface-variant`/`outline` (`#bccbb9`/`#869585`/`#3d4a3d`).
- **Icon coloring is single-accent, not per-category multicolor**: Standard Notes uses plain monochrome icons (their in-app icon set, like this project's `lucide-react`) that inherit the theme's foreground/accent color rather than assigning each note-type or menu icon its own hue. This is the same "icons inherit `currentColor`" model rbnotes already uses — good news, it means no icon-system rework is implied by adding themes, only variable values change.

**Bottom line for this project:** treat the StyleKit numbers above as a *directionally authoritative but dated* reference for what "restrained SN-style color" looks like (muted blue accent, true neutral grays, desaturated semantic colors), and build the two new themes (§3.2, §3.3) around that philosophy rather than trying to replicate an unverifiable current palette exactly.

---

## 3. Recommended accent for "Hacker" — research and pick

### What other well-regarded terminal/hacker-identity tools use for accent

Long-standing, well-regarded terminal color schemes and "hacker aesthetic" brand identities converge on a fairly narrow set of accent families, and almost none of them use a neon `#4be277`-style green as their *primary* accent — green in terminal palettes is conventionally reserved as **ANSI green** (one of 16 slots, used for specific semantic meaning like "success"/"diff added"), not as the single dominant brand/UI accent:

- **Solarized** (Ethan Schoonover's palette, arguably the single most widely adopted "serious terminal user" color scheme) uses a muted **cyan** (`#2aa198`) and **blue** (`#268bd2`) as its most-used accents; its green (`#859900`) is deliberately olive/desaturated, not neon.
- **Dracula** (extremely popular dark theme across terminals/editors) centers on **purple** (`#bd93f9`) and **cyan** (`#8be9fd`) as primary accents, with green (`#50fa7b`) present but used as one of several equal-weight semantic colors, not the sole brand hue.
- **Nord** (another widely adopted "calm, professional" terminal palette) is built almost entirely around **cool blues** (`#88c0d0`, `#81a1c1`, `#5e81ac`) — frequently praised specifically for reading as "muted," "Arctic," and "professional" rather than flashy.
- **GitHub's own dark-mode/terminal-adjacent branding** and most "hacker" CLI tool identities (e.g. classic `htop`, `neofetch` default schemes, Matrix-adjacent aesthetics people actually keep using daily rather than screenshot once) skew toward **cyan** as the "reads as technical/terminal but not gaudy" choice — cyan carries the "phosphor/CRT" and "matrix-glyph" hacker association without green's strong "neon/toy" connotation that `#4be277` has.
- **1Password, Vercel, Linear, and other "professional dark-mode-first" tools** — a different reference class but relevant to "professional" — consistently choose **desaturated blue or blue-violet** accents over saturated green or neon colors for exactly the same reason the user is flagging: saturated green reads as either "eco-brand" or "script-kiddie neon," rarely as "serious tool."

### Recommendation: **desaturated cyan**, `#5ec8c8`-family (specifically `#4bd0d0` for `primary`)

A muted cyan is the best fit because it:
1. **Keeps the terminal/hacker identity intact** — cyan is one of the 8 base ANSI colors and is the accent most associated with CRT phosphor / classic terminal aesthetics (the "green-on-black" trope's closest respectable cousin), so the Hacker theme doesn't lose its genre.
2. **Reads as professional, not neon**, when desaturated and value-matched to sit comfortably against the existing near-black surfaces — same move Solarized, Nord, and Dracula all make (accent color, but pulled down in saturation/lightness from a pure/neon version).
3. **Directly solves the "too green" complaint** without introducing an unrelated hue family (blue/purple would abandon the terminal identity harder than cyan does) — cyan is legible as a *refinement* of the current choice, not a replacement of the whole vibe.
4. **Is distinct from both new themes' accents** (§3.2 uses a cooler indigo-blue, §3.3 a similar but lighter/less saturated blue), so all three themes stay visually distinguishable from each other at a glance.

This also lets me directly resolve the request to replace the green-tinted neutrals (`on-surface-variant` `#bccbb9`, `outline` `#869585`, `outline-variant` `#3d4a3d`) — swap their green tint for a neutral cool gray so only `primary` and its immediate family (`primary-container`, `primary-fixed*`, `surface-tint`, `inverse-primary`) carry a hue at all, which is itself a "more professional" move (restrained UIs put color in as few places as possible).

---

## 4. Three complete token sets

All three use the exact `@theme` variable names from `src/app/globals.css` (I've dropped the `--color-` prefix here since that's constant; use it verbatim in the actual CSS). Rationale is inline; contrast was eyeballed against WCAG AA text-size assumptions (≥4.5:1 for body text pairs like on-surface/surface, ≥3:1 for large text/UI elements) — not run through a formal checker, per the task's scope.

### 4.1 Hacker (rename of current; de-greened, cyan accent)

```
surface:                        #121416
surface-dim:                    #121416
surface-bright:                 #38393c
surface-container-lowest:       #0c0e10
surface-container-low:          #1a1c1e
surface-container:              #1e2022
surface-container-high:         #282a2c
surface-container-highest:      #333537
surface-variant:                #333537

on-surface:                     #e2e2e5
on-surface-variant:             #a8b0b0   /* was green-tinted #bccbb9; now neutral cool gray */
inverse-surface:                #e2e2e5
inverse-on-surface:             #2f3133

outline:                        #85918f   /* was green-tinted #869585; now neutral gray-green removed */
outline-variant:                #3a4142   /* was green-tinted #3d4a3d; now neutral dark gray */

primary:                        #4bd0d0   /* was neon green #4be277 — desaturated cyan, terminal/ANSI-cyan lineage */
on-primary:                     #003636
primary-container:              #1f9e9e
on-primary-container:           #d8f7f7
primary-fixed:                  #7ee5e5
primary-fixed-dim:              #4bd0d0
on-primary-fixed:               #002020
on-primary-fixed-variant:       #0a5050
inverse-primary:                #0a7a7a
surface-tint:                   #4bd0d0

secondary:                      #b9c8de   /* unchanged — already a calm cool blue-grey, keep */
on-secondary:                   #233143
secondary-container:            #39485a
on-secondary-container:         #a7b6cc
secondary-fixed:                #d4e4fa
secondary-fixed-dim:            #b9c8de
on-secondary-fixed:             #0d1c2d
on-secondary-fixed-variant:     #39485a

tertiary:                       #ffb5ab   /* unchanged — coral, distinct from new cyan primary, still reads fine */
on-tertiary:                    #60130d
tertiary-container:             #ff8b7c
on-tertiary-container:          #76231b
tertiary-fixed:                 #ffdad5
tertiary-fixed-dim:             #ffb4a9
on-tertiary-fixed:              #410001
on-tertiary-fixed-variant:      #7f2a21

error:                          #ffb4ab
on-error:                       #690005
error-container:                #93000a
on-error-container:             #ffdad6

background:                     #121416
on-background:                  #e2e2e5
```

**Accent rationale:** `#4bd0d0` is a desaturated cyan pulled to a value/chroma that sits comfortably (not glaring) against `#121416` — same design move Solarized/Nord/Dracula all make on their accent colors. It keeps the ANSI-terminal color identity (cyan is a base ANSI hue, strongly associated with classic terminal/CRT aesthetics) while reading as restrained rather than neon, directly answering "more professional." The former green tint is scrubbed from every neutral token (`on-surface-variant`, `outline`, `outline-variant`) so color now lives only in the primary family, which is itself part of what makes an accent read as deliberate rather than accidental.

### 4.2 Dark (new — Standard-Notes-inspired, calmer/less "terminal")

Philosophy: true cool-neutral grays (not warm, not tinted), SN's own reference accent family (muted blue, per StyleKit's `#086DD6` info color, warmed slightly for use as a full "brand" primary rather than a link color), noticeably calmer/lower-contrast than Hacker's black-and-cyan look. No monospace-terminal association should leak in from tokens — that association lives in `--font-*`, which is out of scope here.

```
surface:                        #1c1e22
surface-dim:                    #1c1e22
surface-bright:                 #3d4048
surface-container-lowest:       #16181b
surface-container-low:          #212327
surface-container:              #25272c
surface-container-high:         #2f3237
surface-container-highest:      #3a3d43

surface-variant:                #3a3d43
on-surface:                     #e6e7ea
on-surface-variant:             #a9adb6

inverse-surface:                #e6e7ea
inverse-on-surface:             #2a2c31

outline:                        #82868f
outline-variant:                #45484f

primary:                        #5b9df0   /* muted, mid-saturation blue — SN's own info/accent lineage */
on-primary:                     #052a52
primary-container:              #1e5fb5
on-primary-container:           #d8e6fb
primary-fixed:                  #a9c9f7
primary-fixed-dim:              #5b9df0
on-primary-fixed:               #051c38
on-primary-fixed-variant:       #0c3f7d
inverse-primary:                #1b5aab
surface-tint:                   #5b9df0

secondary:                      #9aa8bb
on-secondary:                   #212c38
secondary-container:            #37414f
on-secondary-container:         #c3cddb
secondary-fixed:                #d3dce8
secondary-fixed-dim:            #9aa8bb
on-secondary-fixed:             #10171f
on-secondary-fixed-variant:     #37414f

tertiary:                       #9fd6c4   /* muted teal-green — echoes SN's success color, used sparingly as tertiary */
on-tertiary:                    #08362a
tertiary-container:             #1f7f65
on-tertiary-container:          #d4f3e9
tertiary-fixed:                 #c4ecdf
tertiary-fixed-dim:             #9fd6c4
on-tertiary-fixed:              #06251d
on-tertiary-fixed-variant:      #17604b

error:                          #ef9a95   /* pulled toward SN's brick-red danger (#cc2128) family, lightened for dark bg */
on-error:                       #5c0e0c
error-container:                #a33531
on-error-container:             #fbdedc

background:                     #1c1e22
on-background:                  #e6e7ea
```

**Accent rationale:** `#5b9df0` sits directly in the family of Standard Notes' own verified accent (`#086DD6`, lightened/desaturated slightly for comfortable use on dark backgrounds — SN's own `#086DD6` was authored for a *light* background and is too saturated/dark to use as-is against near-black). Neutrals are true cool grays with no green or warm cast, distinguishing this from Hacker's blacker, more clinical surfaces — Dark is meant to feel like a calm productivity app, not a terminal.

### 4.3 Light (new — Standard-Notes-inspired light theme)

Philosophy: SN's own verified light-mode values are the direct template here (`#ffffff` background, `#000000`/`#2e2e2e` text, `#dfe1e4` borders, `#086DD6` accent) — this is the one theme where I can build almost directly off cited primary-source numbers rather than inference.

```
surface:                        #ffffff
surface-dim:                    #e3e4e6
surface-bright:                 #ffffff
surface-container-lowest:       #ffffff
surface-container-low:          #f6f6f7   /* matches SN's contrast-background-color #f6f6f6 */
surface-container:              #f0f1f2
surface-container-high:         #e9eaec
surface-container-highest:      #e2e3e5

surface-variant:                #e2e3e5
on-surface:                     #1c1c1e   /* near SN's foreground #000000, softened slightly to avoid harsh pure-black-on-white */
on-surface-variant:             #46474a   /* matches SN's contrast-foreground-color #2e2e2e family */

inverse-surface:                #1c1c1e
inverse-on-surface:             #f2f2f3

outline:                        #797a7d
outline-variant:                #dfe1e4   /* matches SN's border-color #dfe1e4 exactly */

primary:                        #086dd6   /* SN's verified StyleKit info/accent color, used as-is */
on-primary:                     #ffffff
primary-container:              #d9e9fc
on-primary-container:           #063d78
primary-fixed:                  #d9e9fc
primary-fixed-dim:              #a9cdf6
on-primary-fixed:               #052a52
on-primary-fixed-variant:       #065cb5   /* SN's info-color-darkened, used verbatim */
inverse-primary:                #9cc6f5
surface-tint:                   #086dd6

secondary:                      #46617f
on-secondary:                   #ffffff
secondary-container:            #d6e3f0
on-secondary-container:         #294059
secondary-fixed:                #d6e3f0
secondary-fixed-dim:            #a9c1d8
on-secondary-fixed:             #16283b
on-secondary-fixed-variant:     #33495f

tertiary:                       #007662   /* SN's verified StyleKit success color, used as-is */
on-tertiary:                    #ffffff
tertiary-container:             #d3f0e8
on-tertiary-container:          #00483b
tertiary-fixed:                 #d3f0e8
tertiary-fixed-dim:             #4fae9a
on-tertiary-fixed:              #002e25
on-tertiary-fixed-variant:      #00594a

error:                          #cc2128   /* SN's verified StyleKit danger color, used as-is */
on-error:                       #ffffff
error-container:                #fcdedc
on-error-container:             #7d1013

background:                     #ffffff
on-background:                  #1c1c1e
```

**Accent rationale:** `primary` (`#086dd6`), `tertiary` (`#007662`), and `error` (`#cc2128`) are taken **verbatim** from Standard Notes' verified StyleKit values — this is the one theme where the palette isn't inferred but directly sourced. `outline-variant` (`#dfe1e4`) likewise matches SN's cited border color exactly. This makes Light the theme with the strongest, most defensible claim to being "Standard-Notes-inspired."

---

## 5. Implementation note (research only — no code written)

The mechanism should be exactly what the task frames it as: a `data-theme="hacker" | "dark" | "light"` attribute on a high-level root element (e.g. `<html>` or the app shell), with three `[data-theme="hacker"] { --color-*: ...; }` (etc.) blocks in `globals.css` redefining the same ~30 custom properties currently declared once under `@theme`. This is the same `data-<flag>` → `[data-flag=value]:` pattern already in production use in `src/components/shell/Sidebar.tsx` (`data-collapsed`, `data-mobile-open`, `data-active`, consumed via Tailwind's `data-[...]:` variant) — just applied to a CSS-variable override block instead of a Tailwind utility variant, and living at the CSS layer rather than per-component, since every component already reads colors exclusively through these variable-backed utility classes. Because zero components reference raw hex values (confirmed in §1), no component-level changes are implied by adding themes — this really is purely a `globals.css` + one root attribute change, plus wiring the attribute's value to state.

For that state: `src/lib/schemas.ts`'s `settingsSchema` (Zod, currently `lineNumbers` / `tabSize` / `wordWrap` / `autosave` / `sidebarCollapsed`, all with `.default(...)`) and `src/lib/local-settings.ts` (plain `localStorage` read/write keyed `"rbnotes-settings"`, parsed through the same schema) are the existing pattern a `theme: z.enum(["hacker", "dark", "light"]).default("hacker")` field fits directly into — same shape as the existing enum field `lineNumbers`. Since `local-settings.ts`'s own comment notes settings are deliberately **not** routed through the heavier Local-store/IndexedDB sync machinery (the offline-first note-sync story described in `docs/adr/0002-offline-first-local-storage.md`), the same "Local-only localStorage, or server-synced for signed-in users" split that already exists for other settings fields should extend to `theme` with no new persistence mechanism needed — whatever code path currently loads/saves `lineNumbers` etc. is the same path `theme` rides on. Actually wiring the `data-theme` attribute to this setting (likely a small provider/effect near the app root, or a server-rendered attribute if settings are known at render time) is implementation work for the next step, not covered here.
