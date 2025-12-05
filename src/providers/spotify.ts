import type {
  MusicProvider,
  MusicProviderAuthContext,
  PlaylistCore,
  ProviderSearchOptions,
  ProviderSearchResult,
  TrackCore,
} from "@/core/types";

const DEFAULT_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
] as const;

const AUTH_STORAGE_KEY = "spotify_pkce_verifier";
const AUTH_STATE_KEY = "spotify_auth_state";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";

export interface SpotifyToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scopes: string[];
  obtainedAt: number;
}

export interface SpotifyProviderOptions {
  clientId: string;
  redirectUri: string;
  scopes?: string[];
  loadToken?: () => Promise<SpotifyToken | undefined>;
  saveToken?: (token?: SpotifyToken) => Promise<void> | void;
}

interface FetchSpotifyOptions extends RequestInit {
  query?: Record<string, string | number | undefined>;
}

export class SpotifyProvider implements MusicProvider {
  readonly id = "spotify";
  private readonly clientId: string;
  private readonly redirectUri: string;
  private readonly scopes: string[];
  private readonly loadToken?: SpotifyProviderOptions["loadToken"];
  private readonly saveToken?: SpotifyProviderOptions["saveToken"];
  private token?: SpotifyToken;
  private loadingToken?: Promise<SpotifyToken | undefined>;

  constructor(options: SpotifyProviderOptions) {
    this.clientId = options.clientId;
    this.redirectUri = options.redirectUri;
    this.scopes = options.scopes ?? [...DEFAULT_SCOPES];
    this.loadToken = options.loadToken;
    this.saveToken = options.saveToken;
  }

  async auth(interactive = true): Promise<MusicProviderAuthContext> {
    const credential = await this.ensureToken(interactive);
    return {
      token: credential.accessToken,
      expiresAt: credential.expiresAt,
      scopes: credential.scopes,
    };
  }

  async handleRedirectCallback(): Promise<MusicProviderAuthContext | null> {
    const search = new URLSearchParams(window.location.search);
    const code = search.get("code");
    const state = search.get("state");
    const verifier = sessionStorage.getItem(AUTH_STORAGE_KEY);
    const expectedState = sessionStorage.getItem(AUTH_STATE_KEY);

    if (!code) {
      return null;
    }

    if (!verifier || !expectedState || state !== expectedState) {
      throw new Error("Spotify auth state mismatch");
    }

    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STATE_KEY);

    const token = await this.exchangeCodeForToken(code, verifier);
    await this.persistToken(token);
    this.token = token;

    const params = new URLSearchParams(window.location.search);
    ["code", "state"].forEach((key) => params.delete(key));
    const newUrl =
      window.location.pathname +
      (params.toString() ? `?${params.toString()}` : "") +
      window.location.hash;
    window.history.replaceState({}, document.title, newUrl);

    return {
      token: token.accessToken,
      expiresAt: token.expiresAt,
      scopes: token.scopes,
    };
  }

  async listPlaylists(): Promise<PlaylistCore[]> {
    const credential = await this.ensureToken(true);
    const items: PlaylistCore[] = [];
    let nextUrl: string | null =
      "https://api.spotify.com/v1/me/playlists?limit=50&offset=0";

    while (nextUrl) {
      const response: SpotifyPlaylistResponse =
        await this.fetchSpotify<SpotifyPlaylistResponse>(
          nextUrl,
          credential.accessToken
        );

      for (const item of response.items ?? []) {
        items.push({
          id: item.id,
          name: item.name,
          description: item.description ?? undefined,
          trackCount: item.tracks.total,
          ownerName: item.owner?.display_name ?? undefined,
          snapshotId: item.snapshot_id,
        });
      }

      nextUrl = response.next ?? null;
    }

    return items;
  }

  async listTracks(playlistId: string): Promise<TrackCore[]> {
    const credential = await this.ensureToken(true);
    const items: TrackCore[] = [];
    let nextUrl: string | null = buildPlaylistTracksUrl(
      playlistId,
      0
    ).toString();

    while (nextUrl) {
      const response: SpotifyPlaylistTracksResponse =
        await this.fetchSpotify<SpotifyPlaylistTracksResponse>(
          nextUrl,
          credential.accessToken
        );

      for (const item of response.items ?? []) {
        const track = item.track;
        if (!track) {
          continue;
        }

        const artistNames = track.artists?.map(
          (artist: SpotifyArtist) => artist.name ?? "Unknown"
        ) ?? ["Unknown"];

        items.push({
          id: track.id ?? track.uri ?? "",
          title: track.name ?? "Unknown",
          artists: artistNames,
          album: track.album?.name ?? undefined,
          durationMs: track.duration_ms ?? undefined,
          explicit: track.explicit ?? undefined,
          isrc: track.external_ids?.isrc ?? undefined,
          url: track.external_urls?.spotify ?? undefined,
        });
      }

      nextUrl = response.next ?? null;
    }

    return items;
  }

  async search(
    query: string,
    opts: ProviderSearchOptions = {}
  ): Promise<ProviderSearchResult[]> {
    const credential = await this.ensureToken(true);
    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("type", "track");
    url.searchParams.set("limit", "5");
    url.searchParams.set("q", query);

    const response = await this.fetchSpotify<SpotifySearchResponse>(
      url.toString(),
      credential.accessToken
    );

    const tracks = response.tracks?.items ?? [];

    return tracks.map((track) => {
      const durationMs = track.duration_ms ?? undefined;
      const baseScore = computeSearchScore({
        durationMs,
        targetDuration: opts.durationMs,
        isrc: track.external_ids?.isrc,
        targetIsrc: opts.isrc,
      });

      return {
        id: track.id ?? track.uri ?? "",
        score: baseScore,
        title: track.name ?? undefined,
        channelTitle: track.artists?.map((artist) => artist.name).join(", "),
        durationMs,
        url: track.external_urls?.spotify,
        matchedBy:
          track.external_ids?.isrc === opts.isrc ? "string" : "duration",
      };
    });
  }

  async createPlaylist(): Promise<string> {
    throw new Error(
      "SpotifyProvider.createPlaylist is unavailable for source."
    );
  }

  async addTracks(): Promise<void> {
    throw new Error("SpotifyProvider.addTracks is unavailable for source.");
  }

  private async ensureToken(interactive: boolean): Promise<SpotifyToken> {
    if (this.token && isTokenValid(this.token)) {
      return this.token;
    }

    if (!this.loadingToken && this.loadToken) {
      this.loadingToken = this.loadToken();
    }

    if (this.loadingToken) {
      const loaded = await this.loadingToken;
      this.loadingToken = undefined;
      if (loaded) {
        this.token = loaded;
      }
    }

    if (this.token && !isTokenValid(this.token) && this.token.refreshToken) {
      this.token = await this.refreshToken(this.token.refreshToken);
      await this.persistToken(this.token);
      return this.token;
    }

    if (this.token && isTokenValid(this.token)) {
      return this.token;
    }

    if (!interactive) {
      throw new Error("Spotify auth required but not available");
    }

    await this.beginAuthRedirect();
    return new Promise<SpotifyToken>(() => {
      /* Redirect in progress */
    });
  }

  private async beginAuthRedirect(): Promise<void> {
    const verifier = createCodeVerifier();
    const challenge = await createCodeChallenge(verifier);
    const state = crypto.randomUUID();

    sessionStorage.setItem(AUTH_STORAGE_KEY, verifier);
    sessionStorage.setItem(AUTH_STATE_KEY, state);

    const authUrl = new URL(AUTH_ENDPOINT);
    authUrl.searchParams.set("client_id", this.clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", this.redirectUri);
    authUrl.searchParams.set("scope", this.scopes.join(" "));
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("state", state);

    window.location.assign(authUrl.toString());
  }

  private async exchangeCodeForToken(
    code: string,
    verifier: string
  ): Promise<SpotifyToken> {
    const params = new URLSearchParams();
    params.set("client_id", this.clientId);
    params.set("grant_type", "authorization_code");
    params.set("code", code);
    params.set("redirect_uri", this.redirectUri);
    params.set("code_verifier", verifier);

    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Spotify token exchange failed: ${text}`);
    }

    const payload = (await response.json()) as SpotifyTokenResponse;
    return mapTokenResponse(payload);
  }

  private async refreshToken(refreshToken: string): Promise<SpotifyToken> {
    const params = new URLSearchParams();
    params.set("client_id", this.clientId);
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", refreshToken);

    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Spotify token refresh failed: ${response.status}`);
    }

    const payload = (await response.json()) as SpotifyTokenResponse;
    return mapTokenResponse({
      refresh_token: refreshToken,
      ...payload,
    });
  }

  private async fetchSpotify<T>(
    url: string,
    token: string,
    options: FetchSpotifyOptions = {}
  ): Promise<T> {
    const requestUrl =
      options.query && Object.keys(options.query).length
        ? `${url}${url.includes("?") ? "&" : "?"}${new URLSearchParams(
            Object.entries(options.query).reduce<Record<string, string>>(
              (acc, [key, value]) => {
                if (value !== undefined) {
                  acc[key] = String(value);
                }
                return acc;
              },
              {}
            )
          )}`
        : url;

    const response = await fetch(requestUrl, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });

    if (response.status === 401 && this.token?.refreshToken) {
      this.token = await this.refreshToken(this.token.refreshToken);
      await this.persistToken(this.token);
      return this.fetchSpotify<T>(url, this.token.accessToken, options);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Spotify API error ${response.status}: ${text}`);
    }

    return (await response.json()) as T;
  }

  private async persistToken(token?: SpotifyToken): Promise<void> {
    this.token = token;
    await this.saveToken?.(token);
  }

  clear(): void {
    this.token = undefined;
    this.loadingToken = undefined;
  }
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

export function createCodeVerifier(length = 64): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  const chars = Array.from(
    randomValues,
    (value) => charset[value % charset.length]
  );
  return chars.join("");
}

function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isTokenValid(token: SpotifyToken): boolean {
  return token.expiresAt - Date.now() > 60_000;
}

function mapTokenResponse(payload: SpotifyTokenResponse): SpotifyToken {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? undefined,
    expiresAt: Date.now() + payload.expires_in * 1000,
    scopes: payload.scope?.split(" ") ?? [],
    obtainedAt: Date.now(),
  };
}

function computeSearchScore({
  durationMs,
  targetDuration,
  isrc,
  targetIsrc,
}: {
  durationMs?: number;
  targetDuration?: number;
  isrc?: string;
  targetIsrc?: string;
}): number {
  if (isrc && targetIsrc && isrc === targetIsrc) {
    return 1;
  }

  if (!durationMs || !targetDuration) {
    return 0.5;
  }

  const delta = Math.abs(durationMs - targetDuration);
  const tolerance = Math.max(3_000, targetDuration * 0.05);
  const ratio = Math.max(0, 1 - delta / tolerance);
  return Math.min(1, Math.max(0.2, ratio));
}

function buildPlaylistTracksUrl(playlistId: string, offset: number) {
  const url = new URL(
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(
      playlistId
    )}/tracks`
  );
  url.searchParams.set("limit", "100");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("additional_types", "track");
  return url;
}

interface SpotifyTokenResponse {
  access_token: string;
  token_type: "Bearer";
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

interface SpotifyPlaylistResponse {
  items?: Array<{
    id: string;
    name: string;
    description?: string;
    tracks: { total: number };
    snapshot_id: string;
    owner?: { display_name?: string };
  }>;
  next?: string | null;
}

interface SpotifyPlaylistTracksResponse {
  items?: Array<{
    track: SpotifyTrack | null;
  }>;
  next?: string | null;
}

interface SpotifyTrack {
  id: string;
  name?: string;
  duration_ms?: number;
  explicit?: boolean;
  uri?: string;
  artists?: Array<{ id?: string; name?: string }>;
  album?: { id?: string; name?: string };
  external_urls?: { spotify?: string };
  external_ids?: { isrc?: string };
}

interface SpotifySearchResponse {
  tracks?: {
    items: SpotifyTrack[];
  };
}

type SpotifyArtist = NonNullable<SpotifyTrack["artists"]>[number];
