"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { noteHref, parseNoteIdFromPath } from "@/components/workspace/note-path";

/**
 * Buffer switching bypasses next/navigation entirely and talks to the
 * History API directly -- this is the ADR-0001 decision: a router.push
 * transition (even to a page that does no data fetching) still round-trips
 * Next's router and can still show its loading boundary, which is the
 * "near-zero, not zero" friction the rebuild specifically rejects. `open()`
 * pushes a real history entry so the browser's own Back/Forward walks
 * buffers; a `popstate` listener is this module's only way to observe them.
 *
 * Next's app-router also listens for `popstate` (to reconcile its own
 * route tree) -- since we never call its `router.push`/`replace` for a
 * buffer switch, a `popstate` landing on a URL it never navigated to may
 * cause it to do a harmless, invisible background RSC fetch for that
 * segment. That fetch can't be observed or avoided from here; it's inert
 * because nothing on this page reads its result (note content lives
 * entirely in the TanStack Query cache, untouched by it), and it always
 * loses the race to this listener's own synchronous state update, which is
 * what the user actually sees.
 *
 * `usePathname()` (Next's own, reactive) is used only as a fallback and a
 * self-healing signal: it reflects genuine Next-driven navigations (a hard
 * load, an un-converted `<Link>`, returning from a different app section)
 * that this hook didn't originate itself. `lastSelfHrefRef` is how it tells
 * "a navigation I caused" apart from "a navigation something else caused" --
 * only the latter resets `switchedId` so the displayed buffer re-derives
 * from the URL Next now reports.
 */
export function useWorkspaceNav() {
  const pathname = usePathname();
  // Tri-state: `undefined` = "defer to the URL", `null` = "explicitly no
  // note" (e.g. the last note was just deleted), a string = a real id.
  // Collapsing the first two to a plain `string | null` would make
  // "explicitly empty" indistinguishable from "not yet resolved".
  const [switchedId, setSwitchedId] = useState<string | null | undefined>(undefined);
  const lastSelfHrefRef = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === lastSelfHrefRef.current) return;
    setSwitchedId(undefined);
  }, [pathname]);

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const state = event.state as { noteId?: string } | null;
      const id = state?.noteId ?? parseNoteIdFromPath(window.location.pathname);
      lastSelfHrefRef.current = window.location.pathname;
      setSwitchedId(id);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /** A real buffer switch: pushes a new history entry so Back can return here. */
  const open = useCallback((noteId: string) => {
    const href = noteHref(noteId);
    lastSelfHrefRef.current = href;
    window.history.pushState({ noteId }, "", href);
    setSwitchedId(noteId);
  }, []);

  /**
   * Resolving to a specific buffer with no history entry of its own -- a
   * `replaceState` (not `push`) so Back from that buffer exits the
   * workspace/section instead of bouncing through a transitional entry.
   * Used for bare `/notes` home resolution and for landing on the next
   * buffer after the active one closes.
   */
  const settle = useCallback((noteId: string) => {
    const href = noteHref(noteId);
    lastSelfHrefRef.current = href;
    window.history.replaceState({ noteId }, "", href);
    setSwitchedId(noteId);
  }, []);

  return {
    activeNoteId: switchedId === undefined ? parseNoteIdFromPath(pathname) : switchedId,
    open,
    settle,
  };
}
