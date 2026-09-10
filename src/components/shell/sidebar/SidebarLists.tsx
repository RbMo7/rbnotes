"use client";

import { useState } from "react";
import { useNotesQuery } from "@/lib/notes-query";
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
  const [tag, setTag] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  function selectTab(next: SidebarTab) {
    setTab(next);
    setTag(null);
    setFilter("");
  }

  function selectTag(nextTag: string) {
    setTag(nextTag);
    setFilter("");
  }

  function backToTags() {
    setTag(null);
    setFilter("");
  }

  const placeholder =
    tab === "tags" && tag
      ? "type to filter files, / to search everywhere"
      : tab === "tags"
        ? "type to filter tags, / to search everywhere"
        : "type to filter buffers, / to search everywhere";

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <SidebarTabs tab={tab} onSelect={selectTab} />
      <div className="px-space-3 pt-space-2 shrink-0">
        <SidebarFilterInput value={filter} onChange={setFilter} placeholder={placeholder} />
      </div>
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 overflow-y-auto px-space-3 py-space-2">
          {tab === "buffers" ? (
            <SidebarBufferList notes={notes} filter={filter} />
          ) : (
            <SidebarTagList
              notes={notes}
              tag={tag}
              filter={filter}
              onSelectTag={selectTag}
              onBack={backToTags}
            />
          )}
        </div>
      </div>
    </div>
  );
}
