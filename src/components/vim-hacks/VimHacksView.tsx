"use client";

import { useState } from "react";
import {
  searchVimCombos,
  VIM_COMBO_INTENTS,
  type VimComboEntry,
  type VimComboCategory,
} from "@/components/overlay/vim-combo-intents";
import { ComboKeys } from "@/components/overlay/ComboKeys";

const CATEGORY_ORDER: VimComboCategory[] = [
  "Motion",
  "Count-Prefixed Motion",
  "Operator",
  "Text Object",
  "Operator + Text Object",
  "Operator + Motion",
  "Search Motion",
  "Marks & Registers",
  "Visual Mode",
  "Insert & Repeat",
];

function groupByCategory(entries: VimComboEntry[]): { category: VimComboCategory; entries: VimComboEntry[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    entries: entries.filter((e) => e.category === category),
  })).filter((group) => group.entries.length > 0);
}

function ComboRow({ entry }: { entry: VimComboEntry }) {
  return (
    <div className="flex items-center justify-between bg-surface-container px-space-2 py-space-1 gap-space-2 text-label-sm font-label-sm">
      <ComboKeys combo={entry.combo} />
      <span className="text-on-surface-variant text-right truncate">{entry.label}</span>
    </div>
  );
}

/**
 * The full Vim motion/operator/text-object reference `:cheat`'s "all vim
 * hacks ->" link points to -- deliberately a separate page, not folded into
 * the compact cheatsheet popup, so that stays small (docs/research/
 * vim-hacks-reference.md's explicit constraint). A route, not an overlay:
 * no Escape-to-close handling here, since a full page has no "close," only
 * "navigate elsewhere."
 */
export function VimHacksView() {
  const [query, setQuery] = useState("");
  const results = query.trim() ? searchVimCombos(query) : [];
  const groups = groupByCategory(VIM_COMBO_INTENTS);

  return (
    <div className="w-full max-w-3xl px-space-4 sm:px-space-8 py-space-6 flex flex-col gap-space-6">
      <h1 className="font-headline-md text-headline-md text-primary font-semibold"># vim-hacks.md</h1>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder='What do you want to do? (e.g. "delete inside quotes")'
        className="w-full bg-surface-container px-space-2 py-1 text-label-md font-label-md text-on-surface placeholder:text-on-surface-variant/60 outline-none border-none"
        autoFocus
      />

      {query.trim() && (
        <div className="flex flex-col gap-space-1">
          {results.map(({ entry }, i) => (
            <ComboRow key={`${entry.combo}-${entry.category}-${i}`} entry={entry} />
          ))}
          {results.length === 0 && (
            <div className="text-on-surface-variant/60 text-label-sm font-label-sm px-space-2 py-1">
              No matching combo
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-space-4" hidden={!!query.trim()}>
        {groups.map((group) => (
          <div key={group.category}>
            <div className="text-secondary font-bold text-body-sm mb-space-1">## {group.category}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-1">
              {group.entries.map((entry, i) => (
                <ComboRow key={`${entry.combo}-${entry.category}-${i}`} entry={entry} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
