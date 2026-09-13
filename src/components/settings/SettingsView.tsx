"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { persistSettings } from "@/lib/save-settings";
import { describeSettingsPatch } from "@/lib/format";
import { useSignOut } from "@/lib/use-sign-out";
import { useWorkspaceStore } from "@/lib/store";
import { StatusToast } from "@/components/auth/StatusToast";
import type { Settings } from "@/lib/schemas";

const THEME_OPTIONS: { value: Settings["theme"]; label: string }[] = [
  { value: "hacker", label: "Hacker" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

/**
 * A live preview, not a color name: the swatch itself carries
 * `data-theme={value}`, so it renders under that theme's own [data-theme]
 * CSS override (globals.css) and shows its real surface tone + accent
 * color -- zero hardcoded hex duplicated here, same "components only ever
 * read the CSS custom properties" rule the rest of the app already
 * follows. The button chrome around it (border, label) stays in the
 * *current* app theme's colors, not the swatch's own, so the selected
 * state reads consistently no matter which swatch it's on.
 */
function ThemeSwatch({
  value,
  label,
  selected,
  onSelect,
}: {
  value: Settings["theme"];
  label: string;
  selected: boolean;
  onSelect: (value: Settings["theme"]) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      className={`flex flex-col items-center gap-space-1 px-space-2 py-space-2 border transition-colors ${
        selected
          ? "border-primary bg-surface-container-high"
          : "border-outline-variant hover:border-outline"
      }`}
    >
      <span
        data-theme={value}
        className="w-12 h-8 rounded-sm border border-outline-variant/40 bg-surface-container relative overflow-hidden"
      >
        <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-primary" />
      </span>
      <span className="font-label-sm text-label-sm text-on-surface">{label}</span>
    </button>
  );
}

function SettingRow({
  label,
  shortcut,
  children,
}: {
  label: string;
  shortcut?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-space-4 py-space-3 border-b border-outline-variant/30 last:border-b-0 gap-space-4">
      <label className="flex items-center gap-space-1 font-label-sm text-label-sm text-on-surface flex-wrap">
        <span className="text-primary">&gt;</span> {label}
        {shortcut && (
          <span className="text-on-surface-variant bg-surface-container px-space-1 border border-outline-variant ml-space-2">
            {shortcut}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

export function SettingsView({ email }: { email: string | null }) {
  // Shared with every open note editor (WorkspaceBuffer) -- changing a
  // setting here is reflected there immediately, and vice versa, since
  // both read the exact same store instead of independently-fetched
  // copies of the same data.
  const settings = useWorkspaceStore((s) => s.settings);
  const syncEnabled = useWorkspaceStore((s) => s.syncEnabled);
  const updateStore = useWorkspaceStore((s) => s.updateSettings);
  const [saved, setSaved] = useState(true);
  const [notify, setNotify] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const signOut = useSignOut();

  // Editor preferences are a free-tier feature (ADR 0002) -- a Local-only
  // session persists them to localStorage instead of the server, same
  // branch WorkspaceBuffer's :set command takes.
  const update = (patch: Partial<Settings>) => {
    updateStore(patch);
    // Same confirmation text `:set` gives on the command line (describeSettingsPatch)
    // -- a checkbox flipping is visible feedback on its own, but the toast makes every
    // control (dropdown, number input, swatch) confirm consistently, matching `:set`.
    setNotify(describeSettingsPatch(patch));
    window.setTimeout(() => setNotify(null), 3000);
    const next = { ...settings, ...patch };
    if (!syncEnabled) {
      void persistSettings(next, false);
      return;
    }
    setSaved(false);
    startTransition(async () => {
      await persistSettings(next, true);
      setSaved(true);
    });
  };

  return (
    <div className="w-full max-w-2xl px-space-4 sm:px-space-8 py-space-6 flex flex-col gap-space-6">
      <div className="flex items-center justify-end">
        <span className="font-label-sm text-label-sm text-outline">
          {saved ? "[Saved]" : "[Saving...]"}
        </span>
      </div>

      <StatusToast message={notify} />

      <section className="bg-surface-container-high">
        <div className="px-space-4 py-space-2 font-label-sm text-label-sm text-outline uppercase tracking-wider border-b border-outline-variant/30">
          Appearance
        </div>
        <SettingRow label="theme">
          <div className="flex items-center gap-space-2">
            {THEME_OPTIONS.map((opt) => (
              <ThemeSwatch
                key={opt.value}
                value={opt.value}
                label={opt.label}
                selected={settings.theme === opt.value}
                onSelect={(theme) => update({ theme })}
              />
            ))}
          </div>
        </SettingRow>
      </section>

      <section className="bg-surface-container-high">
        <div className="px-space-4 py-space-2 font-label-sm text-label-sm text-outline uppercase tracking-wider border-b border-outline-variant/30">
          Editor
        </div>
        <SettingRow label="line numbers" shortcut="[:set nu|rnu]">
          <select
            value={settings.lineNumbers}
            onChange={(e) => update({ lineNumbers: e.target.value as Settings["lineNumbers"] })}
            className="bg-surface-container border border-outline-variant text-on-surface font-code-editor text-code-editor px-space-2 py-space-1 outline-none focus:border-primary"
          >
            <option value="off">off</option>
            <option value="absolute">absolute</option>
            <option value="hybrid">hybrid (relative)</option>
          </select>
        </SettingRow>
        <SettingRow label="tab size" shortcut="[:set ts=N]">
          <input
            type="number"
            min={1}
            max={8}
            value={settings.tabSize}
            onChange={(e) => update({ tabSize: Number(e.target.value) })}
            className="w-20 bg-surface-container border border-outline-variant text-on-surface font-code-editor text-code-editor px-space-2 py-space-1 outline-none focus:border-primary"
          />
        </SettingRow>
        <SettingRow label="word wrap" shortcut="[:set wrap]">
          <input
            type="checkbox"
            checked={settings.wordWrap}
            onChange={(e) => update({ wordWrap: e.target.checked })}
            className="accent-primary w-4 h-4 bg-surface-container border-outline-variant rounded-none"
          />
        </SettingRow>
        <SettingRow label="autosave">
          <input
            type="checkbox"
            checked={settings.autosave}
            onChange={(e) => update({ autosave: e.target.checked })}
            className="accent-primary w-4 h-4 bg-surface-container border-outline-variant rounded-none"
          />
        </SettingRow>
      </section>

      <section className="bg-surface-container-high">
        <div className="px-space-4 py-space-2 font-label-sm text-label-sm text-outline uppercase tracking-wider border-b border-outline-variant/30">
          Help
        </div>
        <SettingRow label="first-run tour">
          <button
            onClick={() => useWorkspaceStore.getState().setOnboardingOpen(true)}
            className="text-primary hover:underline font-label-md text-label-md"
          >
            Replay tour
          </button>
        </SettingRow>
      </section>

      {email ? (
        <section className="bg-surface-container-high">
          <div className="px-space-4 py-space-2 font-label-sm text-label-sm text-outline uppercase tracking-wider border-b border-outline-variant/30">
            Account
          </div>
          <SettingRow label="identity (email)">
            <span className="font-code-editor text-code-editor text-on-surface-variant">{email}</span>
          </SettingRow>
          <div className="px-space-4 py-space-3">
            <button
              onClick={signOut}
              className="px-space-3 py-space-2 bg-surface-container text-error border border-outline-variant hover:border-error font-label-md text-label-md transition-colors"
            >
              Sign out [:q!]
            </button>
          </div>
        </section>
      ) : (
        <section className="bg-surface-container-high">
          <div className="px-space-4 py-space-2 font-label-sm text-label-sm text-outline uppercase tracking-wider border-b border-outline-variant/30">
            Account
          </div>
          <div className="px-space-4 py-space-3 flex items-center justify-between gap-space-4">
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              Local only -- these preferences stay in this browser.
            </span>
            <Link href="/login" className="text-primary hover:underline font-label-md text-label-md">
              Sign in to sync
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
