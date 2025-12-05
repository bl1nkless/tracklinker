import { Children, type ReactNode } from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

export interface WizardStep { key: string; title: string; description?: string; }
export interface WizardProps {
  steps: WizardStep[];
  activeStep: number;
  onStepChange?: (index: number) => void;
  isStepDisabled?: (index: number) => boolean;
  children?: ReactNode;
  compact?: boolean;
}

export function Wizard({ steps, activeStep, onStepChange, isStepDisabled, children, compact = false }: WizardProps) {
  const panes = Children.toArray(children ?? []);
  const currentPane = panes[activeStep] ?? null;
  const progress = Math.round(((activeStep + 1) / steps.length) * 100);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/40 shadow-2xl shadow-black/60">
      {/* Step indicator */}
      <div className="px-4 sm:px-5 py-4">
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div className="h-full bg-brand" style={{ width: `${progress}%` }} aria-hidden="true" />
        </div>
        <ol className={clsx('flex items-stretch justify-between gap-2', compact ? '' : 'mb-1')} aria-label="Шаги">
          {steps.map((step, index) => {
            const isComplete = index < activeStep;
            const isCurrent  = index === activeStep;
            const disabled = isStepDisabled ? isStepDisabled(index) : false;
            
            return (
              <li key={step.key} className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => !disabled && onStepChange?.(index)}
                  disabled={disabled}
                  className={clsx(
                    'group flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                    disabled ? 'cursor-not-allowed opacity-50 border-slate-800 bg-slate-950/20 text-slate-600' :
                    isCurrent ? 'border-brand bg-brand/15 text-slate-100' :
                    isComplete ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' :
                                 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                  )}
                >
                  <span className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold',
                    disabled ? 'border-slate-800 bg-slate-900 text-slate-600' :
                    isCurrent ? 'border-brand bg-brand/20 text-black' :
                    isComplete ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-100' :
                                 'border-slate-700 bg-slate-800 text-slate-400'
                  )}>
                    {isComplete ? <CheckIcon className="h-5 w-5" aria-hidden="true" /> : index + 1}
                  </span>
                  <span className="truncate">
                    <span className="block text-sm font-semibold tracking-tight">{step.title}</span>
                    {step.description && !compact ? <span className="block truncate text-xs text-slate-500">{step.description}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Current pane */}
      {currentPane ? <section className="px-4 sm:px-5 py-5">{currentPane}</section> : null}
    </div>
  );
}

Wizard.Step = function WizardStepPane({ children }: { children: ReactNode; }) {
  return <div className="space-y-6">{children}</div>;
};
