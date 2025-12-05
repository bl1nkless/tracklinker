import { ManualMatchEditor } from "@/components/ManualMatchEditor";
import type { MatchRow } from "@/components/MatchTable";
import type { ManualMatchEditorProps } from "@/components/ManualMatchEditor";
import type { ProviderSearchResult } from "@/core/types";
import { ResultsTable } from "@/features/home/components/ResultsTable";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

export interface ReviewStepProps {
  matches: MatchRow[];
  manualItems: ManualMatchEditorProps["items"];
  manualValues: ManualMatchEditorProps["values"];
  manualErrors: ManualMatchEditorProps["errors"];
  savingManualId: string | null;
  onManualValueChange: ManualMatchEditorProps["onValueChange"];
  onManualSubmit: ManualMatchEditorProps["onSubmit"];
  onCandidateSelect: (
    trackId: string,
    candidate: ProviderSearchResult
  ) => void;
  stats: {
    total: number;
    auto: number;
    manual: number;
  };
  mappingError: string | null;
  isMapping: boolean;
  onRemap: () => void;
  hasPlaylistSelected: boolean;
}

export function ReviewStep({
  matches,
  manualItems,
  manualValues,
  manualErrors,
  savingManualId,
  onManualValueChange,
  onManualSubmit,
  onCandidateSelect,
  stats,
  mappingError,
  isMapping,
  onRemap,
  hasPlaylistSelected,
}: ReviewStepProps) {
  return (
    <section className="space-y-4">
      <div className="surface p-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Проверка соответствий
            </h2>
            <p className="text-xs text-slate-400">
              {stats.auto} из {stats.total} треков подобраны автоматически.{" "}
              {stats.manual} треб
              {stats.manual === 1 ? "ует" : "уют"} ручной проверки.
            </p>
          </div>
          <button
            type="button"
            onClick={onRemap}
            className="btn btn-secondary gap-2 text-xs"
            disabled={isMapping || !hasPlaylistSelected}
          >
            <ArrowPathIcon
              className={clsx("h-4 w-4", isMapping && "animate-spin")}
            />
            {isMapping ? "Сканируем…" : "Пересканировать"}
          </button>
        </header>

        {mappingError ? (
          <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {mappingError}
          </div>
        ) : null}

        {isMapping ? (
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-sm text-slate-400">
            Выполняем маппинг и подготавливаем соответствия…
          </div>
        ) : (
          <div className="mt-3">
            <ResultsTable rows={matches} />
          </div>
        )}
      </div>

      <div className="surface p-5">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-100">
            Ручное сопоставление
          </h3>
          <p className="text-xs text-slate-500">
            Вставьте ссылку на YouTube-видео или video ID для оставшихся треков.
          </p>
        </div>
        <div className="mt-3">
          <ManualMatchEditor
            items={manualItems}
            values={manualValues}
            errors={manualErrors}
            savingId={savingManualId}
            onValueChange={onManualValueChange}
            onSubmit={onManualSubmit}
            onCandidateSelect={onCandidateSelect}
          />
        </div>
      </div>
    </section>
  );
}
