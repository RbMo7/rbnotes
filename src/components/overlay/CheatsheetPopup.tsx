"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { SECTIONS } from "@/components/overlay/HelpBuffer";
import { RESPONSIVE_DIALOG_CONTENT } from "@/components/overlay/dialog-classes";
import { searchCheatsheet } from "@/components/overlay/command-intents";
import { searchVimCombos } from "@/components/overlay/vim-combo-intents";
import { ComboKeys } from "@/components/overlay/ComboKeys";

// Capped low: this popup is "a quick reference while still typing" (see its
// own doc comment below), not the full vim-hacks page -- a handful of the
// best combo matches is enough to point someone at "yes, /vim-hacks has
// what you want" without the compact popup's search results ballooning to
// the size of the full reference it's deliberately kept separate from.
const VIM_COMBO_RESULT_LIMIT = 5;

// Recomputing the search on every keystroke is cheap here (a few dozen
// rows), but debouncing still avoids the results list visibly flickering
// through every intermediate substring while typing at normal speed.
const SEARCH_DEBOUNCE_MS = 150;

/**
 * The footer's "Need help?" / `:cheat` popup -- a compact reference over
 * the same SECTIONS table HelpBuffer's full-screen `:help` uses, but global
 * (driven by the store, not WorkspaceBuffer-local state) so it opens from
 * the Dashboard too and stays usable as a live reference while typing,
 * unlike `:help` which owns the whole buffer.
 */
export function CheatsheetPopup() {
  const open = useWorkspaceStore((s) => s.cheatsheetOpen);
  const setOpen = useWorkspaceStore((s) => s.setCheatsheetOpen);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on every open, not just mount (same pattern CommandDock uses)
      setQuery("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDebouncedQuery("");
    }
  }, [open]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [query]);

  const searching = debouncedQuery.trim().length > 0;
  const results = searching ? searchCheatsheet(debouncedQuery, SECTIONS) : [];
  const vimResults = searching
    ? searchVimCombos(debouncedQuery, undefined, { limit: VIM_COMBO_RESULT_LIMIT })
    : [];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[60]" />
        <Dialog.Content
          className={`${RESPONSIVE_DIALOG_CONTENT} sm:max-w-2xl sm:max-h-[80vh] shadow-2xl`}
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between px-space-4 py-space-3 border-b border-outline-variant shrink-0">
            <Dialog.Title className="text-primary font-semibold"># cheatsheet.md</Dialog.Title>
            <div className="flex items-center gap-space-3">
              <Link
                href="/vim-hacks"
                className="text-label-sm font-label-sm text-secondary hover:text-primary underline underline-offset-2"
              >
                all vim hacks &rarr;
              </Link>
              <Dialog.Close aria-label="Close cheatsheet" className="text-on-surface-variant hover:text-on-surface">
                <X size={16} strokeWidth={1.5} />
              </Dialog.Close>
            </div>
          </div>
          <div className="px-space-4 py-space-2 border-b border-outline-variant shrink-0">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='What do you want to do? (e.g. "browse notes", "delete inside quotes")'
              className="w-full bg-surface-container px-space-2 py-1 text-label-md font-label-md text-on-surface placeholder:text-on-surface-variant/60 outline-none border-none"
              autoFocus
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-space-4 flex flex-col gap-space-4">
            {searching ? (
              <>
                {results.length > 0 && (
                  <div>
                    <div className="text-secondary font-bold text-body-sm mb-space-1">## commands</div>
                    <div className="flex flex-col gap-space-1">
                      {results.map((row) => (
                        <div
                          key={row.key}
                          className="flex items-center justify-between bg-surface-container px-space-2 py-space-1 gap-space-2 text-label-sm font-label-sm"
                        >
                          <span className="text-primary font-semibold shrink-0">{row.key}</span>
                          <span className="text-on-surface-variant text-right">{row.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {vimResults.length > 0 && (
                  <div>
                    <div className="text-secondary font-bold text-body-sm mb-space-1">## vim hacks</div>
                    <div className="flex flex-col gap-space-1">
                      {vimResults.map(({ entry }, i) => (
                        <div
                          key={`${entry.combo}-${entry.category}-${i}`}
                          className="flex items-center justify-between bg-surface-container px-space-2 py-space-1 gap-space-2 text-label-sm font-label-sm"
                        >
                          <ComboKeys combo={entry.combo} />
                          <span className="text-on-surface-variant text-right">{entry.label}</span>
                        </div>
                      ))}
                    </div>
                    <Link
                      href="/vim-hacks"
                      className="block mt-space-1 text-label-sm font-label-sm text-secondary hover:text-primary underline underline-offset-2"
                    >
                      all vim hacks &rarr;
                    </Link>
                  </div>
                )}
                {results.length === 0 && vimResults.length === 0 && query === debouncedQuery && (
                  <div className="text-on-surface-variant/60 text-label-sm font-label-sm px-space-2 py-1">
                    No matching command
                  </div>
                )}
              </>
            ) : (
              SECTIONS.map((section) => (
                <div key={section.title}>
                  <div className="text-secondary font-bold text-body-sm mb-space-1">
                    ## {section.title}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-1">
                    {section.keys.map(([key, desc]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between bg-surface-container px-space-2 py-space-1 gap-space-2 text-label-sm font-label-sm"
                      >
                        <span className="text-primary font-semibold shrink-0">{key}</span>
                        <span className="text-on-surface-variant text-right">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
