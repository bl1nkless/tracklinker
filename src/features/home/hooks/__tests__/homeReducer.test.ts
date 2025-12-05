import { describe, expect, it, vi } from "vitest";
import {
  homeReducer,
  homeInitialState,
} from "@/features/home/hooks/useHomeOrchestrator";
import type { HomeState } from "@/features/home/types/home";

describe("homeReducer", () => {
  it("resets to INIT on INIT event", () => {
    const initial: HomeState = {
      step: "READY",
      context: { error: null, abortController: null },
    };

    const next = homeReducer(initial, { type: "INIT" });
    expect(next.step).toBe("INIT");
    expect(next.context.error).toBeNull();
  });

  it("transitions to AUTHENTICATING on AUTH_START", () => {
    const next = homeReducer(homeInitialState, { type: "AUTH_START" });
    expect(next.step).toBe("AUTHENTICATING");
  });

  it("records provider selection", () => {
    const next = homeReducer(homeInitialState, {
      type: "SELECT_PROVIDERS",
      src: "spotify",
      dst: "youtube",
    });
    expect(next.context.src).toBe("spotify");
    expect(next.context.dst).toBe("youtube");
  });

  it("stores match stats on MAP_SUCCESS", () => {
    const readyState: HomeState = {
      step: "MAPPING",
      context: {
        src: "spotify",
        dst: "youtube",
        error: null,
        abortController: null,
      },
    };

    const stats = { total: 10, auto: 7, manual: 3 };
    const unresolvedIds = ["1", "2"];

    const next = homeReducer(readyState, {
      type: "MAP_SUCCESS",
      stats,
      unresolvedIds,
    });

    expect(next.step).toBe("TRANSFERRING");
    expect(next.context.matchStats).toEqual(stats);
    expect(next.context.unresolvedIds).toEqual(unresolvedIds);
  });

  it("aborts on CANCEL when abort controller exists", () => {
    const abortSpy = vi.fn();
    const state: HomeState = {
      step: "TRANSFERRING",
      context: {
        error: null,
        abortController: {
          abort: abortSpy,
        } as unknown as AbortController,
      },
    };

    const next = homeReducer(state, { type: "CANCEL" });
    expect(next.step).toBe("CANCELED");
    expect(abortSpy).toHaveBeenCalledWith("user-cancel");
  });
});
