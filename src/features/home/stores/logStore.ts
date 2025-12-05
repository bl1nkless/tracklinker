import { create } from "zustand";
import { appendLogEntry, logRun, updateRun } from "@/services/idb";
import type { RunRecord } from "@/services/idb";

export type LogLevel = "info" | "warn" | "error";

export interface HomeLogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

interface StartRunInput {
  sourcePlaylistId: string;
  targetPlaylistId?: string;
}

interface FinalizeInput {
  added: number;
  skipped: number;
  failed: number;
  errors?: RunRecord["errors"];
}

interface HomeLogState {
  runId: number | null;
  entries: HomeLogEntry[];
  startedAt: number | null;
  startRun: (input: StartRunInput) => Promise<number>;
  add: (input: { level?: LogLevel; message: string; data?: Record<string, unknown> }) => void;
  finalize: (input: FinalizeInput) => Promise<void>;
  clear: () => void;
}

export const useHomeLogStore = create<HomeLogState>((set, get) => ({
  runId: null,
  entries: [],
  startedAt: null,
  startRun: async ({ sourcePlaylistId, targetPlaylistId }) => {
    const startedAt = Date.now();
    const runId = await logRun({
      startedAt,
      sourcePlaylistId,
      targetPlaylistId,
      added: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    });
    set({ runId, startedAt, entries: [] });
    return runId;
  },
  add: ({ level = "info", message, data }) => {
    const entry: HomeLogEntry = {
      id: crypto.randomUUID(),
      level,
      message,
      timestamp: new Date().toLocaleTimeString(),
      data,
    };
    set((state) => {
      const next = [...state.entries, entry].slice(-200);
      return { entries: next };
    });

    const { runId } = get();
    if (runId != null) {
      void appendLogEntry({
        id: entry.id,
        runId,
        level,
        message,
        ts: Date.now(),
        data,
      });
    }
  },
  finalize: async ({ added, skipped, failed, errors }) => {
    const { runId } = get();
    if (runId == null) {
      return;
    }
    await updateRun(runId, {
      finishedAt: Date.now(),
      added,
      skipped,
      failed,
      errors: errors ?? [],
    });
  },
  clear: () => set({ runId: null, entries: [], startedAt: null }),
}));
