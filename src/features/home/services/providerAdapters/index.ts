import type {
  PlaylistCore,
  ProviderSearchResult,
  TrackCore,
} from "@/core/types";
import { SpotifyProvider } from "@/providers/spotify";
import { YouTubeProvider } from "@/providers/youtube";

export type ProviderAdapter =
  | SpotifyAdapter
  | YouTubeAdapter;

export interface BaseAdapter {
  id: "spotify" | "youtube";
  auth(interactive?: boolean): Promise<void>;
  listPlaylists(): Promise<PlaylistCore[]>;
  listTracks(playlistId: string): Promise<TrackCore[]>;
  searchTrack(
    query: ProviderSearchQuery
  ): Promise<ProviderSearchResult[]>;
  createPlaylist(name: string, description?: string): Promise<string>;
  addTracks(playlistId: string, trackIds: string[]): Promise<void>;
}

export interface ProviderSearchQuery {
  q?: string;
  isrc?: string;
  title?: string;
  artist?: string;
  durationMs?: number;
}

export type SpotifyAdapter = BaseAdapter & {
  id: "spotify";
};

export type YouTubeAdapter = BaseAdapter & {
  id: "youtube";
};

export function createSpotifyAdapter(provider: SpotifyProvider): SpotifyAdapter {
  return {
    id: "spotify",
    async auth(interactive = false) {
      await provider.auth(interactive);
    },
    listPlaylists() {
      return provider.listPlaylists();
    },
    listTracks(playlistId: string) {
      return provider.listTracks(playlistId);
    },
    async searchTrack(query: ProviderSearchQuery) {
      if (query.q) {
        return provider.search(query.q, {
          durationMs: query.durationMs,
          isrc: query.isrc,
        });
      }
      if (query.isrc) {
        return provider.search(query.isrc, { isrc: query.isrc });
      }
      if (query.title && query.artist) {
        return provider.search(`${query.artist} - ${query.title}`, {
          durationMs: query.durationMs,
          isrc: query.isrc,
        });
      }
      return [];
    },
    createPlaylist() {
      return provider.createPlaylist();
    },
    addTracks() {
      return provider.addTracks();
    },
  };
}

export function createYouTubeAdapter(provider: YouTubeProvider): YouTubeAdapter {
  return {
    id: "youtube",
    async auth(interactive = false) {
      await provider.auth(interactive);
    },
    listPlaylists() {
      return provider.listPlaylists();
    },
    listTracks(playlistId: string) {
      return provider.listTracks(playlistId);
    },
    async searchTrack(query: ProviderSearchQuery) {
      if (query.isrc) {
        return provider.search(`"${query.isrc}"`, { isrc: query.isrc });
      }
      if (query.title && query.artist) {
        return provider.search(`${query.artist} ${query.title}`, {
          durationMs: query.durationMs,
        });
      }
      if (query.q) {
        return provider.search(query.q, {
          durationMs: query.durationMs,
        });
      }
      return [];
    },
    createPlaylist(name: string, description?: string) {
      return provider.createPlaylist(name, description);
    },
    addTracks(playlistId: string, trackIds: string[]) {
      return provider.addTracks(playlistId, trackIds);
    },
  };
}
