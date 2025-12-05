import { lazy, Suspense } from "react";
import { Wizard } from "@/components/Wizard";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Topbar } from "@/features/home/components/Topbar";
import { AuthProvidersStep } from "@/features/home/components/steps/AuthProvidersStep";
import { PlaylistStep } from "@/features/home/components/steps/PlaylistStep";
import { ReviewStep } from "@/features/home/components/steps/ReviewStep";
import { TransferStep } from "@/features/home/components/steps/TransferStep";
import { useHomeViewModel } from "@/features/home/hooks/useHomeViewModel";

const DeveloperDiagnostics = lazy(() =>
  import("@/components/DeveloperDiagnostics").then((module) => ({
    default: module.DeveloperDiagnostics,
  }))
);

export default function HomePage() {
  const {
    ready,
    settingsOpen,
    openSettings,
    closeSettings,
    wizard,
    providersStep,
    playlistStep,
    reviewStep,
    transferStep,
    diagnostics,
    mappingInProgress,
    transferInProgress,
  } = useHomeViewModel();

  if (!ready) {
    return (
      <div className="min-h-screen bg-black text-slate-100">
        <Topbar onOpenSettings={openSettings} />
        <main className="mx-auto max-w-3xl px-4 py-20">
          <div className="surface p-6 subtle">
            Загружаем настройки приложения…
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100">
      <Topbar onOpenSettings={openSettings} />
      <main className="w-full px-4 py-6 pb-28">
        <form onSubmit={wizard.handleSubmit} className="space-y-4">
          <Wizard
            steps={wizard.steps}
            activeStep={wizard.activeStep}
            onStepChange={wizard.handleStepChange}
            isStepDisabled={wizard.isStepDisabled}
            compact
          />

          {wizard.activeStep === 0 ? (
            <AuthProvidersStep {...providersStep} />
          ) : null}

          {wizard.activeStep === 1 ? (
            <PlaylistStep {...playlistStep} />
          ) : null}

          {wizard.activeStep === 2 ? (
            <>
              <ReviewStep {...reviewStep} />
              <TransferStep {...transferStep} />
            </>
          ) : null}

          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
            <div className="pointer-events-auto mx-auto max-w-3xl border-t border-slate-800 bg-black/80 px-4 py-4 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>
                    Шаг {wizard.activeStep + 1} из {wizard.steps.length}
                  </span>
                  <span aria-hidden="true">•</span>
                  <span className="hidden sm:inline">
                    {wizard.activeStep === wizard.steps.length - 1
                      ? "Готово к переносу"
                      : "Заполните шаг и продолжайте"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={wizard.goBack}
                    disabled={
                      wizard.activeStep === 0 ||
                      mappingInProgress ||
                      transferInProgress
                    }
                    className="btn btn-secondary"
                  >
                    Назад
                  </button>
                  <button
                    type="submit"
                    disabled={wizard.nextDisabled}
                    className="btn btn-primary"
                  >
                    {wizard.activeStep === wizard.steps.length - 1
                      ? transferStep.isTransferring
                        ? "Перенос…"
                        : "Начать перенос"
                      : "Далее"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>

        <Suspense fallback={null}>
          <DeveloperDiagnostics {...diagnostics} />
        </Suspense>
      </main>

      <SettingsDialog open={settingsOpen} onClose={closeSettings} />
    </div>
  );
}
