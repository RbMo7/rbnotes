"use client";

import { forwardRef, type KeyboardEvent } from "react";
import { useWorkspaceStore } from "@/lib/store";

/**
 * One box, two behaviors: plain typing filters whatever list is currently
 * frontmost (the caller decides that), and a leading `/` switches it into
 * global-search mode -- Enter there opens SearchPalette seeded with the
 * text after the slash, rather than filtering in place.
 *
 * Forwards its ref to the underlying `<input>` so SidebarLists can focus it
 * imperatively (Ctrl+T's "open tags, focus search").
 */
export const SidebarFilterInput = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  }
>(function SidebarFilterInput({ value, onChange, placeholder }, ref) {
  const openSearchWith = useWorkspaceStore((s) => s.openSearchWith);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || !value.startsWith("/")) return;
    const query = value.slice(1);
    if (!query) return;
    e.preventDefault();
    openSearchWith(query);
  }

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      placeholder={placeholder}
      aria-label="Filter or search"
      className="w-full px-space-3 py-space-2 bg-surface-container text-on-surface font-label-md text-label-md rounded border border-outline-variant/40 placeholder-on-surface-variant/50 outline-none focus:border-primary transition-colors"
    />
  );
});
