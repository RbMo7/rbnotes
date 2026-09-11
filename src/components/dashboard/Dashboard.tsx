"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { pickRandomQuote, type Quote } from "@/lib/quotes";
import { signOutAction } from "@/server/actions/auth";
import { QuoteBanner } from "@/components/dashboard/QuoteBanner";
import { RecentNotesList } from "@/components/dashboard/RecentNotesList";
import { ShortcutCheatsheet } from "@/components/dashboard/ShortcutCheatsheet";
import { SidebarLists } from "@/components/shell/sidebar/SidebarLists";
import { LocalOnlyBadge } from "@/components/shell/LocalOnlyBadge";

/**
 * The landing screen (`/`), shown on every fresh load per CONTEXT.md's
 * Dashboard entry -- reached again anytime via the sidebar wordmark, never
 * mid-session (buffer switching never returns here).
 *
 * Below the mobile breakpoint this doubles as CONTEXT.md's List screen: the
 * sidebar's browse role (search, tags, every note) has nowhere else to live
 * on mobile since Sidebar itself is desktop-only there, so it's folded into
 * this same route instead of a separate screen or component tree.
 */
export function Dashboard({ email }: { email: string | null }) {
  const { createAndOpenNote } = useWorkspace();
  const isDesktop = useIsDesktop();
  // Picked client-side only, after mount: Math.random() during SSR and
  // again on the client's first render pick different quotes, which is a
  // hydration mismatch (server-rendered text != client text). Deferring to
  // an effect means the server (and the client's first render, before
  // hydration) render nothing here, and the real quote appears a tick
  // later -- never a mismatch, just a one-frame-later small text line.
  const [quote, setQuote] = useState<Quote | null>(null);
  useEffect(() => {
    setQuote(pickRandomQuote());
  }, []);

  if (isDesktop === false) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between gap-space-3 px-space-4 py-space-3 border-b border-outline-variant/20 shrink-0">
          <Link href="/" className="flex items-center gap-space-2">
            <Image src="/logo.svg" alt="RbNotes" width={28} height={28} className="h-7 w-auto" />
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
              RbNotes
            </span>
          </Link>
          <button
            onClick={createAndOpenNote}
            className="px-space-3 py-space-2 bg-primary text-on-primary font-label-md text-label-md rounded hover:bg-primary-fixed transition-colors"
          >
            + New note
          </button>
        </div>

        <div className="flex-1 min-h-0">
          <SidebarLists />
        </div>

        <div className="shrink-0 px-space-4 py-space-3 border-t border-outline-variant/20 flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
          {email ? (
            <>
              <span className="truncate max-w-[10rem]">{email}</span>
              <div className="flex items-center gap-space-3">
                <Link href="/settings" className="text-primary hover:underline">
                  settings
                </Link>
                <form action={signOutAction}>
                  <button type="submit" className="text-error hover:underline">
                    sign out
                  </button>
                </form>
              </div>
            </>
          ) : (
            <LocalOnlyBadge />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex items-start justify-center px-space-6 py-space-8">
      <div className="w-full max-w-2xl flex flex-col items-center gap-space-6">
        <div className="flex flex-col items-center gap-space-2">
          <Image src="/logo.svg" alt="RbNotes" width={40} height={40} className="h-10 w-auto" />
          {quote && <QuoteBanner quote={quote} />}
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
            {email ? (
              <>
                <span className="truncate max-w-[10rem]">{email}</span>
                <Link href="/settings" className="text-primary hover:underline">
                  settings
                </Link>
                <form action={signOutAction}>
                  <button type="submit" className="text-error hover:underline">
                    sign out
                  </button>
                </form>
              </>
            ) : (
              <LocalOnlyBadge />
            )}
          </div>
        </div>

        <ShortcutCheatsheet />
      </div>
    </div>
  );
}
