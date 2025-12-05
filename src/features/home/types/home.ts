import type { ProviderId } from "@/core/types";

export type HomeStep =
  | "INIT"
  | "AUTHENTICATING"
  | "READY"
  | "VERIFYING"
  | "MAPPING"
  | "TRANSFERRING"
  | "SUCCESS"
  | "ERROR"
  | "CANCELED";

export interface MatchStats {
  total: number;
  auto: number;
  manual: number;
}

export interface ProgressSnapshot {
  done: number;
  total: number;
}

export interface HomeContext {
  src?: ProviderId;
  dst?: ProviderId;
  playlistId?: string;
  matchStats?: MatchStats;
  unresolvedIds?: string[];
  error?: HomeError | null;
  progress?: ProgressSnapshot;
  abortController?: AbortController | null;
}

export type HomeError =
  | { kind: "auth"; provider: ProviderId; message: string }
  | { kind: "network"; message: string; retryable: boolean }
  | { kind: "rate-limit"; provider: ProviderId; retryAt?: number }
  | { kind: "mapping"; trackId?: string; message: string }
  | { kind: "unknown"; message: string };

export interface HomeState {
  step: HomeStep;
  context: HomeContext;
}

export type HomeEvent =
  | { type: "INIT" }
  | { type: "AUTH_START" }
  | { type: "AUTH_SUCCESS" }
  | { type: "AUTH_FAILURE"; error: HomeError }
  | { type: "SELECT_PROVIDERS"; src: ProviderId; dst: ProviderId }
  | { type: "START_VERIFY"; playlistId: string }
  | { type: "VERIFY_SUCCESS"; unresolvedIds: string[]; stats: MatchStats }
  | { type: "VERIFY_FAILURE"; error: HomeError }
  | { type: "START_MAP" }
  | { type: "MAP_SUCCESS"; unresolvedIds: string[]; stats: MatchStats }
  | { type: "MAP_FAILURE"; error: HomeError }
  | { type: "START_TRANSFER" }
  | { type: "TRANSFER_PROGRESS"; progress: ProgressSnapshot }
  | { type: "TRANSFER_SUCCESS" }
  | { type: "TRANSFER_FAILURE"; error: HomeError }
  | { type: "CANCEL" }
  | { type: "RESET" };

export interface HomeActions {
  init: () => void;
  authStart: () => void;
  authSuccess: () => void;
  authFailure: (error: HomeError) => void;
  selectProviders: (src: ProviderId, dst: ProviderId) => void;
  startVerify: (playlistId: string) => void;
  verifySuccess: (payload: {
    unresolvedIds: string[];
    stats: MatchStats;
  }) => void;
  verifyFailure: (error: HomeError) => void;
  startMap: () => void;
  mapSuccess: (payload: { unresolvedIds: string[]; stats: MatchStats }) => void;
  mapFailure: (error: HomeError) => void;
  startTransfer: () => void;
  transferProgress: (progress: ProgressSnapshot) => void;
  transferSuccess: () => void;
  transferFailure: (error: HomeError) => void;
  cancel: () => void;
  reset: () => void;
}
