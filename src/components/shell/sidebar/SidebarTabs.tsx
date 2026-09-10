"use client";

export type SidebarTab = "buffers" | "tags";

export function SidebarTabs({
  tab,
  onSelect,
}: {
  tab: SidebarTab;
  onSelect: (tab: SidebarTab) => void;
}) {
  return (
    <div
      role="tablist"
      onClick={(e) => e.stopPropagation()}
      className="flex px-space-3 pt-space-2 gap-space-1 shrink-0"
    >
      {(["buffers", "tags"] as const).map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={tab === t}
          onClick={() => onSelect(t)}
          className={`flex-1 px-space-2 py-space-1 font-label-md text-label-md rounded uppercase tracking-wider transition-colors ${
            tab === t
              ? "bg-surface-container-high text-on-surface"
              : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
          }`}
        >
          {t === "buffers" ? "Buffers" : "Tags"}
        </button>
      ))}
    </div>
  );
}
