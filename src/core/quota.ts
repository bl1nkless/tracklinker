export const YOUTUBE_DEFAULT_DAILY_QUOTA = 10_000;

export const YOUTUBE_COSTS = {
  searchList: 100,
  playlistInsert: 50,
  playlistItemInsert: 50,
  videosList: 1,
} as const;

export interface QuotaState {
  dailyLimit: number;
  usedToday: number;
  reservedUnits?: number;
}

export interface QuotaEstimate {
  remainingUnits: number;
  maxInserts: number;
  willExceed: boolean;
}

export function estimateYouTubeInsertCapacity(
  state: QuotaState,
  opts: { includePlaylistCreation?: boolean } = {},
): QuotaEstimate {
  const reservedUnits = opts.includePlaylistCreation
    ? YOUTUBE_COSTS.playlistInsert
    : state.reservedUnits ?? 0;

  const remainingUnits = Math.max(
    0,
    state.dailyLimit - state.usedToday - reservedUnits,
  );

  const maxInserts = Math.floor(
    remainingUnits / YOUTUBE_COSTS.playlistItemInsert,
  );

  return {
    remainingUnits,
    maxInserts,
    willExceed: maxInserts <= 0,
  };
}
