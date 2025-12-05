import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { PlaylistCore } from '@/core/types';

export interface PlaylistPickerProps {
  playlists: PlaylistCore[];
  selectedId: string | null;
  onSelect: (playlistId: string) => void;
  isLoading?: boolean;
}

export function PlaylistPicker({
  playlists,
  selectedId,
  onSelect,
  isLoading,
}: PlaylistPickerProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return playlists;
    }

    return playlists.filter((playlist) =>
      playlist.name.toLowerCase().includes(normalized),
    );
  }, [playlists, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            Spotify Playlists
          </h3>
          <p className="text-xs text-slate-400">
            Select one or more playlists to transfer.
          </p>
        </div>
        <input
          className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand"
          placeholder="Search…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-8 text-center text-sm text-slate-400">
          Loading playlists…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-8 text-center text-sm text-slate-400">
          {query ? 'No playlists match this search.' : 'No playlists available.'}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((playlist) => {
            const isSelected = playlist.id === selectedId;
            return (
              <li key={playlist.id}>
                <button
                  type="button"
                  onClick={() => onSelect(playlist.id)}
                  className={clsx(
                    'h-full w-full rounded-xl border px-4 py-4 text-left transition-colors',
                    isSelected
                      ? 'border-brand bg-brand/20 text-brand-foreground'
                      : 'border-slate-800 bg-slate-950/50 text-slate-100 hover:border-brand/50 hover:bg-slate-900/70',
                  )}
                >
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold tracking-tight">
                      {playlist.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {playlist.trackCount} tracks
                    </span>
                    {playlist.description ? (
                      <span className="line-clamp-2 text-xs text-slate-500">
                        {playlist.description}
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
