import type {
  MusicProvider,
  PlaylistCore,
  ProviderId,
  ProviderSearchResult,
  TrackCore,
  TransferPlan,
  TransferProgressUpdate,
} from './types';
import {
  estimateYouTubeInsertCapacity,
  YOUTUBE_DEFAULT_DAILY_QUOTA,
} from './quota';
import { slidingWindowLimiter, type RateLimiter } from './rateLimiter';
import {
  createMatchKey,
  getMatch,
  logRun,
  saveMatch,
  type MatchRecord,
} from '@/services/idb';
import { mapSpotifyToYouTube } from '@/services/odesli';
import type { OdesliMatch } from '@/services/odesli';

export interface TransferOrchestratorDeps {
  source: MusicProvider;
  target: MusicProvider;
  onProgress?: (update: TransferProgressUpdate) => void;
  odesliApiKey?: string;
  limiter?: RateLimiter;
}

export interface TrackMapping {
  track: TrackCore;
  videoId: string | null;
  score: number;
  via: MatchRecord['via'] | 'unknown';
  decidedBy: MatchRecord['decidedBy'];
  reason?: string;
  candidates?: ProviderSearchResult[];
  selectedCandidate?: ProviderSearchResult | null;
  cached?: boolean;
  error?: string;
}

export interface MappingResult {
  matches: TrackMapping[];
  unresolved: TrackMapping[];
}

export interface ExecuteOptions {
  dailyQuota?: number;
  reservedUnits?: number;
  chunkSize?: number;
  resumeFromTrackId?: string;
  playlistName?: string;
  playlistDescription?: string;
}

export interface ExecuteResult {
  playlistId: string;
  inserted: number;
  skipped: number;
  failures: TrackMapping[];
  pendingManual: TrackMapping[];
}

export class TransferOrchestrator {
  private readonly source: MusicProvider;
  private readonly target: MusicProvider;
  private readonly onProgress?: (update: TransferProgressUpdate) => void;
  private readonly limiter: RateLimiter;
  private readonly odesliApiKey?: string;

  constructor(deps: TransferOrchestratorDeps) {
    this.source = deps.source;
    this.target = deps.target;
    this.onProgress = deps.onProgress;
    this.odesliApiKey = deps.odesliApiKey;
    this.limiter =
      deps.limiter ??
      slidingWindowLimiter(this.odesliApiKey ? 60 : 10, 60_000);
  }

  async prepare(
    playlist: PlaylistCore,
    targetPlaylistName?: string,
  ): Promise<TransferPlan> {
    this.emit({
      stage: 'preparing',
      processed: 0,
      total: 0,
      message: `Loading tracks for ${playlist.name}`,
    });

    const tracks = await this.source.listTracks(playlist.id);

    return {
      sourcePlaylist: playlist,
      targetPlaylistName: targetPlaylistName ?? playlist.name,
      tracks,
    };
  }

  async mapTracks(plan: TransferPlan): Promise<MappingResult> {
    const total = plan.tracks.length;
    const mappings: TrackMapping[] = [];

    this.emit({
      stage: 'mapping',
      processed: 0,
      total,
      message: 'Resolving matches with cache and Odesli',
    });

    for (const [index, track] of plan.tracks.entries()) {
      const mapping = await this.resolveTrack(plan.sourcePlaylist.id, track);
      mappings.push(mapping);

      this.emit({
        stage: 'mapping',
        processed: index + 1,
        total,
        message: mapping.videoId
          ? `Found match for ${track.title}`
          : `Track requires manual review: ${track.title}`,
        lastError: mapping.error,
      });
    }

    return {
      matches: mappings,
      unresolved: mappings.filter((x) => !x.videoId),
    };
  }

  async execute(
    plan: TransferPlan,
    mapping: MappingResult,
    options: ExecuteOptions = {},
  ): Promise<ExecuteResult> {
    const quotaEstimate = estimateYouTubeInsertCapacity(
      {
        dailyLimit: options.dailyQuota ?? YOUTUBE_DEFAULT_DAILY_QUOTA,
        usedToday: 0,
        reservedUnits: options.reservedUnits,
      },
      { includePlaylistCreation: true },
    );

    const chunkSize = options.chunkSize ?? 20;
    const resolvedMatches = mapping.matches.filter(
      (item) => !!item.videoId && !item.error,
    );

    const limitedMatches = quotaEstimate.willExceed
      ? resolvedMatches.slice(0, 0)
      : resolvedMatches.slice(0, quotaEstimate.maxInserts);

    const playlistId = await this.target.createPlaylist(
      options.playlistName ?? plan.targetPlaylistName,
      options.playlistDescription,
    );

    this.emit({
      stage: 'creating-playlist',
      processed: 0,
      total: limitedMatches.length,
      message: `Created YouTube playlist ${playlistId}`,
    });

    let inserted = 0;
    const failures: TrackMapping[] = [];

    for (let i = 0; i < limitedMatches.length; i += chunkSize) {
      const chunk = limitedMatches.slice(i, i + chunkSize);
      const ids = chunk
        .map((item) => item.videoId)
        .filter((id): id is string => !!id);

      try {
        await this.target.addTracks(playlistId, ids);
        inserted += ids.length;
      } catch (error) {
        const err = error instanceof Error ? error.message : String(error);
        const chunkWithErrors = chunk.map((item) => ({
          ...item,
          error: err,
        }));
        failures.push(...chunkWithErrors);
      }

      this.emit({
        stage: 'inserting',
        processed: Math.min(i + chunk.length, limitedMatches.length),
        total: limitedMatches.length,
        message: `Inserted ${Math.min(
          i + chunk.length,
          limitedMatches.length,
        )} / ${limitedMatches.length}`,
      });
    }

    const runId = await logRun({
      startedAt: Date.now(),
      finishedAt: Date.now(),
      sourcePlaylistId: plan.sourcePlaylist.id,
      targetPlaylistId: playlistId,
      added: inserted,
      skipped: plan.tracks.length - inserted,
      failed: failures.length,
      errors: failures.map((failure) => ({
        trackId: failure.track.id,
        message: failure.error ?? 'Unknown error',
      })),
    });

    this.emit({
      stage: 'complete',
      processed: inserted,
      total: limitedMatches.length,
      message: `Transfer completed (run ${runId})`,
    });

    return {
      playlistId,
      inserted,
      skipped: plan.tracks.length - inserted,
      failures,
      pendingManual: mapping.unresolved,
    };
  }

  private async resolveTrack(
    playlistId: string,
    track: TrackCore,
  ): Promise<TrackMapping> {
    const cached = await this.loadCachedMatch(this.source.id, track.id);
    if (cached?.targetId) {
      return {
        track,
        videoId: cached.targetId,
        score: cached.score,
        via: cached.via,
        decidedBy: cached.decidedBy,
        cached: true,
      };
    }

    let via: MatchRecord['via'] = 'manual';
    let score = 0;
    let videoId: string | null = null;
    let reason: string | undefined;
    let candidates: ProviderSearchResult[] | undefined;
    let selectedCandidate: ProviderSearchResult | null = null;

    const odesli = await this.tryOdesli(track);
    if (odesli?.videoId) {
      videoId = odesli.videoId;
      via = 'odesli';
      score = 1;
      selectedCandidate = {
        id: odesli.videoId,
        score: 1,
        url: `https://www.youtube.com/watch?v=${odesli.videoId}`,
        matchedBy: 'odesli',
      };
    }

    if (!videoId) {
      const query = this.buildQuery(track);
      const results = await this.target.search(query, {
        durationMs: track.durationMs,
        isrc: track.isrc,
      });

      if (results.length > 0) {
        const sorted = [...results].sort(
          (a, b) => (b.score ?? 0) - (a.score ?? 0),
        );
        candidates = sorted;
        const best = sorted[0];
        if (best) {
          score = best.score ?? score;
          if (shouldAutoAcceptCandidate(best, track)) {
            videoId = best.id;
            via = 'yt_search';
            selectedCandidate = best;
          } else {
            reason = `Низкая уверенность поиска (score ${(best.score ?? 0).toFixed(2)})`;
          }
        }
      } else {
        reason = 'YouTube search returned no results';
      }
    }

    const matchRecord: MatchRecord = {
      key: createMatchKey(this.source.id, track.id),
      sourceProvider: this.source.id,
      sourceTrackId: track.id,
      targetProvider: this.target.id,
      targetId: videoId ?? '',
      score,
      decidedBy: 'auto',
      via: videoId ? via : 'manual',
      updatedAt: Date.now(),
      metadata: {
        playlistId,
      },
    };

    if (videoId) {
      await saveMatch(matchRecord);
    }

    return {
      track,
      videoId,
      score,
      via: videoId ? via : 'unknown',
      decidedBy: 'auto',
      reason,
      candidates,
      selectedCandidate,
    };
  }

  private async loadCachedMatch(
    provider: ProviderId,
    trackId: string,
  ): Promise<MatchRecord | undefined> {
    return getMatch(provider, trackId);
  }

  private async tryOdesli(track: TrackCore): Promise<OdesliMatch | null> {
    const spotifyUrl =
      track.url ?? `https://open.spotify.com/track/${track.id}`;

    try {
      return await this.limiter(() =>
        mapSpotifyToYouTube(spotifyUrl, { apiKey: this.odesliApiKey }),
      );
    } catch (error) {
      console.warn('Odesli lookup failed', error);
      return null;
    }
  }

  private buildQuery(track: TrackCore): string {
    const artists = track.artists.join(', ');
    return `${artists} - ${track.title}`;
  }

  private emit(update: TransferProgressUpdate): void {
    this.onProgress?.(update);
  }
}

function shouldAutoAcceptCandidate(
  candidate: ProviderSearchResult,
  track: TrackCore,
): boolean {
  const score = candidate.score ?? 0;
  const reasons = candidate.reasons ?? [];
  if (score >= 0.85) {
    return true;
  }

  if (reasons.some((reason) => reason.toLowerCase().includes('isrc'))) {
    return true;
  }

  if (candidate.official && score >= 0.6) {
    return true;
  }

  if (
    candidate.durationDeltaMs !== undefined &&
    Math.abs(candidate.durationDeltaMs) <= 2_000 &&
    score >= 0.7
  ) {
    return true;
  }

  if (track.isrc && score >= 0.65) {
    return true;
  }

  return false;
}
