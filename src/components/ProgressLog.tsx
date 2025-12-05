import { Fragment } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

export type ProgressStatus = 'info' | 'success' | 'error';

export interface ProgressLogEntry {
  id: string;
  message: string;
  status: ProgressStatus;
  timestamp?: string;
}

export interface ProgressLogProps {
  entries: ProgressLogEntry[];
}

export function ProgressLog({ entries }: ProgressLogProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-6 text-sm text-slate-400">
        Progress updates will appear here during a transfer.
      </div>
    );
  }

  return (
    <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/40">
      <ul className="divide-y divide-slate-800 text-sm">
        {entries.map((entry, index) => (
          <Fragment key={entry.id}>
            <li className="flex items-start gap-3 px-4 py-3">
              <StatusIcon status={entry.status} />
              <div className="flex flex-col gap-1">
                <span className="text-slate-100">{entry.message}</span>
                {entry.timestamp ? (
                  <span className="text-xs text-slate-500">
                    {entry.timestamp}
                  </span>
                ) : null}
              </div>
            </li>
            {index === entries.length - 1 ? null : (
              <li className="sr-only" aria-hidden="true" />
            )}
          </Fragment>
        ))}
      </ul>
    </div>
  );
}

function StatusIcon({ status }: { status: ProgressStatus }) {
  if (status === 'success') {
    return (
      <CheckCircleIcon
        className="mt-0.5 h-5 w-5 text-emerald-400"
        aria-hidden="true"
      />
    );
  }

  if (status === 'error') {
    return (
      <ExclamationCircleIcon
        className="mt-0.5 h-5 w-5 text-rose-400"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={clsx(
        'mt-1 h-2 w-2 rounded-full',
        status === 'info' ? 'bg-slate-500' : 'bg-slate-600',
      )}
    />
  );
}
