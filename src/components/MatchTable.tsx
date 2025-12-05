import clsx from 'clsx';

export type MatchStatus = 'matched' | 'manual' | 'pending';

export interface MatchRow {
  id: string;
  title: string;
  artists: string[];
  status: MatchStatus;
  via?: string;
  score?: number;
  targetTitle?: string;
  targetUrl?: string;
  channelTitle?: string;
  durationMs?: number;
  durationDeltaMs?: number;
  reasons?: string[];
  official?: boolean;
  matchedBy?: string;
  note?: string;
}

export interface MatchTableProps {
  rows: MatchRow[];
}

export function MatchTable({ rows }: MatchTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-6 text-center text-sm text-slate-400">
        No matches yet. Run the mapper to see results.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" className="px-4 py-3 text-left">
              Source Track
            </th>
            <th scope="col" className="px-4 py-3 text-left">
              Match
            </th>
            <th scope="col" className="px-4 py-3 text-left">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-950/40">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-100">
                    {row.title}
                  </span>
                  <span className="text-xs text-slate-400">
                    {row.artists.join(', ')}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
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
                        {row.official ? 'Official / Topic · ' : ''}
                        {row.channelTitle ?? 'Unknown channel'}
                      </span>
                      <MatchMeta
                        via={row.via}
                        score={row.score}
                        durationMs={row.durationMs}
                        durationDeltaMs={row.durationDeltaMs}
                        matchedBy={row.matchedBy}
                      />
                      {row.reasons?.length ? (
                        <span className="text-slate-500">
                          {row.reasons.join(' · ')}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">
                      Awaiting manual selection
                    </span>
                  )}
                  {row.note ? (
                    <span className="text-amber-300">{row.note}</span>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3">
                <span
                  className={clsx(
                    'inline-flex rounded-full px-3 py-1 text-xs font-medium',
                    row.status === 'matched' &&
                      'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40',
                    row.status === 'manual' &&
                      'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/40',
                    row.status === 'pending' &&
                      'bg-slate-800/80 text-slate-300 ring-1 ring-slate-600',
                  )}
                >
                  {row.status === 'matched'
                    ? 'Ready'
                    : row.status === 'manual'
                      ? 'Needs review'
                      : 'Pending'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchMeta({
  via,
  score,
  durationMs,
  durationDeltaMs,
  matchedBy,
}: {
  via?: string;
  score?: number;
  durationMs?: number;
  durationDeltaMs?: number;
  matchedBy?: string;
}) {
  const chips: string[] = [];
  if (via) {
    chips.push(`via ${via}`);
  }
  if (typeof score === 'number') {
    chips.push(`score ${(score * 100).toFixed(0)}%`);
  }
  if (durationMs !== undefined) {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.round((durationMs % 60000) / 1000)
      .toString()
      .padStart(2, '0');
    let label = `${minutes}:${seconds}`;
    if (durationDeltaMs !== undefined) {
      const deltaSeconds = durationDeltaMs / 1000;
      const sign = deltaSeconds > 0 ? '+' : '';
      label += ` (${sign}${deltaSeconds.toFixed(1)}s)`;
    }
    chips.push(`duration ${label}`);
  }
  if (matchedBy) {
    chips.push(`matched by ${matchedBy}`);
  }

  if (!chips.length) {
    return null;
  }

  return <span className="text-slate-500">{chips.join(' · ')}</span>;
}
