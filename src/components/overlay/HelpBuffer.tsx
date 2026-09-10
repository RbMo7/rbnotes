"use client";

import { useEffect } from "react";

const SECTIONS: { title: string; keys: [string, string][] }[] = [
  {
    title: "NORMAL",
    keys: [
      ["h j k l", "move left/down/up/right"],
      ["w / b / e", "next word / back word / end word"],
      ["0 / $", "start / end of line"],
      ["gg / G", "top / bottom of buffer"],
      ["dd / yy / p", "delete / yank / paste line"],
      ["u / Ctrl-r", "undo / redo"],
      ["/", "search"],
      [":", "command line"],
    ],
  },
  {
    title: "INSERT",
    keys: [
      ["i / a", "insert before / after cursor"],
      ["o / O", "open line below / above"],
      ["Esc", "return to NORMAL"],
    ],
  },
  {
    title: "VISUAL",
    keys: [
      ["v / V", "character-wise / line-wise select"],
    ],
  },
  {
    title: "COMMAND",
    keys: [
      [":w", "save"],
      [":q", "close inspector/help if open"],
      [":wq", "save and leave"],
      [":new", "create note"],
      [":rename <title>", "rename note"],
      [":delete", "archive note (:delete! deletes)"],
      [":share / :unshare", "create or revoke share link"],
      [":set nu|rnu|wrap|ts=N", "editor display options"],
      [":insp", "toggle inspector"],
      [":b", "toggle sidebar"],
    ],
  },
  {
    title: "GLOBAL",
    keys: [
      ["Ctrl+N", "new note"],
      ["Ctrl+P", "quick switcher"],
      ["Ctrl+S", "force write"],
      ["Ctrl+B", "toggle sidebar"],
      ["/", "search (outside editor)"],
    ],
  },
];

export function HelpBuffer({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-20 bg-surface-container-lowest overflow-y-auto">
      <div className="flex items-center justify-between px-space-6 py-space-4 border-b border-outline-variant bg-surface-container-low">
        <span className="font-headline-sm text-headline-sm text-primary font-semibold"># help.md</span>
        <button
          onClick={onClose}
          className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
        >
          [Esc] close
        </button>
      </div>
      <div className="p-space-6 flex flex-col gap-space-6 font-code-editor text-code-editor max-w-3xl">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="text-secondary font-bold mb-space-2">## {section.title}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-2">
              {section.keys.map(([key, desc]) => (
                <div
                  key={key}
                  className="flex items-center justify-between bg-surface-container px-space-3 py-space-2 gap-space-3"
                >
                  <span className="text-primary font-semibold shrink-0">{key}</span>
                  <span className="text-on-surface-variant text-body-sm font-body-sm text-right">
                    {desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
