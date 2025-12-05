import { ProgressLog, type ProgressLogEntry } from "@/components/ProgressLog";

export interface TransferStepProps {
  progressEntries: ProgressLogEntry[];
  transferError: string | null;
  onExecute: () => void;
  canTransfer: boolean;
  isTransferring: boolean;
  onCancel: () => void;
}

export function TransferStep({
  progressEntries,
  transferError,
  onExecute,
  canTransfer,
  isTransferring,
  onCancel,
}: TransferStepProps) {
  return (
    <section className="surface p-5 space-y-4">
      <header className="space-y-1">
        <h3 className="text-base font-semibold text-slate-100">Перенос</h3>
        <p className="text-xs text-slate-500">
          Добавление треков в целевой плейлист YouTube.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onExecute}
          className="btn btn-primary text-xs"
          disabled={!canTransfer || isTransferring}
        >
          {isTransferring ? "Переносим…" : "Начать перенос"}
        </button>
        {isTransferring ? (
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary text-xs"
          >
            Отменить
          </button>
        ) : null}
      </div>

      <ProgressLog entries={progressEntries} />
      {transferError ? (
        <p className="text-xs text-rose-300">{transferError}</p>
      ) : null}
    </section>
  );
}
