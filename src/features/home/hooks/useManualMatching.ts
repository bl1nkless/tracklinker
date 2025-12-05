import { useCallback, useState } from "react";
import { createMatchKey, saveMatch } from "@/services/idb";
import { extractVideoId } from "@/services/odesli";
import type { ProviderSearchResult } from "@/core/types";
import type { TrackMapping } from "@/core/orchestrator";

interface ManualMatchingOptions {
  setTrackMappings: React.Dispatch<React.SetStateAction<TrackMapping[]>>;
}

interface ManualMatchingState {
  manualInputs: Record<string, string>;
  manualErrors: Record<string, string>;
  savingManualId: string | null;
  setManualInputs: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  resetErrors: () => void;
  handleManualValueChange: (trackId: string, value: string) => void;
  handleManualSubmit: (trackId: string) => Promise<void>;
  handleCandidateSelect: (
    trackId: string,
    candidate: ProviderSearchResult
  ) => Promise<void>;
}

export function useManualMatching({
  setTrackMappings,
}: ManualMatchingOptions): ManualMatchingState {
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});
  const [manualErrors, setManualErrors] = useState<Record<string, string>>({});
  const [savingManualId, setSavingManualId] = useState<string | null>(null);

  const resetErrors = useCallback(() => {
    setManualErrors({});
  }, []);

  const handleManualValueChange = useCallback(
    (trackId: string, value: string) => {
      setManualInputs((prev) => ({ ...prev, [trackId]: value }));
    },
    []
  );

  const handleManualSubmit = useCallback(
    async (trackId: string) => {
      const input = manualInputs[trackId]?.trim();
      if (!input) return;
      setSavingManualId(trackId);
      setManualErrors((prev) => {
        const next = { ...prev };
        delete next[trackId];
        return next;
      });
      try {
        const parsed =
          extractVideoId(input) ?? (input.length === 11 ? input : null);
        if (!parsed) {
          throw new Error("Не удалось распознать ссылку или video ID.");
        }
        await saveMatch({
          key: createMatchKey("spotify", trackId),
          sourceProvider: "spotify",
          sourceTrackId: trackId,
          targetProvider: "youtube",
          targetId: parsed,
          score: 1,
          decidedBy: "user",
          via: "manual",
          updatedAt: Date.now(),
          metadata: { manualInput: input },
        });
        setTrackMappings((prev) =>
          prev.map((mapping) =>
            mapping.track.id === trackId
              ? {
                  ...mapping,
                  videoId: parsed,
                  score: 1,
                  via: "manual",
                  decidedBy: "user",
                  reason: undefined,
                  error: undefined,
                }
              : mapping
          )
        );
        setManualInputs((prev) => {
          const next = { ...prev };
          delete next[trackId];
          return next;
        });
        setManualErrors((prev) => {
          const next = { ...prev };
          delete next[trackId];
          return next;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setManualErrors((prev) => ({ ...prev, [trackId]: message }));
      } finally {
        setSavingManualId(null);
      }
    },
    [manualInputs, setTrackMappings]
  );

  const handleCandidateSelect = useCallback(
    async (trackId: string, candidate: ProviderSearchResult) => {
      setSavingManualId(trackId);
      try {
        await saveMatch({
          key: createMatchKey("spotify", trackId),
          sourceProvider: "spotify",
          sourceTrackId: trackId,
          targetProvider: "youtube",
          targetId: candidate.id,
          score: candidate.score ?? 0,
          decidedBy: "user",
          via: "manual",
          updatedAt: Date.now(),
          metadata: { manualCandidate: candidate },
        });
        setTrackMappings((prev) =>
          prev.map((mapping) => {
            if (mapping.track.id !== trackId) return mapping;
            const resolvedCandidate =
              mapping.candidates?.find((it) => it.id === candidate.id) ??
              candidate;
            return {
              ...mapping,
              videoId: candidate.id,
              score: candidate.score ?? mapping.score,
              via: "manual",
              decidedBy: "user",
              selectedCandidate: resolvedCandidate,
              reason: undefined,
              error: undefined,
            };
          })
        );
        setManualInputs((prev) => {
          const next = { ...prev };
          delete next[trackId];
          return next;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setManualErrors((prev) => ({ ...prev, [trackId]: message }));
      } finally {
        setSavingManualId(null);
      }
    },
    [setTrackMappings]
  );

  return {
    manualInputs,
    manualErrors,
    savingManualId,
    setManualInputs,
    resetErrors,
    handleManualValueChange,
    handleManualSubmit,
    handleCandidateSelect,
  };
}
