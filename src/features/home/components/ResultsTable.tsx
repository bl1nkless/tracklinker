import { memo, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import type { MatchRow } from "@/components/MatchTable";

const DEFAULT_HEIGHT = 480;
const ESTIMATED_ITEM_SIZE = 100;
const VIRTUALIZATION_THRESHOLD = 200;

interface ResultsTableProps {
  rows: MatchRow[];
  height?: number;
}

function RowContent({ row }: { row: MatchRow }) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-slate-100">{row.title}</span>
        <span className="text-xs text-slate-400">
          {row.artists.join(", ")}
        </span>
      </div>

      <div className="flex flex-col gap-1 text-xs text-slate-300">
        {row.targetTitle ? (
          <>
            {row.targetUrl ? (
              <a
                href={row.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand hover:underline"
              >
                {row.targetTitle}
              </a>
            ) : (
              <span className="font-medium">{row.targetTitle}</span>
            )}
            <span className="text-slate-500">
              {row.official ? "Official / Topic · " : ""}
              {row.channelTitle ?? "Unknown channel"}
            </span>
            <span className="text-slate-500">
              {[
                row.via ? `via ${row.via}` : null,
                typeof row.score === "number"
                  ? `score ${(row.score * 100).toFixed(0)}%`
                  : null,
                row.durationMs !== undefined
                  ? formatDuration(row.durationMs, row.durationDeltaMs)
                  : null,
                row.matchedBy ? `matched by ${row.matchedBy}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {row.reasons?.length ? (
              <span className="text-slate-500">
                {row.reasons.join(" · ")}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-slate-500">
            Awaiting manual selection
          </span>
        )}
        {row.note ? <span className="text-amber-300">{row.note}</span> : null}
      </div>

      <div>
        <span
          className={clsx(
            "inline-flex rounded-full px-3 py-1 text-xs font-medium",
            row.status === "matched" &&
              "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40",
            row.status === "manual" &&
              "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/40",
            row.status === "pending" &&
              "bg-slate-800/80 text-slate-300 ring-1 ring-slate-600"
          )}
        >
          {row.status === "matched"
            ? "Ready"
            : row.status === "manual"
            ? "Needs review"
            : "Pending"}
        </span>
      </div>
    </>
  );
}

const MemoRowContent = memo(RowContent);

export function ResultsTable({
  rows,
  height = DEFAULT_HEIGHT,
}: ResultsTableProps) {
  const shouldVirtualize = rows.length > VIRTUALIZATION_THRESHOLD;
  const data = useMemo(() => rows, [rows]);

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-6 text-center text-sm text-slate-400">
        No matches yet. Run the mapper to see results.
      </div>
    );
  }

  if (!shouldVirtualize) {
    return (
      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-col justify-center gap-2 border-b border-slate-800 bg-slate-950/40 px-4 py-4 text-sm text-slate-200 last:border-b-0"
          >
            <MemoRowContent row={row} />
          </div>
        ))}
      </div>
    );
  }

  const parentRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ITEM_SIZE,
    overscan: 8,
  });

  return (
    <div
      ref={parentRef}
      className="overflow-y-auto rounded-2xl border border-slate-800"
      style={{ height }}
    >
      <div
        className="relative w-full"
        style={{ height: rowVirtualizer.getTotalSize() }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = data[virtualRow.index];
          return (
            <div
              key={row.id}
              className="absolute left-0 right-0 flex flex-col justify-center gap-2 border-b border-slate-800 bg-slate-950/40 px-4 py-4 text-sm text-slate-200"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <MemoRowContent row={row} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(durationMs: number, deltaMs?: number) {
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.round((durationMs % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  let label = `duration ${minutes}:${seconds}`;
  if (deltaMs !== undefined) {
    const deltaSeconds = deltaMs / 1000;
    const sign = deltaSeconds > 0 ? "+" : "";
    label += ` (${sign}${deltaSeconds.toFixed(1)}s)`;
  }
  return label;
}
