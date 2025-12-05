import { Cog6ToothIcon } from "@heroicons/react/24/outline";

export interface TopbarProps {
  onOpenSettings: () => void;
}

export function Topbar({ onOpenSettings }: TopbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-black/70 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-black font-black">
            TL
          </span>
          <h1 className="text-lg font-semibold tracking-tight">TrackLinker</h1>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-900/60 text-slate-200 transition hover:border-brand hover:text-black hover:bg-brand"
          aria-label="Settings"
          title="Settings"
        >
          <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
