"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Archive } from "lucide-react";
import { formatSidebarTimestamp } from "@/lib/grouping";
import { displayFilename } from "@/lib/format";

export function NoteListItem({
  id,
  title,
  updatedAt,
  archived,
}: {
  id: string;
  title: string;
  updatedAt: Date;
  archived: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === `/notes/${id}`;
  const Icon = archived ? Archive : FileText;

  return (
    <Link
      href={`/notes/${id}`}
      data-active={active}
      className="w-full flex items-center justify-between px-space-2 py-space-1 font-body-sm text-body-sm rounded group data-[active=true]:bg-surface-container-high data-[active=true]:text-on-surface data-[active=true]:font-medium data-[active=true]:border-l-2 data-[active=true]:border-primary text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
    >
      <span className="flex items-center gap-space-2 truncate">
        <Icon
          size={14}
          strokeWidth={1.5}
          className="text-outline group-hover:text-primary shrink-0"
        />
        <span className="truncate">{displayFilename(title)}</span>
      </span>
      <span className="font-label-sm text-label-sm text-outline/70 shrink-0">
        {formatSidebarTimestamp(updatedAt)}
      </span>
    </Link>
  );
}
