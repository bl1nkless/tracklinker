import { Fragment } from 'react';
import clsx from 'clsx';
import type { ProviderSearchResult } from '@/core/types';

export interface ManualMatchItem {
  trackId: string;
  title: string;
  artists: string[];
  note?: string;
  candidates: ProviderSearchResult[];
  selectedCandidateId?: string | null;
}

export interface ManualMatchEditorProps {
  items: ManualMatchItem[];
  values: Record<string, string>;
  errors?: Record<string, string | undefined>;
  savingId?: string | null;
  onValueChange: (trackId: string, value: string) => void;
  onSubmit: (trackId: string) => void;
  onCandidateSelect: (
    trackId: string,
    candidate: ProviderSearchResult,
  ) => void;
}

export function ManualMatchEditor({
  items,
  values,
  errors = {},
  savingId,
  onValueChange,
  onSubmit,
  onCandidateSelect,
}: ManualMatchEditorProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-6 text-sm text-slate-400">
        Все треки сопоставлены. При необходимости вы можете вручную заменить
        найденные соответствия в таблице выше.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {items.map((item) => {
        const value = values[item.trackId] ?? '';
        const error = errors[item.trackId];
        const isSaving = savingId === item.trackId;

        return (
          <div
            key={item.trackId}
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 shadow-sm shadow-slate-950/40"
          >
            <div className="flex flex-col gap-3">
              <header>
                <p className="text-sm font-semibold text-slate-100">
                  {item.title}
                </p>
                <p className="text-xs text-slate-400">
                  {item.artists.join(', ')}
                </p>
                {item.note ? (
                  <p className="mt-1 text-xs text-amber-300">{item.note}</p>
                ) : null}
              </header>

              {item.candidates.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    Предлагаемые результаты поиска
                  </p>
                  <ul className="space-y-2">
                    {item.candidates.map((candidate) => {
                      const active = item.selectedCandidateId === candidate.id;
                      const scorePercent = Math.round(
                        (candidate.score ?? 0) * 100,
                      );
                      return (
                        <li
                          key={candidate.id}
                          className={clsx(
                            'rounded-lg border px-4 py-3 text-sm transition',
                            active
                              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-100'
                              : 'border-slate-800 bg-slate-950/50 text-slate-100 hover:border-brand/40 hover:bg-slate-900/60',
                          )}
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold">
                                  {candidate.title ?? 'Без названия'}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {candidate.channelTitle ?? 'Неизвестный канал'}
                                  {candidate.official
                                    ? ' • Official / Topic'
                                    : ''}
                                </p>
                              </div>
                              <span className="text-xs font-semibold text-slate-300">
                                {scorePercent}%
                              </span>
                            </div>
                            <CandidateMeta candidate={candidate} />
                            <button
                              type="button"
                              onClick={() => onCandidateSelect(item.trackId, candidate)}
                              className={clsx(
                                'mt-2 inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand',
                                active
                                  ? 'bg-emerald-500 text-emerald-950 shadow shadow-emerald-500/40'
                                  : 'border border-slate-700 bg-slate-900/60 text-slate-200 hover:border-brand/60',
                              )}
                              disabled={isSaving}
                            >
                              {active ? 'Выбрано' : 'Выбрать'}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Нет подходящих кандидатов из поиска — вставьте ссылку вручную.
                </p>
              )}

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                  Ручное сопоставление
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={value}
                    onChange={(event) =>
                      onValueChange(item.trackId, event.target.value)
                    }
                    placeholder="Вставьте YouTube URL или videoId"
                    className={clsx(
                      'w-full rounded-lg border px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand',
                      error
                        ? 'border-rose-500/70 bg-rose-500/10'
                        : 'border-slate-700 bg-slate-900/60',
                    )}
                    disabled={isSaving}
                  />
                  <button
                    type="button"
                    onClick={() => onSubmit(item.trackId)}
                    disabled={isSaving || !value.trim()}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground shadow shadow-brand/30 transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? 'Сохраняем…' : 'Сохранить'}
                  </button>
                </div>
                {error ? (
                  <p className="text-xs text-rose-300">{error}</p>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CandidateMeta({ candidate }: { candidate: ProviderSearchResult }) {
  const rows: Array<{ label: string; value: string }> = [];

  if (candidate.durationMs !== undefined) {
    const minutes = Math.floor(candidate.durationMs / 60000);
    const seconds = Math.round((candidate.durationMs % 60000) / 1000)
      .toString()
      .padStart(2, '0');
    let durationLabel = `${minutes}:${seconds}`;
    if (candidate.durationDeltaMs !== undefined) {
      const delta = candidate.durationDeltaMs;
      const direction = delta > 0 ? '+' : '';
      durationLabel += ` (${direction}${(delta / 1000).toFixed(1)}s)`;
    }
    rows.push({ label: 'Длительность', value: durationLabel });
  }

  if (candidate.reasons?.length) {
    rows.push({
      label: 'Факторы',
      value: candidate.reasons.join(' · '),
    });
  }

  if (candidate.url) {
    rows.push({
      label: 'Ссылка',
      value: candidate.url,
    });
  }

  return (
    <dl className="grid gap-1 text-xs text-slate-400">
      {rows.map((row) => (
        <Fragment key={`${candidate.id}-${row.label}`}>
          <dt className="font-medium text-slate-500">{row.label}</dt>
          {row.label === 'Ссылка' ? (
            <dd>
              <a
                className="text-brand hover:underline"
                href={candidate.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {candidate.url}
              </a>
            </dd>
          ) : (
            <dd>{row.value}</dd>
          )}
        </Fragment>
      ))}
    </dl>
  );
}
