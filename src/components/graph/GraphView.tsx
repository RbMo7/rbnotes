"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { displayFilename } from "@/lib/format";
import { useNotesQuery } from "@/lib/notes-query";
import { buildNoteGraph } from "@/lib/graph";
import { GraphSkeleton } from "@/components/graph/GraphSkeleton";

const WIDTH = 900;
const HEIGHT = 600;

/**
 * Real view built from `[[wiki-links]]` and shared tags, rendered strictly
 * in the design's own visual language (1px outline-variant edges, zero
 * radius, no shadow) -- there is no GRAPH screen in Stitch to copy, so this
 * is derived rather than invented from scratch. Computed (useMemo, pure
 * JS) over the already-loaded notes-query cache -- opening this page
 * never fetches anything.
 */
export function GraphView() {
  // Deliberately not `data: allNotes = []` -- see TagsView for why (a
  // still-pending query must not look identical to "genuinely nothing to
  // graph yet").
  const { data: allNotes, isPending } = useNotesQuery();
  const { nodes, edges } = useMemo(() => buildNoteGraph(allNotes ?? []), [allNotes]);
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;
    const r = Math.min(WIDTH, HEIGHT) / 2 - 80;
    nodes.forEach((n, i) => {
      const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
      map.set(n.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    });
    return map;
  }, [nodes]);

  if (isPending) {
    return <GraphSkeleton />;
  }

  if (nodes.length === 0) {
    return (
      <div className="w-full px-space-8 pt-space-8 font-code-editor text-code-editor">
        <p className="text-on-surface-variant"># graph</p>
        <p className="text-outline/50 mt-space-2">
          ~ nothing to graph yet — link notes with [[Note Title]] or shared #tags
        </p>
      </div>
    );
  }

  return (
    <div className="w-full px-space-4 sm:px-space-8 py-space-6">
      <div className="bg-surface-container-high p-space-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto min-w-[600px]"
          role="img"
          aria-label="Note link graph"
        >
          {edges.map((e, i) => {
            const a = positions.get(e.source);
            const b = positions.get(e.target);
            if (!a || !b) return null;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--color-outline-variant)"
                strokeWidth={1}
              />
            );
          })}
          {nodes.map((n) => {
            const pos = positions.get(n.id);
            if (!pos) return null;
            const isHovered = hovered === n.id;
            return (
              <g
                key={n.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={() => router.push(`/notes/${n.id}`)}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer"
              >
                <circle
                  r={isHovered ? 7 : 5}
                  fill={isHovered ? "var(--color-primary)" : "var(--color-secondary)"}
                />
                <text
                  x={10}
                  y={4}
                  fontSize={12}
                  fontFamily="var(--font-jetbrains-mono)"
                  fill={isHovered ? "var(--color-on-surface)" : "var(--color-on-surface-variant)"}
                >
                  {displayFilename(n.title)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
