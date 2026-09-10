"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { pickRandomQuote } from "@/lib/quotes";
import { signOutAction } from "@/server/actions/auth";
import { QuoteBanner } from "@/components/dashboard/QuoteBanner";
import { RecentNotesList } from "@/components/dashboard/RecentNotesList";
import { ShortcutCheatsheet } from "@/components/dashboard/ShortcutCheatsheet";

/**
 * The landing screen (`/`), shown on every fresh load per CONTEXT.md's
 * Dashboard entry -- reached again anytime via the sidebar wordmark, never
 * mid-session (buffer switching never returns here).
 */
export function Dashboard({ email }: { email: string }) {
  const { createAndOpenNote } = useWorkspace();
  const quote = useMemo(() => pickRandomQuote(), []);

  return (
    <div className="min-h-full flex items-start justify-center px-space-6 py-space-8">
      <div className="w-full max-w-2xl flex flex-col items-center gap-space-6">
        <div className="flex flex-col items-center gap-space-2">
          <Image src="/logo.svg" alt="RbNotes" width={40} height={40} className="h-10 w-auto" />
          <QuoteBanner quote={quote} />
        </div>

        <RecentNotesList />

        <div className="w-full flex items-center justify-between gap-space-4 pt-space-2 border-t border-outline-variant/20">
          <button
            onClick={createAndOpenNote}
            className="flex items-center gap-space-2 px-space-3 py-space-2 bg-primary text-on-primary font-label-md text-label-md rounded hover:bg-primary-fixed transition-colors"
          >
            <span>+ New note</span>
            <span className="font-label-sm text-label-sm opacity-80">[^N]</span>
          </button>

          <div className="flex items-center gap-space-3 font-label-sm text-label-sm text-on-surface-variant">
            <span className="truncate max-w-[10rem]">{email}</span>
            <Link href="/settings" className="text-primary hover:underline">
              settings
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="text-error hover:underline">
                sign out
              </button>
            </form>
          </div>
        </div>

        <ShortcutCheatsheet />
      </div>
    </div>
  );
}
