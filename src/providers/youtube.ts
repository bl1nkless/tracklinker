import type {
  MusicProvider,
  MusicProviderAuthContext,
  PlaylistCore,
  ProviderSearchOptions,
  ProviderSearchResult,
  TrackCore,
} from "@/core/types";
import {
  requestGoogleToken,
  type GoogleToken,
} from "@/services/googleIdentity";

export interface YouTubeToken {
  accessToken: string;
  expiresAt: number;
  scopes: string[];
  obtainedAt: number;
}

export interface YouTubeProviderOptions {
  clientId: string;
  scopes?: string[];
  loadToken?: () => Promise<YouTubeToken | undefined>;
  saveToken?: (token?: YouTubeToken) => Promise<void> | void;
  onTokenInvalid?: () => void;
}

interface YouTubePlaylistResource {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
  };
  contentDetails?: {
    itemCount?: number;
  };
}

interface YouTubePlaylistItemResource {
  contentDetails?: {
    videoId?: string;
  };
  snippet?: {
    title?: string;
    videoOwnerChannelTitle?: string;
    channelTitle?: string;
    playlistId?: string;
  };
}

interface YouTubeSearchResource {
  id: {
    videoId: string;
  };
  snippet: {
    title?: string;
    channelTitle?: string;
    channelId?: string;
  };
}

const API_ROOT = "https://www.googleapis.com/youtube/v3";

export class YouTubeProvider implements MusicProvider {
  readonly id = "youtube";
  private readonly clientId: string;
  private readonly scopes: string[];
  private readonly loadToken?: () => Promise<YouTubeToken | undefined>;
  private readonly saveToken?: (token?: YouTubeToken) => Promise<void> | void;
  private readonly onTokenInvalid?: () => void;
  private token?: YouTubeToken;
  private loadingToken?: Promise<YouTubeToken | undefined>;
  private requestingToken?: Promise<YouTubeToken>;

  constructor(options: YouTubeProviderOptions) {
    this.clientId = options.clientId;
    this.scopes = options.scopes ?? ["https://www.googleapis.com/auth/youtube"];
    this.loadToken = options.loadToken;
    this.saveToken = options.saveToken;
    this.onTokenInvalid = options.onTokenInvalid;
  }

  async auth(interactive = true): Promise<MusicProviderAuthContext> {
    console.log("[YouTubeProvider] auth called, interactive:", interactive);
    const credential = await this.ensureToken(interactive);
    console.log("[YouTubeProvider] auth success, scopes:", credential.scopes);
    return {
      token: credential.accessToken,
      expiresAt: credential.expiresAt,
      scopes: credential.scopes,
    };
  }

  // ... (methods listPlaylists, listTracks, search remain unchanged) ...

  async listPlaylists(): Promise<PlaylistCore[]> {
    const credential = await this.ensureToken(false);
    const data = await this.fetch<{ items?: YouTubePlaylistResource[] }>(
      `${API_ROOT}/playlists?part=snippet%2CcontentDetails&mine=true&maxResults=50`,
      credential.accessToken
    );

    return (
      data.items?.map((item) => ({
        id: item.id,
        name: item.snippet?.title ?? "Untitled",
        description: item.snippet?.description ?? undefined,
        trackCount: item.contentDetails?.itemCount ?? 0,
        ownerName: item.snippet?.channelTitle ?? undefined,
      })) ?? []
    );
  }

  async listTracks(playlistId: string): Promise<TrackCore[]> {
    const credential = await this.ensureToken(false);
    let pageToken: string | undefined;
    const results: TrackCore[] = [];

    do {
      const url = new URL(`${API_ROOT}/playlistItems`);
      url.searchParams.set("part", "snippet,contentDetails");
      url.searchParams.set("playlistId", playlistId);
      url.searchParams.set("maxResults", "50");
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      const payload = await this.fetch<{
        items?: YouTubePlaylistItemResource[];
        nextPageToken?: string;
      }>(url.toString(), credential.accessToken);

      for (const item of payload.items ?? []) {
        const contentDetails = item.contentDetails ?? {};
        const snippet = item.snippet ?? {};
        results.push({
          id: contentDetails.videoId ?? "",
          title: snippet.title ?? "Unknown title",
          artists: [
            snippet.videoOwnerChannelTitle ?? snippet.channelTitle ?? "Unknown",
          ],
          album: snippet.playlistId,
          durationMs: undefined,
          url: `https://www.youtube.com/watch?v=${contentDetails.videoId}`,
        });
      }

      pageToken = payload.nextPageToken;
    } while (pageToken);

    return results;
  }

  async search(
    query: string,
    opts: ProviderSearchOptions = {}
  ): Promise<ProviderSearchResult[]> {
    const credential = await this.ensureToken(false);
    const searchUrl = new URL(`${API_ROOT}/search`);
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("maxResults", "5");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("q", query);

    const search = await this.fetch<{
      items?: YouTubeSearchResource[];
    }>(searchUrl.toString(), credential.accessToken);

    const videoIds =
      search.items?.map((item) => item.id.videoId).filter(Boolean) ?? [];
    if (videoIds.length === 0) {
      return [];
    }

    const detailUrl = new URL(`${API_ROOT}/videos`);
    detailUrl.searchParams.set("part", "contentDetails,snippet");
    detailUrl.searchParams.set("id", videoIds.join(","));

    const details = await this.fetch<{
      items?: Array<{
        id: string;
        contentDetails?: { duration?: string };
        snippet?: { title?: string; channelTitle?: string; channelId?: string };
      }>;
    }>(detailUrl.toString(), credential.accessToken);

    const searchMap = new Map<
      string,
      { snippet: YouTubeSearchResource["snippet"] }
    >();
    for (const item of search.items ?? []) {
      if (item.id?.videoId) {
        searchMap.set(item.id.videoId, {
          snippet: item.snippet ?? {},
        });
      }
    }

    const candidates =
      details.items?.map((item) => {
        const durationMs = item.contentDetails?.duration
          ? parseDuration(item.contentDetails.duration)
          : undefined;
        const searchSnippet = searchMap.get(item.id)?.snippet ?? {};
        const snippet = item.snippet ?? {};
        const title = snippet.title ?? searchSnippet.title ?? "Untitled video";
        const channelTitle =
          snippet.channelTitle ?? searchSnippet.channelTitle ?? undefined;
        const channelId =
          (searchSnippet.channelId as string | undefined) ?? snippet.channelId;
        const durationDeltaMs =
          durationMs !== undefined && opts.durationMs !== undefined
            ? durationMs - opts.durationMs
            : undefined;

        const heuristics = evaluateCandidate({
          title,
          channelTitle,
          durationMs,
          targetDuration: opts.durationMs,
          channelId,
          preferredChannelIds: opts.preferredChannelIds,
        });

        return {
          id: item.id,
          score: heuristics.score,
          title,
          channelId,
          channelTitle,
          durationMs,
          durationDeltaMs,
          url: `https://www.youtube.com/watch?v=${item.id}`,
          matchedBy: heuristics.matchedBy,
          reasons: heuristics.reasons,
          official: heuristics.official,
        };
      }) ?? [];

    return candidates.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  async createPlaylist(name: string, description?: string): Promise<string> {
    const credential = await this.ensureToken(true);
    const payload = await this.fetch<{ id: string }>(
      `${API_ROOT}/playlists?part=snippet,status`,
      credential.accessToken,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: { title: name, description },
          status: { privacyStatus: "private" },
        }),
      }
    );

    return payload.id;
  }

  async addTracks(playlistId: string, videoIds: string[]): Promise<void> {
    const credential = await this.ensureToken(true);
    for (const videoId of videoIds) {
      await this.fetch(
        `${API_ROOT}/playlistItems?part=snippet`,
        credential.accessToken,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            snippet: {
              playlistId,
              resourceId: {
                kind: "youtube#video",
                videoId,
              },
            },
          }),
        }
      );
    }
  }

  private async ensureToken(interactive: boolean): Promise<YouTubeToken> {
    if (this.token && isTokenValid(this.token)) {
      return this.token;
    }

    if (!this.loadingToken && this.loadToken) {
      this.loadingToken = this.loadToken();
    }

    if (this.loadingToken) {
      const stored = await this.loadingToken;
      this.loadingToken = undefined;
      if (stored) {
        this.token = stored;
      }
    }

    if (this.token && !isTokenValid(this.token)) {
      this.token = undefined;
      await this.persistToken(undefined);
    }

    if (this.token && isTokenValid(this.token)) {
      return this.token;
    }

    const attemptRequest = async (promptInteractive: boolean) => {
      if (!this.requestingToken) {
        this.requestingToken = this.requestAccessToken(promptInteractive);
        this.requestingToken.finally(() => {
          this.requestingToken = undefined;
        });
      }
      const nextToken = await this.requestingToken;
      await this.persistToken(nextToken);
      return nextToken;
    };

    try {
      this.token = await attemptRequest(false);
      return this.token;
    } catch (error) {
      this.requestingToken = undefined;
      if (!interactive) {
        throw new Error(
          error instanceof Error
            ? error.message
            : "YouTube token unavailable without interaction"
        );
      }
    }

    this.token = await attemptRequest(true);
    return this.token;
  }

  private async requestAccessToken(
    interactive: boolean
  ): Promise<YouTubeToken> {
    console.log("[YouTubeProvider] Requesting new token. Scopes:", this.scopes);
    const response: GoogleToken = await requestGoogleToken({
      clientId: this.clientId,
      scope: this.scopes.join(" "),
      interactive,
    });
    console.log(
      "[YouTubeProvider] Token received. Granted scopes:",
      response.scope
    );

    const token: YouTubeToken = {
      accessToken: response.accessToken,
      expiresAt: Date.now() + response.expiresIn * 1000,
      scopes: response.scope.split(" "),
      obtainedAt: Date.now(),
    };

    return token;
  }

  private async fetch<T>(
    input: string,
    token: string,
    init?: RequestInit
  ): Promise<T> {
    const headers = new Headers(init?.headers ?? {});
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Accept", "application/json");

    const response = await fetch(input, {
      ...init,
      headers,
    });

    if (response.status === 401 || response.status === 403) {
      this.token = undefined;
      await this.persistToken(undefined);
      this.onTokenInvalid?.();
      throw new Error("YouTube token expired or invalid.");
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `YouTube API error (${response.status}): ${text.slice(0, 200)}`
      );
    }

    return (await response.json()) as T;
  }

  private async persistToken(token?: YouTubeToken): Promise<void> {
    this.token = token;
    await this.saveToken?.(token);
  }

  clear(): void {
    this.token = undefined;
    this.loadingToken = undefined;
    this.requestingToken = undefined;
  }
}

function isTokenValid(token: YouTubeToken): boolean {
  return token.expiresAt - Date.now() > 30_000;
}

interface EvaluateCandidateInput {
  title: string;
  channelTitle?: string;
  durationMs?: number;
  targetDuration?: number;
  channelId?: string;
  preferredChannelIds?: string[];
}

type CandidateMatchTag = "duration" | "official" | "preferred";

interface EvaluateCandidateResult {
  score: number;
  matchedBy: CandidateMatchTag;
  reasons: string[];
  official: boolean;
}

function evaluateCandidate(
  input: EvaluateCandidateInput
): EvaluateCandidateResult {
  const reasons: string[] = [];
  let matchedBy: CandidateMatchTag = "duration";
  let score = computeScore({
    durationMs: input.durationMs,
    targetDuration: input.targetDuration,
  });

  if (input.targetDuration !== undefined && input.durationMs !== undefined) {
    const deltaMs = input.durationMs - input.targetDuration;
    const deltaSeconds = Math.abs(deltaMs) / 1000;
    const direction = deltaMs > 0 ? "+" : deltaMs < 0 ? "−" : "";
    reasons.push(`Δ ${direction}${deltaSeconds.toFixed(1)}s vs track`);
  }

  let official = false;
  const normalizedChannel = input.channelTitle?.toLowerCase() ?? "";
  if (
    normalizedChannel.endsWith(" - topic") ||
    normalizedChannel.includes("official artist channel") ||
    normalizedChannel.includes("official video") ||
    normalizedChannel.includes("provided to youtube")
  ) {
    official = true;
    score = Math.min(1, score + 0.18);
    matchedBy = "official";
    reasons.push("Official / Topic channel");
  }

  if (input.channelId && input.preferredChannelIds?.includes(input.channelId)) {
    score = Math.min(1, score + 0.12);
    matchedBy = "preferred";
    reasons.push("Preferred channel");
  }

  const normalizedTitle = input.title.toLowerCase();
  if (normalizedTitle.includes("live")) {
    score = Math.max(0, score - 0.18);
    reasons.push("Live performance hint");
  }
  if (normalizedTitle.includes("cover")) {
    score = Math.max(0, score - 0.14);
    reasons.push("Cover version hint");
  }
  if (normalizedTitle.includes("remix")) {
    score = Math.max(0, score - 0.1);
    reasons.push("Remix detected");
  }
  if (normalizedTitle.includes("lyrics")) {
    score = Math.max(0, score - 0.05);
    reasons.push("Lyrics video hint");
  }

  score = Math.max(0.05, Math.min(1, score));

  return {
    score,
    matchedBy,
    reasons,
    official,
  };
}

function computeScore({
  durationMs,
  targetDuration,
}: {
  durationMs?: number;
  targetDuration?: number;
}): number {
  if (!durationMs || !targetDuration) {
    return 0.4;
  }

  const delta = Math.abs(durationMs - targetDuration);
  const tolerance = Math.max(5_000, targetDuration * 0.05);
  const ratio = Math.max(0, 1 - delta / tolerance);
  return Math.max(0.1, Math.min(1, ratio));
}

function parseDuration(input: string): number | undefined {
  const regex = /P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/;
  const match = regex.exec(input);

  if (!match) {
    return undefined;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);

  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}
