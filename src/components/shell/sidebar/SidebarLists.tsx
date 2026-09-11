"use client";

import { useEffect, useRef, useState } from "react";
import { useNotesQuery } from "@/lib/notes-query";
import { useWorkspaceStore } from "@/lib/store";
import { SidebarTabs, type SidebarTab } from "@/components/shell/sidebar/SidebarTabs";
import { SidebarFilterInput } from "@/components/shell/sidebar/SidebarFilterInput";
import { SidebarBufferList } from "@/components/shell/sidebar/SidebarBufferList";
import { SidebarTagList } from "@/components/shell/sidebar/SidebarTagList";

/**
 * Owns the Buffers/Tags tab and the tag drill-down as plain local state --
 * never the store, never the URL. The sidebar never unmounts and nothing
 * outside it reads this, and the drill-down is explicitly ephemeral by
 * design (unlike buffer switching, which does live in history).
 */
export function SidebarLists() {
  const { data: notes = [] } = useNotesQuery();
  const [tab, setTab] = useState<SidebarTab>("buffers");
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const filterInputRef = useRef<HTMLInputElement>(null);
  const focusTagsRequestId = useWorkspaceStore((s) => s.focusTagsRequestId);
  const pendingTagFilter = useWorkspaceStore((s) => s.pendingTagFilter);
  const setPendingTagFilter = useWorkspaceStore((s) => s.setPendingTagFilter);

  // Ctrl+T (or a `#tag` pill clicked in-editor, which also names a tag):
  // jump straight to the Tags tab and focus its filter box, from anywhere
  // in the app. A pulse counter, not derived from `tab`/`filter` state, so
  // triggering it again re-focuses even if Tags is already active. Syncing
  // local UI state to an external signal (the store's counter) is exactly
  // what an effect is for; it can't be done during render since focusing an
  // element is inherently imperative.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (focusTagsRequestId === 0) return;
    setTab("tags");
    if (pendingTagFilter) {
      setFilter(pendingTagFilter);
      setExpandedTags(new Set([pendingTagFilter]));
      setPendingTagFilter(null);
    } else {
      setExpandedTags(new Set());
      setFilter("");
    }
    filterInputRef.current?.focus();
    // pendingTagFilter/setPendingTagFilter deliberately excluded: this
    // effect's whole job is reading-and-clearing that one-shot value when
    // focusTagsRequestId pulses, not re-running when the value it just
    // cleared changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTagsRequestId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function selectTab(next: SidebarTab) {
    setTab(next);
    setExpandedTags(new Set());
    setFilter("");
  }

  function toggleTag(tag: string) {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  const placeholder =
    tab === "tags"
      ? "type to filter tags, / to search everywhere"
      : "type to filter buffers, / to search everywhere";

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <SidebarTabs tab={tab} onSelect={selectTab} />
      <div className="px-space-3 pt-space-2 shrink-0">
        <SidebarFilterInput
          ref={filterInputRef}
          value={filter}
          onChange={setFilter}
          placeholder={placeholder}
        />
      </div>
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 overflow-y-auto px-space-3 py-space-2">
          {tab === "buffers" ? (
            <SidebarBufferList notes={notes} filter={filter} />
          ) : (
            <SidebarTagList
              notes={notes}
              filter={filter}
              expandedTags={expandedTags}
              onToggleTag={toggleTag}
            />
          )}
        </div>
      </div>
    </div>
  );
}
