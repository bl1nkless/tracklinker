import type { TrackMapping } from "@/core/orchestrator";
import type { MatchStats } from "@/features/home/types/home";

export function computeMatchStats(matches: TrackMapping[]): MatchStats {
  const total = matches.length;
  const auto = matches.filter((m) => Boolean(m.videoId)).length;
  const manual = total - auto;
  return { total, auto, manual };
}
