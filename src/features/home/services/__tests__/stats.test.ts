import { describe, expect, it } from "vitest";
import { computeMatchStats } from "@/features/home/services/stats";
import type { TrackMapping } from "@/core/orchestrator";

describe("computeMatchStats", () => {
  it("returns zero stats for empty list", () => {
    const stats = computeMatchStats([]);
    expect(stats).toEqual({ total: 0, auto: 0, manual: 0 });
  });

  it("counts matched and manual tracks", () => {
    const matches: TrackMapping[] = [
      {
        track: {
          id: "1",
          title: "Song 1",
          artists: ["Artist"],
        },
        videoId: "abc",
        score: 0.9,
        via: "yt_search",
        decidedBy: "auto",
      },
      {
        track: {
          id: "2",
          title: "Song 2",
          artists: ["Artist"],
        },
        videoId: null,
        score: 0,
        via: "manual",
        decidedBy: "auto",
      },
    ];

    const stats = computeMatchStats(matches);
    expect(stats).toEqual({ total: 2, auto: 1, manual: 1 });
  });
});
