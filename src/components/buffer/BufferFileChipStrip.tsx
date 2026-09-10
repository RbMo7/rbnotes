import { FileText } from "lucide-react";
import { displayFilename } from "@/lib/format";

/**
 * The Command-mode Stitch screen's file-chip strip. Reused verbatim as the
 * header for a read-only shared note (`/s/[token]`, with `readOnly`), which
 * needs exactly this vocabulary -- RO, size, hash, sync status.
 */
export function BufferFileChipStrip({
  title,
  sizeKb,
  tokenCount,
  hash,
  synced,
  readOnly = false,
}: {
  title: string;
  sizeKb: number;
  tokenCount: number;
  hash: string;
  synced: boolean;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center justify-between bg-surface-container-low px-space-4 py-space-2 text-on-surface-variant text-label-md font-label-md flex-wrap gap-space-2">
      <div className="flex items-center gap-space-3 flex-wrap">
        <span className="flex items-center gap-space-1 text-on-surface font-semibold">
          <FileText size={15} strokeWidth={1.5} className="text-primary" />
          {displayFilename(title)}
        </span>
        {readOnly && (
          <span className="bg-surface-container-high text-outline px-space-2 py-0.5 text-label-sm font-label-sm">
            RO
          </span>
        )}
        <span className="text-outline text-label-sm font-label-sm">
          {sizeKb.toFixed(1)} KB
        </span>
        <span className="text-outline text-label-sm font-label-sm">tokens: {tokenCount}</span>
      </div>
      <div className="flex items-center gap-space-4">
        <span className="text-outline text-label-sm font-label-sm">hash: {hash}</span>
        <span
          className={`flex items-center gap-space-1 text-label-sm font-label-sm ${
            synced ? "text-primary" : "text-outline"
          }`}
        >
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              synced ? "bg-primary animate-pulse" : "bg-outline"
            }`}
          />
          {synced ? "SYNCHRONIZED" : "PENDING"}
        </span>
      </div>
    </div>
  );
}
