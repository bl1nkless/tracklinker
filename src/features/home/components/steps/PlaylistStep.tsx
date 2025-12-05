import { PlaylistPicker } from "@/components/PlaylistPicker";
import type { PlaylistCore } from "@/core/types";

export interface PlaylistStepProps {
  playlists: PlaylistCore[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  error?: Error | null;
}

export function PlaylistStep({
  playlists,
  selectedId,
  onSelect,
  loading,
  error,
}: PlaylistStepProps) {
  return (
    <section className="surface p-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-100">Плейлист</h2>
        <p className="text-sm text-slate-400">
          Выберите плейлист Spotify, который хотите перенести.
        </p>
      </header>

      <div className="mt-4">
        <PlaylistPicker
          playlists={playlists}
          selectedId={selectedId}
          onSelect={onSelect}
          isLoading={loading}
        />
        {error ? (
          <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error.message}
          </div>
        ) : null}
      </div>
    </section>
  );
}
