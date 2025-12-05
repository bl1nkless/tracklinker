import { useMemo, useReducer } from "react";
import type { Dispatch } from "react";
import type {
  HomeActions,
  HomeContext,
  HomeEvent,
  HomeState,
} from "@/features/home/types/home";

export const homeInitialContext: HomeContext = {
  error: null,
  abortController: null,
};

export const homeInitialState: HomeState = {
  step: "INIT",
  context: homeInitialContext,
};

export function homeReducer(state: HomeState, event: HomeEvent): HomeState {
  switch (event.type) {
    case "INIT":
      return { step: "INIT", context: { ...homeInitialContext } };
    case "AUTH_START":
      return {
        step: "AUTHENTICATING",
        context: { ...state.context, error: null },
      };
    case "AUTH_SUCCESS":
      return {
        step: "READY",
        context: { ...state.context, error: null },
      };
    case "AUTH_FAILURE":
      return {
        step: "ERROR",
        context: { ...state.context, error: event.error },
      };
    case "SELECT_PROVIDERS":
      return {
        ...state,
        context: {
          ...state.context,
          src: event.src,
          dst: event.dst,
        },
      };
    case "START_VERIFY":
      return {
        step: "VERIFYING",
        context: {
          ...state.context,
          playlistId: event.playlistId,
          error: null,
          progress: undefined,
        },
      };
    case "VERIFY_SUCCESS":
      return {
        step: "MAPPING",
        context: {
          ...state.context,
          matchStats: event.stats,
          unresolvedIds: event.unresolvedIds,
          error: null,
        },
      };
    case "VERIFY_FAILURE":
      return {
        step: "ERROR",
        context: { ...state.context, error: event.error },
      };
    case "START_MAP":
      return {
        ...state,
        step: "MAPPING",
        context: { ...state.context, error: null },
      };
    case "MAP_SUCCESS":
      return {
        step: "TRANSFERRING",
        context: {
          ...state.context,
          matchStats: event.stats,
          unresolvedIds: event.unresolvedIds,
          error: null,
        },
      };
    case "MAP_FAILURE":
      return {
        step: "ERROR",
        context: { ...state.context, error: event.error },
      };
    case "START_TRANSFER":
      return {
        ...state,
        step: "TRANSFERRING",
        context: {
          ...state.context,
          progress: { done: 0, total: state.context.matchStats?.total ?? 0 },
          error: null,
        },
      };
    case "TRANSFER_PROGRESS":
      return {
        ...state,
        context: {
          ...state.context,
          progress: event.progress,
        },
      };
    case "TRANSFER_SUCCESS":
      return {
        step: "SUCCESS",
        context: {
          ...state.context,
          progress: state.context.progress,
          error: null,
        },
      };
    case "TRANSFER_FAILURE":
      return {
        step: "ERROR",
        context: { ...state.context, error: event.error },
      };
    case "CANCEL":
      state.context.abortController?.abort("user-cancel");
      return {
        step: "CANCELED",
        context: { ...state.context, abortController: null },
      };
    case "RESET":
      return {
        step: "READY",
        context: {
          ...state.context,
          error: null,
          progress: undefined,
          matchStats: undefined,
          unresolvedIds: undefined,
          abortController: null,
        },
      };
    default:
      return state;
  }
}

export function useHomeOrchestrator(): {
  state: HomeState;
  dispatch: Dispatch<HomeEvent>;
  actions: HomeActions;
} {
  const [state, dispatch] = useReducer(homeReducer, homeInitialState);

  const actions = useMemo<HomeActions>(
    () => ({
      init: () => dispatch({ type: "INIT" }),
      authStart: () => dispatch({ type: "AUTH_START" }),
      authSuccess: () => dispatch({ type: "AUTH_SUCCESS" }),
      authFailure: (error) => dispatch({ type: "AUTH_FAILURE", error }),
      selectProviders: (src, dst) =>
        dispatch({ type: "SELECT_PROVIDERS", src, dst }),
      startVerify: (playlistId) =>
        dispatch({ type: "START_VERIFY", playlistId }),
      verifySuccess: ({ unresolvedIds, stats }) =>
        dispatch({
          type: "VERIFY_SUCCESS",
          unresolvedIds,
          stats,
        }),
      verifyFailure: (error) =>
        dispatch({ type: "VERIFY_FAILURE", error }),
      startMap: () => dispatch({ type: "START_MAP" }),
      mapSuccess: ({ unresolvedIds, stats }) =>
        dispatch({
          type: "MAP_SUCCESS",
          unresolvedIds,
          stats,
        }),
      mapFailure: (error) => dispatch({ type: "MAP_FAILURE", error }),
      startTransfer: () => dispatch({ type: "START_TRANSFER" }),
      transferProgress: (progress) =>
        dispatch({ type: "TRANSFER_PROGRESS", progress }),
      transferSuccess: () => dispatch({ type: "TRANSFER_SUCCESS" }),
      transferFailure: (error) =>
        dispatch({ type: "TRANSFER_FAILURE", error }),
      cancel: () => dispatch({ type: "CANCEL" }),
      reset: () => dispatch({ type: "RESET" }),
    }),
    []
  );

  return useMemo(
    () => ({
      state,
      dispatch,
      actions,
    }),
    [state, actions]
  );
}
