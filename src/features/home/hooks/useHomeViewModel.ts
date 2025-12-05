import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { SpotifyProvider } from "@/providers/spotify";
import { YouTubeProvider } from "@/providers/youtube";
import type { TrackMapping } from "@/core/orchestrator";
import type {
  PlaylistCore,
  TransferPlan,
  TransferProgressUpdate,
} from "@/core/types";
import type { MatchRow, MatchStatus } from "@/components/MatchTable";
import type { ProgressLogEntry } from "@/components/ProgressLog";
import type { DeveloperDiagnosticsProps } from "@/components/DeveloperDiagnostics";
import type { WizardStep } from "@/components/Wizard";
import { useSettingsStore } from "@/store/settings";
import { useAuthStore } from "@/store/auth";
import { useHomeOrchestrator } from "@/features/home/hooks/useHomeOrchestrator";
import { useManualMatching } from "@/features/home/hooks/useManualMatching";
import { toHomeError } from "@/features/home/services/errorModel";
import { createTransferService } from "@/features/home/services/transferService";
import { useHomeLogStore } from "@/features/home/stores/logStore";
import type { AuthProvidersStepProps } from "@/features/home/components/steps/AuthProvidersStep";
import type { PlaylistStepProps } from "@/features/home/components/steps/PlaylistStep";
import type { ReviewStepProps } from "@/features/home/components/steps/ReviewStep";
import type { TransferStepProps } from "@/features/home/components/steps/TransferStep";

const STEPS: WizardStep[] = [
  {
    key: "auth",
    title: "Авторизация",
    description: "Подключите Spotify и Google",
  },
  { key: "playlist", title: "Плейлист", description: "Выберите источник" },
  { key: "review", title: "Проверка", description: "Сопоставьте треки" },
];

export interface HomeViewModel {
  ready: boolean;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  mappingInProgress: boolean;
  transferInProgress: boolean;
  wizard: {
    steps: typeof STEPS;
    activeStep: number;
    handleStepChange: (index: number) => void;
    handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
    nextDisabled: boolean;
    goBack: () => void;
    isStepDisabled: (index: number) => boolean;
  };
  providersStep: AuthProvidersStepProps;
  playlistStep: PlaylistStepProps;
  reviewStep: ReviewStepProps;
  transferStep: TransferStepProps;
  diagnostics: DeveloperDiagnosticsProps;
}

export function useHomeViewModel(): HomeViewModel {
  const { state: orchestrationState, actions: orchestratorActions } =
    useHomeOrchestrator();

  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const spotifyClientId = useSettingsStore((s) => s.spotifyClientId);
  const googleClientId = useSettingsStore((s) => s.googleClientId);
  const odesliApiKey = useSettingsStore((s) => s.odesliApiKey);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);

  const authHydrated = useAuthStore((s) => s.hydrated);
  const tokens = useAuthStore((s) => s.tokens);
  const hydrateAuth = useAuthStore((s) => s.hydrate);

  const spotifyAuthToken = tokens.spotify;
  const youtubeAuthToken = tokens.youtube;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const [busyProvider, setBusyProvider] = useState({
    spotify: false,
    youtube: false,
  });

  const [transferPlan, setTransferPlan] = useState<TransferPlan | null>(null);
  const [trackMappings, setTrackMappings] = useState<TrackMapping[]>([]);
  const [progressEntries, setProgressEntries] = useState<ProgressLogEntry[]>(
    []
  );
  const [mappedPlaylistId, setMappedPlaylistId] = useState<string | null>(null);
  const [isMapping, setIsMapping] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const {
    manualInputs,
    manualErrors,
    savingManualId,
    setManualInputs,
    resetErrors,
    handleManualValueChange,
    handleManualSubmit,
    handleCandidateSelect,
  } = useManualMatching({ setTrackMappings });

  const logEntries = useHomeLogStore((state) => state.entries);
  const addLogEntry = useHomeLogStore((state) => state.add);
  const startRunLog = useHomeLogStore((state) => state.startRun);
  const finalizeRunLog = useHomeLogStore((state) => state.finalize);
  const clearLogStore = useHomeLogStore((state) => state.clear);

  const logLines = useMemo(
    () =>
      logEntries.map(
        (entry) =>
          `${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.message}`
      ),
    [logEntries]
  );

  const settingsHydrateOnceRef = useRef(false);
  useEffect(() => {
    if (!settingsHydrateOnceRef.current) {
      settingsHydrateOnceRef.current = true;
      void hydrateSettings();
    }
  }, [hydrateSettings]);

  const authHydrateOnceRef = useRef(false);
  useEffect(() => {
    if (!authHydrateOnceRef.current) {
      authHydrateOnceRef.current = true;
      void hydrateAuth();
    }
  }, [hydrateAuth]);

  const redirectUri = useMemo(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    return url.pathname === "/" ? url.origin : `${url.origin}${url.pathname}`;
  }, []);

  const spotifyProvider = useMemo(() => {
    if (!spotifyClientId || !redirectUri) return null;
    return new SpotifyProvider({
      clientId: spotifyClientId,
      redirectUri,
      loadToken: async () => {
        const stored = useAuthStore.getState().tokens.spotify;
        if (!stored) return undefined;
        return {
          accessToken: stored.accessToken,
          refreshToken: stored.refreshToken,
          expiresAt: stored.expiresAt,
          scopes: stored.scopes,
          obtainedAt: stored.obtainedAt,
        };
      },
      saveToken: async (token) => {
        const store = useAuthStore.getState();
        if (!token) {
          await store.clearToken("spotify");
          return;
        }
        await store.setToken("spotify", {
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
          expiresAt: token.expiresAt,
          scopes: token.scopes,
          obtainedAt: token.obtainedAt,
        });
      },
    });
  }, [spotifyClientId, redirectUri]);

  const youtubeProvider = useMemo(() => {
    if (!googleClientId) return null;
    return new YouTubeProvider({
      clientId: googleClientId,
      scopes: [
        "https://www.googleapis.com/auth/youtube",
        "https://www.googleapis.com/auth/youtube.force-ssl",
      ],
      loadToken: async () => {
        const stored = useAuthStore.getState().tokens.youtube;
        if (!stored) return undefined;
        return {
          accessToken: stored.accessToken,
          expiresAt: stored.expiresAt,
          scopes: stored.scopes,
          obtainedAt: stored.obtainedAt,
        };
      },
      saveToken: async (token) => {
        const store = useAuthStore.getState();
        if (!token) {
          await store.clearToken("youtube");
          return;
        }
        await store.setToken("youtube", {
          accessToken: token.accessToken,
          refreshToken: undefined,
          expiresAt: token.expiresAt,
          scopes: token.scopes,
          obtainedAt: token.obtainedAt,
        });
      },
      onTokenInvalid: () => {
        void useAuthStore.getState().clearToken("youtube");
      },
    });
  }, [googleClientId]);

  const handleProgress = useCallback(
    (update: TransferProgressUpdate) => {
      orchestratorActions.transferProgress({
        done: update.processed ?? 0,
        total: update.total ?? 0,
      });
      const message = update.message ?? `Stage: ${update.stage}`;
      setProgressEntries((prev) => {
        const last = prev[prev.length - 1];
        if (last?.message === message) return prev;
        const entry: ProgressLogEntry = {
          id: `${Date.now()}-${update.stage}`,
          message,
          status:
            update.stage === "error"
              ? "error"
              : update.stage === "complete"
              ? "success"
              : "info",
          timestamp: new Date().toLocaleTimeString(),
        };
        return [...prev, entry].slice(-80);
      });
      addLogEntry({
        level: update.stage === "error" ? "error" : "info",
        message,
      });
    },
    [addLogEntry, orchestratorActions]
  );

  const transferService = useMemo(() => {
    if (!spotifyProvider || !youtubeProvider) return null;
    return createTransferService({
      source: spotifyProvider,
      target: youtubeProvider,
      onProgress: handleProgress,
      odesliApiKey: odesliApiKey || undefined,
    });
  }, [spotifyProvider, youtubeProvider, handleProgress, odesliApiKey]);

  useEffect(() => {
    if (!spotifyProvider) return;
    void spotifyProvider
      .handleRedirectCallback()
      .catch((err) => console.error("Spotify redirect handling failed", err));
  }, [spotifyProvider]);

  const spotifyConnected =
    Boolean(spotifyAuthToken) && Boolean(spotifyClientId);
  const youtubeConnected = Boolean(youtubeAuthToken) && Boolean(googleClientId);

  useEffect(() => {
    orchestratorActions.selectProviders("spotify", "youtube");
  }, [orchestratorActions]);

  useEffect(() => {
    if (!spotifyConnected || !youtubeConnected) {
      if (orchestrationState.step !== "INIT") {
        orchestratorActions.init();
      }
      return;
    }

    // TEMPORARY: Disabled automatic transition to allow manual disconnect
    // if (
    //   orchestrationState.step === "INIT" ||
    //   orchestrationState.step === "AUTHENTICATING"
    // ) {
    //   orchestratorActions.authSuccess();
    // }
  }, [
    orchestratorActions,
    orchestrationState.step,
    spotifyConnected,
    youtubeConnected,
  ]);

  const playlistsQuery = useQuery<PlaylistCore[]>({
    queryKey: ["spotify", "playlists", spotifyClientId],
    enabled: Boolean(spotifyProvider && spotifyConnected),
    queryFn: async () => {
      if (!spotifyProvider) throw new Error("Spotify provider not initialised");
      await spotifyProvider.auth(false);
      return spotifyProvider.listPlaylists();
    },
    staleTime: 60_000,
    retry: 1,
  });

  const playlists = useMemo(
    () => playlistsQuery.data ?? [],
    [playlistsQuery.data]
  );
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!playlists.length) {
      setSelectedPlaylistId(null);
      return;
    }
    if (
      !selectedPlaylistId ||
      !playlists.some((p) => p.id === selectedPlaylistId)
    ) {
      setSelectedPlaylistId(playlists[0].id);
    }
  }, [playlists, selectedPlaylistId]);

  const selectedPlaylist = useMemo(
    () => playlists.find((p) => p.id === selectedPlaylistId) ?? null,
    [playlists, selectedPlaylistId]
  );

  useEffect(() => {
    if (selectedPlaylistId !== mappedPlaylistId) {
      setTransferPlan(null);
      setTrackMappings([]);
      setManualInputs({});
      resetErrors();
      setProgressEntries([]);
    }
  }, [selectedPlaylistId, mappedPlaylistId, resetErrors, setManualInputs]);

  const runMapping = useCallback(async () => {
    if (!transferService || !selectedPlaylist) return;
    await startRunLog({
      sourcePlaylistId: selectedPlaylist.id,
    });
    addLogEntry({
      level: "info",
      message: `Начинаем подготовку плейлиста "${selectedPlaylist.name}"`,
    });
    orchestratorActions.startVerify(selectedPlaylist.id);
    setIsMapping(true);
    setMappingError(null);
    setTransferPlan(null);
    setTrackMappings([]);
    setManualInputs({});
    resetErrors();
    setProgressEntries([]);
    setMappedPlaylistId(null);
    try {
      const { plan, mappings, stats } = await transferService.verify(
        selectedPlaylist
      );
      setTransferPlan(plan);
      addLogEntry({
        level: "info",
        message: `Плейлист загружен: ${stats.total} треков`,
      });
      const unresolvedIds = mappings
        .filter((m) => !m.videoId)
        .map((m) => m.track.id);
      orchestratorActions.verifySuccess({ unresolvedIds, stats });
      orchestratorActions.mapSuccess({
        unresolvedIds,
        stats,
      });
      addLogEntry({
        level: "info",
        message: `Автоматически сопоставлено ${stats.auto} из ${stats.total}. Требуется ручная проверка: ${stats.manual}`,
      });
      setTrackMappings(mappings);
      setMappedPlaylistId(selectedPlaylist.id);
      const initialInputs = mappings.reduce<Record<string, string>>(
        (acc, match) => {
          if (!match.videoId) acc[match.track.id] = "";
          return acc;
        },
        {}
      );
      setManualInputs(initialInputs);
    } catch (error) {
      orchestratorActions.mapFailure(toHomeError(error));
      const message = error instanceof Error ? error.message : String(error);
      setMappingError(message);
      addLogEntry({
        level: "error",
        message: `Ошибка маппинга: ${message}`,
      });
    } finally {
      setIsMapping(false);
    }
  }, [
    addLogEntry,
    orchestratorActions,
    resetErrors,
    selectedPlaylist,
    setManualInputs,
    startRunLog,
    transferService,
  ]);

  const executeTransfer = useCallback(async () => {
    if (!transferService || !transferPlan) {
      setTransferError(
        "План переноса пока не готов. Сначала выполните маппинг."
      );
      addLogEntry({
        level: "warn",
        message: "Попытка переноса без готового плана.",
      });
      return;
    }
    orchestratorActions.startTransfer();
    setIsTransferring(true);
    setTransferError(null);
    setProgressEntries([]);
    try {
      const result = await transferService.execute(transferPlan, trackMappings);
      await finalizeRunLog({
        added: result.inserted,
        skipped: result.skipped,
        failed: result.failures.length,
        errors: result.failures.map((failure) => ({
          trackId: failure.track.id,
          message: failure.error ?? failure.reason ?? "unknown",
        })),
      });
      addLogEntry({
        level: "info",
        message: `Перенос завершён: добавлено ${result.inserted}, пропущено ${result.skipped}, ошибочно ${result.failures.length}`,
      });
      orchestratorActions.transferSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTransferError(message);
      await finalizeRunLog({
        added: 0,
        skipped: 0,
        failed: trackMappings.length,
        errors: trackMappings
          .filter((m) => !m.videoId)
          .map((m) => ({
            trackId: m.track.id,
            message,
          })),
      });
      addLogEntry({
        level: "error",
        message: `Перенос завершился ошибкой: ${message}`,
      });
      orchestratorActions.transferFailure(toHomeError(error));
    } finally {
      setIsTransferring(false);
    }
  }, [
    addLogEntry,
    finalizeRunLog,
    orchestratorActions,
    transferPlan,
    transferService,
    trackMappings,
  ]);

  const handleTransferCancel = useCallback(() => {
    orchestratorActions.cancel();
    addLogEntry({
      level: "warn",
      message: "Перенос отменён пользователем.",
    });
  }, [addLogEntry, orchestratorActions]);

  const spotifyDisabledReason = spotifyClientId
    ? undefined
    : "Добавьте Spotify Client ID в настройках.";
  const youtubeDisabledReason = googleClientId
    ? undefined
    : "Добавьте Google Client ID в настройках.";

  const playlistsStepError =
    (playlistsQuery.error as Error | undefined) ?? null;

  const matchRows = useMemo<MatchRow[]>(
    () =>
      trackMappings.map((mapping) => {
        const status: MatchStatus = mapping.videoId ? "matched" : "manual";
        const selectedCandidate =
          mapping.selectedCandidate ??
          mapping.candidates?.find((c) => c.id === mapping.videoId) ??
          null;
        const targetTitle =
          selectedCandidate?.title ??
          (mapping.videoId ? `YouTube video ${mapping.videoId}` : undefined);
        const targetUrl =
          selectedCandidate?.url ??
          (mapping.videoId
            ? `https://www.youtube.com/watch?v=${mapping.videoId}`
            : undefined);
        return {
          id: mapping.track.id,
          title: mapping.track.title,
          artists: mapping.track.artists,
          status,
          targetTitle,
          targetUrl,
          via: mapping.via,
          score: selectedCandidate?.score ?? mapping.score,
          channelTitle: selectedCandidate?.channelTitle,
          durationMs: selectedCandidate?.durationMs,
          durationDeltaMs: selectedCandidate?.durationDeltaMs,
          reasons: selectedCandidate?.reasons,
          official: selectedCandidate?.official,
          matchedBy: selectedCandidate?.matchedBy,
          note: mapping.reason ?? mapping.error,
        };
      }),
    [trackMappings]
  );

  const manualItems = useMemo(
    () =>
      trackMappings
        .filter((mapping) => !mapping.videoId)
        .map((mapping) => ({
          trackId: mapping.track.id,
          title: mapping.track.title,
          artists: mapping.track.artists,
          note: mapping.reason ?? mapping.error,
          candidates: mapping.candidates ?? [],
          selectedCandidateId: mapping.selectedCandidate?.id ?? null,
        })),
    [trackMappings]
  );

  const unmatchedCount = manualItems.length;
  const matchedCount = trackMappings.filter((m) => m.videoId).length;
  const totalTracks = trackMappings.length;

  const readyForTransfer =
    Boolean(transferPlan) && trackMappings.some((m) => Boolean(m.videoId));

  const activeStep = useMemo(() => {
    switch (orchestrationState.step) {
      case "INIT":
      case "AUTHENTICATING":
        return 0;
      case "READY":
        return 1;
      case "ERROR":
        return orchestrationState.context.matchStats ? 2 : 0;
      default:
        return 2;
    }
  }, [orchestrationState]);

  const canAdvance = useMemo(() => {
    if (activeStep === 0) return spotifyConnected && youtubeConnected;
    if (activeStep === 1)
      return Boolean(selectedPlaylist) && !playlistsQuery.isLoading;
    return true;
  }, [
    activeStep,
    spotifyConnected,
    youtubeConnected,
    selectedPlaylist,
    playlistsQuery.isLoading,
  ]);

  const nextDisabled =
    activeStep === STEPS.length - 1
      ? !readyForTransfer || isTransferring || isMapping
      : !canAdvance || isMapping || isTransferring;

  const handleWizardStepChange = useCallback(
    (index: number) => {
      if (index === activeStep) {
        return;
      }
      if (index === 0) {
        orchestratorActions.init();
        return;
      }
      if (index === 1) {
        orchestratorActions.reset();
        return;
      }
      if (index === 2 && selectedPlaylist) {
        void runMapping();
      }
    },
    [activeStep, orchestratorActions, runMapping, selectedPlaylist]
  );

  const handleWizardSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (activeStep === STEPS.length - 1) {
        void executeTransfer();
      } else if (!nextDisabled) {
        if (activeStep === 0) {
          orchestratorActions.authSuccess();
        } else if (activeStep === 1 && selectedPlaylist) {
          void runMapping();
        }
      }
    },
    [
      activeStep,
      executeTransfer,
      nextDisabled,
      orchestratorActions,
      selectedPlaylist,
      runMapping,
    ]
  );

  const handleGoBack = useCallback(() => {
    if (activeStep === 0 || isMapping || isTransferring) return;
    if (activeStep === 2) {
      orchestratorActions.reset();
    } else {
      orchestratorActions.init();
    }
  }, [activeStep, orchestratorActions, isMapping, isTransferring]);

  const isStepDisabled = useCallback(
    (index: number) => {
      if (isMapping || isTransferring) return true;
      if (index === 0) return false;
      if (index === 1) return !spotifyConnected || !youtubeConnected;
      if (index === 2)
        return !spotifyConnected || !youtubeConnected || !selectedPlaylist;
      return true;
    },
    [
      isMapping,
      isTransferring,
      spotifyConnected,
      youtubeConnected,
      selectedPlaylist,
    ]
  );

  const handleSpotifyConnect = useCallback(async () => {
    if (!spotifyProvider) {
      openSettings();
      addLogEntry({
        level: "warn",
        message: "Spotify provider не инициализирован — проверьте client_id.",
      });
      return;
    }
    orchestratorActions.authStart();
    addLogEntry({
      level: "info",
      message: "Запуск Spotify OAuth (interactive)...",
    });
    setBusyProvider((prev) => ({ ...prev, spotify: true }));
    try {
      await spotifyProvider.auth(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLogEntry({
        level: "error",
        message: `Spotify auth failed: ${message}`,
      });
    } finally {
      setBusyProvider((prev) => ({ ...prev, spotify: false }));
    }
  }, [addLogEntry, openSettings, orchestratorActions, spotifyProvider]);

  const handleSpotifyDisconnect = useCallback(async () => {
    setBusyProvider((prev) => ({ ...prev, spotify: true }));
    try {
      spotifyProvider?.clear();
      await useAuthStore.getState().clearToken("spotify");
      orchestratorActions.init();
      clearLogStore();
      setTransferPlan(null);
      setTrackMappings([]);
      setManualInputs({});
      resetErrors();
      setProgressEntries([]);
      addLogEntry({
        level: "info",
        message: "Spotify tokens очищены локально.",
      });
    } finally {
      setBusyProvider((prev) => ({ ...prev, spotify: false }));
    }
  }, [
    addLogEntry,
    clearLogStore,
    orchestratorActions,
    resetErrors,
    setManualInputs,
    spotifyProvider,
  ]);

  const handleYouTubeConnect = useCallback(async () => {
    if (!youtubeProvider) {
      openSettings();
      addLogEntry({
        level: "warn",
        message: "YouTube provider не инициализирован — проверьте client_id.",
      });
      return;
    }
    orchestratorActions.authStart();
    addLogEntry({
      level: "info",
      message: "Запуск Google Identity Services prompt...",
    });
    setBusyProvider((prev) => ({ ...prev, youtube: true }));
    try {
      await youtubeProvider.auth(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLogEntry({
        level: "error",
        message: `YouTube auth failed: ${message}`,
      });
    } finally {
      setBusyProvider((prev) => ({ ...prev, youtube: false }));
    }
  }, [addLogEntry, openSettings, orchestratorActions, youtubeProvider]);

  const handleYouTubeDisconnect = useCallback(async () => {
    setBusyProvider((prev) => ({ ...prev, youtube: true }));
    try {
      youtubeProvider?.clear();
      await useAuthStore.getState().clearToken("youtube");
      orchestratorActions.init();
      clearLogStore();
      addLogEntry({
        level: "info",
        message: "YouTube token очищен локально.",
      });
    } finally {
      setBusyProvider((prev) => ({ ...prev, youtube: false }));
    }
  }, [addLogEntry, clearLogStore, orchestratorActions, youtubeProvider]);

  const handleSpotifySilentCheck = useCallback(async () => {
    if (!spotifyProvider) {
      addLogEntry({
        level: "warn",
        message: "Spotify provider отсутствует для silent-проверки.",
      });
      return;
    }
    addLogEntry({
      level: "info",
      message: "Проверяем Spotify токен (silent)...",
    });
    try {
      await spotifyProvider.auth(false);
      addLogEntry({
        level: "info",
        message: "Spotify silent auth OK.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLogEntry({
        level: "error",
        message: `Spotify silent auth failed: ${message}`,
      });
    }
  }, [addLogEntry, spotifyProvider]);

  const handleYouTubeSilentCheck = useCallback(async () => {
    if (!youtubeProvider) {
      addLogEntry({
        level: "warn",
        message: "YouTube provider отсутствует для silent-проверки.",
      });
      return;
    }
    addLogEntry({
      level: "info",
      message: "Проверяем YouTube токен (silent)...",
    });
    try {
      await youtubeProvider.auth(false);
      addLogEntry({
        level: "info",
        message: "YouTube silent token OK.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLogEntry({
        level: "error",
        message: `YouTube silent token failed: ${message}`,
      });
    }
  }, [addLogEntry, youtubeProvider]);

  const ready = settingsHydrated && authHydrated;

  const providersStep: AuthProvidersStepProps = {
    providers: [
      {
        name: "Spotify",
        description: "Чтение плейлистов и треков через PKCE.",
        connected: spotifyConnected,
        busy: busyProvider.spotify,
        disabledReason: spotifyDisabledReason,
        token: spotifyAuthToken
          ? {
              expiresAt: spotifyAuthToken.expiresAt,
              scopes: spotifyAuthToken.scopes,
            }
          : null,
        onConnect: handleSpotifyConnect,
        onDisconnect: handleSpotifyDisconnect,
        onReauth: handleSpotifyConnect,
      },
      {
        name: "Google / YouTube",
        description: "Создание плейлистов и вставка треков.",
        connected: youtubeConnected,
        busy: busyProvider.youtube,
        disabledReason: youtubeDisabledReason,
        token: youtubeAuthToken
          ? {
              expiresAt: youtubeAuthToken.expiresAt,
              scopes: youtubeAuthToken.scopes,
            }
          : null,
        onConnect: handleYouTubeConnect,
        onDisconnect: handleYouTubeDisconnect,
        onReauth: handleYouTubeConnect,
      },
    ],
  };

  const playlistStep: PlaylistStepProps = {
    playlists,
    selectedId: selectedPlaylistId,
    onSelect: setSelectedPlaylistId,
    loading: playlistsQuery.isLoading,
    error: playlistsStepError,
  };

  const reviewStep: ReviewStepProps = {
    matches: matchRows,
    manualItems,
    manualValues: manualInputs,
    manualErrors,
    savingManualId,
    onManualValueChange: handleManualValueChange,
    onManualSubmit: handleManualSubmit,
    onCandidateSelect: handleCandidateSelect,
    stats: {
      total: totalTracks,
      auto: matchedCount,
      manual: unmatchedCount,
    },
    mappingError,
    isMapping,
    onRemap: () => {
      void runMapping();
    },
    hasPlaylistSelected: Boolean(selectedPlaylist),
  };

  const transferStep: TransferStepProps = {
    progressEntries,
    transferError,
    onExecute: executeTransfer,
    canTransfer: readyForTransfer,
    isTransferring,
    onCancel: handleTransferCancel,
  };

  const diagnostics: DeveloperDiagnosticsProps = {
    redirectUri,
    spotifyClientId: spotifyClientId ?? undefined,
    googleClientId: googleClientId ?? undefined,
    spotifyToken: spotifyAuthToken
      ? {
          expiresAt: spotifyAuthToken.expiresAt,
          scopes: spotifyAuthToken.scopes,
        }
      : null,
    youtubeToken: youtubeAuthToken
      ? {
          expiresAt: youtubeAuthToken.expiresAt,
          scopes: youtubeAuthToken.scopes,
        }
      : null,
    logs: logLines,
    onSpotifySilentCheck: handleSpotifySilentCheck,
    onYouTubeSilentCheck: handleYouTubeSilentCheck,
    onSpotifyInteractive: spotifyProvider ? handleSpotifyConnect : undefined,
    onYouTubeInteractive: youtubeProvider ? handleYouTubeConnect : undefined,
  };

  return {
    ready,
    settingsOpen,
    openSettings,
    closeSettings,
    mappingInProgress: isMapping,
    transferInProgress: isTransferring,
    wizard: {
      steps: STEPS,
      activeStep,
      handleStepChange: handleWizardStepChange,
      handleSubmit: handleWizardSubmit,
      nextDisabled,
      goBack: handleGoBack,
      isStepDisabled,
    },
    providersStep,
    playlistStep,
    reviewStep,
    transferStep,
    diagnostics,
  };
}
