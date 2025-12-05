import { TransferOrchestrator, type TrackMapping } from "@/core/orchestrator";
import type {
  PlaylistCore,
  TransferPlan,
  TransferProgressUpdate,
} from "@/core/types";
import type { HomeError, MatchStats } from "@/features/home/types/home";
import { computeMatchStats } from "@/features/home/services/stats";
import { toHomeError } from "@/features/home/services/errorModel";

export interface TransferServiceDeps {
  source: TransferOrchestrator["source"];
  target: TransferOrchestrator["target"];
  odesliApiKey?: string;
  onProgress?: (update: TransferProgressUpdate) => void;
}

export interface VerifyResult {
  plan: TransferPlan;
  mappings: TrackMapping[];
  stats: MatchStats;
}

export interface TransferExecuteResult {
  inserted: number;
  skipped: number;
  failures: TrackMapping[];
  pendingManual: TrackMapping[];
}

export function createTransferService({
  source,
  target,
  odesliApiKey,
  onProgress,
}: TransferServiceDeps) {
  const orchestrator = new TransferOrchestrator({
    source,
    target,
    onProgress,
    odesliApiKey,
  });

  return {
    async verify(playlist: PlaylistCore): Promise<VerifyResult> {
      try {
        const plan = await orchestrator.prepare(
          playlist,
          `${playlist.name} • YouTube`
        );
        const mapping = await orchestrator.mapTracks(plan);
        const stats = computeMatchStats(mapping.matches);
        return {
          plan,
          mappings: mapping.matches,
          stats,
        };
      } catch (error) {
        throw toHomeServiceError(error);
      }
    },
    async execute(
      plan: TransferPlan,
      mappings: TrackMapping[]
    ): Promise<TransferExecuteResult> {
      try {
        const result = await orchestrator.execute(
          plan,
          {
            matches: mappings,
            unresolved: mappings.filter((m) => !m.videoId),
          },
          {
            playlistName: plan.targetPlaylistName,
          }
        );
        return result;
      } catch (error) {
        throw toHomeServiceError(error);
      }
    },
  };
}

function toHomeServiceError(error: unknown): HomeError {
  return toHomeError(error);
}
