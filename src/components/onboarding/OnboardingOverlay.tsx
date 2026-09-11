"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronRight, ChevronLeft } from "lucide-react";

type Step = {
  file: string;
  title: string;
  body: string;
  demo: { label: string; detail: string }[];
};

// One card per pillar of the product, in the order a brand-new user should
// meet them: what this is, the editor's actual differentiator, the
// storage/pricing model, then how to drive it day-to-day. Kept to four --
// long enough to actually sell the app, short enough nobody clicks straight
// past it.
const STEPS: Step[] = [
  {
    file: "welcome.md",
    title: "Notes are buffers.",
    body: "RbNotes is a vim-flavored notes app -- every note is a buffer, and everything you see comes from one fast, local cache. No folders to manage, no menus to hunt through. Just open a buffer and start typing.",
    demo: [{ label: "+ New Note", detail: "^N -- create and start typing instantly" }],
  },
  {
    file: "editor.md",
    title: "Real modal Vim. Not a lookalike.",
    body: "On desktop, every note is edited by a genuine Vim engine: hjkl motions, dd/yy/p, visual mode, undo/redo, the works. Prefer plain typing? Mobile drops the modal engine entirely -- same buffer, a simpler surface.",
    demo: [
      { label: "hjkl", detail: "move" },
      { label: "dd / yy / p", detail: "delete / yank / paste" },
      { label: "i / Esc", detail: "insert / normal" },
    ],
  },
  {
    file: "storage.md",
    title: "Local-first. Sync is the add-on.",
    body: "Every keystroke saves straight to this browser -- free, no account, nothing to lose if you're offline. Sign in anytime and the same notes start pushing to the server too, readable from any device. Signing in never changes how you edit.",
    demo: [{ label: "Local-only", detail: "default, zero setup" }, { label: "Synced", detail: "sign in to add" }],
  },
  {
    file: "commands.md",
    title: "Everything's a command.",
    body: "Press : to save, rename, pin, share, or open settings -- just like real Vim's command line. Forgot one? :cheat (or “Need help?” in the footer) opens a quick reference without leaving your buffer.",
    demo: [
      { label: ":w", detail: "save" },
      { label: ":pin", detail: "pin this note" },
      { label: ":cheat", detail: "open the cheatsheet" },
    ],
  },
];

export function OnboardingOverlay({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const current = STEPS[step];

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onFinish();
      else if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        setStep((s) => (s === STEPS.length - 1 ? s : s + 1));
        if (last) onFinish();
      } else if (e.key === "ArrowLeft") {
        setStep((s) => Math.max(0, s - 1));
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [last, onFinish]);

  return (
    <div className="fixed inset-0 z-[70] bg-surface-container-lowest flex flex-col font-code-editor text-code-editor [animation:rbnotes-boot-rise_260ms_ease-out]">
      <div className="flex items-center justify-between px-space-6 py-space-4 border-b border-outline-variant shrink-0">
        <span className="text-primary font-semibold"># {current.file}</span>
        <button
          onClick={onFinish}
          className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
        >
          [Esc] skip
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center px-space-6 py-space-8">
        {/* Keyed on the step itself so switching cards re-triggers the rise
            -- a cheap crossfade with zero extra state. */}
        <div
          key={current.file}
          className="w-full max-w-xl flex flex-col items-center gap-space-6 text-center [animation:rbnotes-boot-rise_320ms_ease-out]"
        >
          <Image src="/logo.svg" alt="RbNotes" width={48} height={48} className="h-12 w-auto" />

          <div className="flex flex-col gap-space-3">
            <h1 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              {current.title}
            </h1>
            <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">
              {current.body}
            </p>
          </div>

          <div className="w-full flex flex-wrap items-center justify-center gap-space-2">
            {current.demo.map((d) => (
              <span
                key={d.label}
                className="flex items-center gap-space-2 bg-surface-container px-space-3 py-space-2 rounded border border-outline-variant/40"
              >
                <span className="text-primary font-semibold text-label-md">{d.label}</span>
                <span className="text-outline text-label-sm">{d.detail}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 px-space-6 py-space-4 border-t border-outline-variant flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-space-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface disabled:opacity-0 disabled:pointer-events-none"
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
          Back
        </button>

        <div className="flex items-center gap-space-2" role="tablist" aria-label="Onboarding progress">
          {STEPS.map((s, i) => (
            <button
              key={s.file}
              role="tab"
              aria-selected={i === step}
              aria-label={`Step ${i + 1}: ${s.title}`}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-primary" : "w-1.5 bg-outline-variant hover:bg-outline"
              }`}
            />
          ))}
        </div>

        {last ? (
          <button
            onClick={onFinish}
            className="px-space-4 py-space-2 bg-primary text-on-primary font-label-md text-label-md rounded hover:bg-primary-fixed transition-colors"
          >
            Get started
          </button>
        ) : (
          <button
            onClick={() => setStep((s) => s + 1)}
            className="flex items-center gap-space-1 font-label-md text-label-md text-primary hover:opacity-80"
          >
            Next
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}
