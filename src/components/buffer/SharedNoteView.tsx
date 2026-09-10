"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Editor } from "@/components/editor/Editor";
import { BufferFileChipStrip } from "@/components/buffer/BufferFileChipStrip";
import { StatusBar } from "@/components/shell/StatusBar";
import { useWorkspaceStore } from "@/lib/store";
import { defaultSettings } from "@/lib/schemas";
import { displayFilename, shortHash } from "@/lib/format";

/**
 * `/s/[token]` -- a note shared publicly-but-signed-in-only (see build plan
 * §9a). Reuses the Command-mode screen's file-chip strip verbatim (it
 * already has an RO badge and a sync indicator, which is exactly what a
 * read-only shared buffer needs) rather than inventing a new header.
 */
export function SharedNoteView({
  title,
  content,
  ownerEmail,
  updatedAt,
}: {
  title: string;
  content: string;
  ownerEmail: string;
  updatedAt: Date;
}) {
  const setMode = useWorkspaceStore((s) => s.setMode);
  const setActiveFilename = useWorkspaceStore((s) => s.setActiveFilename);

  useEffect(() => {
    setMode("RO");
    setActiveFilename(displayFilename(title));
    return () => setActiveFilename(null);
  }, [title, setMode, setActiveFilename]);

  const sizeKb = new TextEncoder().encode(content).length / 1024;
  const tokenCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="min-h-screen flex flex-col pb-status-bar-height">
      <header className="h-14 px-space-6 border-b border-outline-variant/30 flex items-center justify-between shrink-0 bg-surface-container-low">
        <div className="flex items-center gap-space-2">
          <Image src="/logo.svg" alt="RbNotes" width={28} height={28} className="h-7 w-auto" />
          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
            RbNotes
          </span>
        </div>
        <div className="flex items-center gap-space-4 font-label-sm text-label-sm text-on-surface-variant">
          <span>shared by {ownerEmail}</span>
          <Link href="/notes" className="text-primary hover:underline">
            ← your notes
          </Link>
        </div>
      </header>

      <main className="flex-1 px-space-4 sm:px-space-8 py-space-4 flex flex-col">
        <BufferFileChipStrip
          title={title}
          sizeKb={sizeKb}
          tokenCount={tokenCount}
          hash={shortHash(content)}
          synced
          readOnly
        />
        <div className="flex-1 min-h-[400px] mt-space-4 bg-surface-dim rounded-lg overflow-hidden">
          <Editor
            initialContent={content}
            settings={defaultSettings}
            vimEnabled={false}
            readOnly
          />
        </div>
        <p className="mt-space-2 font-label-sm text-label-sm text-outline">
          last updated {updatedAt.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
        </p>
      </main>

      <StatusBar filename={displayFilename(title)} />
    </div>
  );
}
