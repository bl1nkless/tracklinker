export type ProviderId = 'spotify' | 'youtube';

export interface TrackCore {
  id: string;
  isrc?: string;
  title: string;
  artists: string[];
  album?: string;
  durationMs?: number;
  explicit?: boolean;
  year?: number;
  url?: string;
}

export interface PlaylistCore {
  id: string;
  name: string;
  description?: string;
  trackCount: number;
  ownerName?: string;
  snapshotId?: string;
}

export interface ProviderSearchOptions {
  durationMs?: number;
  isrc?: string;
  preferredChannelIds?: string[];
}

export interface ProviderSearchResult {
  id: string;
  score: number;
  title?: string;
  channelId?: string;
  channelTitle?: string;
  durationMs?: number;
  url?: string;
  matchedBy?: 'odesli' | 'duration' | 'string' | 'manual' | 'official' | 'preferred';
  durationDeltaMs?: number;
  reasons?: string[];
  official?: boolean;
}

export interface MusicProviderAuthContext {
  token?: string;
  expiresAt?: number;
  scopes?: string[];
}

export interface MusicProvider {
  id: ProviderId;
  auth(interactive?: boolean): Promise<MusicProviderAuthContext>;
  listPlaylists(): Promise<PlaylistCore[]>;
  listTracks(playlistId: string): Promise<TrackCore[]>;
  search(
    query: string,
    opts?: ProviderSearchOptions,
  ): Promise<ProviderSearchResult[]>;
  createPlaylist(name: string, description?: string): Promise<string>;
  addTracks(playlistId: string, trackIds: string[]): Promise<void>;
}

export interface TrackMatchRecord {
  source: {
    provider: ProviderId;
    trackId: string;
  };
  target?: {
    provider: ProviderId;
    trackId: string;
  };
  score: number;
  decidedBy: 'auto' | 'user';
  via: 'odesli' | 'provider_search' | 'manual';
  matchedAt: number;
  metadata?: Record<string, unknown>;
}

export interface TransferRunLog {
  startedAt: number;
  finishedAt?: number;
  sourcePlaylistId: string;
  targetPlaylistId?: string;
  added: number;
  skipped: number;
  failed: number;
  errors: Array<{
    trackId: string;
    message: string;
  }>;
}

export interface TransferProgressUpdate {
  stage:
    | 'idle'
    | 'preparing'
    | 'mapping'
    | 'awaiting-user'
    | 'creating-playlist'
    | 'inserting'
    | 'complete'
    | 'error';
  processed: number;
  total: number;
  message?: string;
  lastError?: string;
}

export interface TransferPlan {
  sourcePlaylist: PlaylistCore;
  targetPlaylistName: string;
  tracks: TrackCore[];
}
