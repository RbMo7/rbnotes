# Switchable themes: Hacker, Dark, Light

Status: ready-for-agent

## Problem Statement

The app has exactly one color theme today, hardcoded once under `@theme` in `globals.css`. The user likes it but finds the accent color (a bright neon green, `#4be277`, tinted through several neutral tokens too) too "hackery" and bright to feel professional. They also admire Standard Notes' calmer, more restrained color approach and want the option to switch toward something closer to that, without losing the app's current terminal identity as an available choice.

## Solution

Three named, switchable themes -- **Hacker** (the current theme, kept as an explicit choice but de-greened: a desaturated cyan accent replaces the neon green, and green-tinted neutrals become true cool grays), **Dark** (a new, calmer Standard-Notes-inspired dark theme built around a muted blue accent), and **Light** (a new Standard-Notes-inspired light theme, built substantially from Standard Notes' own verified published color values). All three are complete token sets for the same ~30 CSS custom properties the app already uses everywhere -- switching is a pure `data-theme` attribute change, no component-level styling changes. Hacker stays the default for anyone with no saved preference, preserving the app's identity on first impression; Dark and Light are opt-in. The choice is switchable from a new Settings row and a footer quick-toggle, and persists the same way every other editor preference already does (`localStorage` for Local-only sessions, the account's Profile row for Synced sessions).

## User Stories

1. As a user, I want to pick between Hacker, Dark, and Light themes, so that I can use the color scheme that feels right to me.
2. As a first-time visitor (no saved preference, Local-only or freshly registered), I want the app to open in the Hacker theme by default, so that the app's identity is unchanged for anyone who never touches this setting.
3. As a user who dislikes the current neon-green accent but still wants the terminal feel, I want the Hacker theme itself refreshed to a more restrained accent color, so that I don't have to switch away from the app's core identity just to escape one color.
4. As a user, I want to change my theme from a row in Settings, matching how every other editor preference already works there, so that theme selection feels like a normal setting, not a special case.
5. As a user, I want a quick-toggle in the sidebar footer to switch themes without opening Settings, so that trying a different theme is a one-click action.
6. As a user, I want my chosen theme to persist across reloads and sessions the same way my other preferences do (locally if I'm Local-only, synced to my account if I'm signed in), so that I don't have to re-pick it every visit.
7. As a signed-in user switching devices, I want my theme choice to travel with my account, so that I see the same theme everywhere I'm signed in.
8. As a user, I want every part of the UI -- editor chrome, sidebar, dashboard, settings, toasts, badges -- to respect the active theme consistently, so that no leftover hardcoded color breaks the illusion mid-app.
9. As a user, I do not want the app to auto-switch my theme based on my OS's light/dark preference, so that my explicit choice of one of the three themes is never silently overridden.

## Implementation Decisions

- **Three complete token sets**, specified in full (all ~30 `--color-*` tokens each) in `docs/research/theme-palette.md` §4 -- Hacker (§4.1), Dark (§4.2), Light (§4.3). Use those hex values verbatim; do not re-derive or re-pick colors.
- **Mechanism**: a `data-theme="hacker" | "dark" | "light"` attribute on a high-level root element (`<html>` or the app shell), with `[data-theme="hacker"] { --color-*: ...; }` (and `dark`, `light`) blocks in `globals.css` redefining the same custom properties currently declared once under the base `@theme` block. This is the same `data-<flag>` → `data-[flag=value]:` pattern already in production use in `Sidebar.tsx` (`data-collapsed`, `data-mobile-open`, `data-active`), applied to a CSS custom-property override instead of a Tailwind variant. No component-level changes are required or expected -- every component already reads colors exclusively through these variable-backed utility classes (confirmed: zero hardcoded hex values in `src/components/`).
- **Settings integration**: add `theme: z.enum(["hacker", "dark", "light"]).default("hacker")` to `settingsSchema` in `src/lib/schemas.ts`, in the same shape as the existing `lineNumbers` enum field. It rides the exact same persistence path already built for every other setting -- `saveSettingsAction` (Synced) / `saveLocalSettings` (Local-only) via `SettingsView.tsx`'s `update()` and `WorkspaceBuffer.tsx`'s `updateSettings`, hydrated by `SettingsHydrator.tsx`. No new persistence mechanism.
- **Applying the attribute**: whatever renders the app shell needs to set `data-theme` on the root element from the store's `settings.theme` value, reactively, so a change from either surface (Settings row or footer toggle) repaints immediately without a reload.
- **Settings row**: a new `<select>` row in `SettingsView.tsx`'s Editor section (or a new "Appearance" section), matching the existing `lineNumbers`/`tabSize` row pattern exactly -- label, shortcut hint if one is added, and a `<select>` calling `update({ theme: ... })`.
- **Footer quick-toggle**: a small control in the sidebar footer (`Sidebar.tsx`, the same row currently holding the Settings link / `LocalOnlyBadge`) that cycles or picks between the three themes without navigating to Settings. Exact visual form (cycling button vs. three small swatches/icons) is left to implementation judgment, but it must read as part of the existing terminal-voice UI language (bracket-command style, monospace labels), not a generic color-picker widget.
- **Default**: `hacker`, matching `settingsSchema`'s existing `.default(...)` convention -- no separate first-load logic needed beyond the schema default itself.
- **No OS `prefers-color-scheme` auto-detection.** Exactly three fixed, explicit choices; no "System" option, no `matchMedia` listener.
- **Naming**: display names are exactly "Hacker", "Dark", "Light" -- no invented/cute names.

## Testing Decisions

- This is primarily a CSS/data-driven feature with very little new logic to unit test -- the token sets themselves are declarative CSS, not testable business logic.
- The one genuinely testable piece is `settingsSchema` accepting/defaulting the new `theme` field correctly (parses `"hacker"`/`"dark"`/`"light"`, defaults to `"hacker"` when absent, rejects invalid values) -- extend whatever existing test coverage `settingsSchema`/`defaultSettings` has, or add a small one if none exists yet.
- If the "apply `data-theme` from settings" logic ends up as its own small function/hook (rather than inline JSX), that function is the natural seam: test that it sets the attribute to the current `settings.theme` value and updates it when the setting changes -- no DOM/CSS assertions needed, just that the attribute value tracks the store.
- No visual regression testing is expected or required for this spec.

## Out of Scope

- OS `prefers-color-scheme` auto-detection / a "System" theme option.
- Per-icon or per-category multi-color icon theming -- icons stay monochrome, inheriting the active theme's accent/neutral colors via `currentColor`, matching both the current codebase and Standard Notes' own icon approach.
- Formal WCAG contrast verification -- the token sets were eyeballed for reasonable contrast during research, not run through a contrast checker; revisit only if a real accessibility issue is reported.
- Any additional themes beyond these three.
- Editing/creating custom user-defined themes.

## Further Notes

- Full research, sourcing, and rationale for every color choice lives in `docs/research/theme-palette.md` -- read it before implementing, it has the exact hex values and the reasoning behind each.
- `docs/research/theme-palette.md` §2 is explicit about what could and couldn't be verified from Standard Notes' own primary sources (their archived StyleKit repo gave exact values for Light; their current live app's exact values were not accessible, so Dark's palette is built from SN's design philosophy rather than literal current SN hex codes) -- worth knowing if anyone later asks "is this exactly Standard Notes' palette."
