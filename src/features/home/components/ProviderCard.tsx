import clsx from "clsx";

export interface ProviderCardProps {
  name: string;
  description: string;
  connected: boolean;
  busy?: boolean;
  disabledReason?: string;
  token?: { expiresAt: number; scopes: string[] } | null;
  onConnect: () => void | Promise<void>;
  onDisconnect: () => void | Promise<void>;
  onReauth?: () => void | Promise<void>;
}

export function ProviderCard({
  name,
  description,
  connected,
  busy,
  disabledReason,
  token,
  onConnect,
  onDisconnect,
  onReauth,
}: ProviderCardProps) {
  const handleClick = () => {
    if (connected) {
      void onDisconnect();
      return;
    }
    void onConnect();
  };

  const handleReauth = () => {
    if (onReauth) {
      void onReauth();
    } else {
      void onConnect();
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-slate-100">{name}</h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <span
          className={clsx(
            "chip",
            connected
              ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40"
              : "bg-slate-800/80 text-slate-300 ring-1 ring-slate-600"
          )}
        >
          {connected ? "Подключено" : "Не подключено"}
        </span>
      </div>

      {token ? (
        <div className="mt-3 space-y-1 text-xs text-slate-400">
          <p>
            Токен истекает{" "}
            <strong className="text-slate-200">
              {formatRelativeTime(token.expiresAt)}
            </strong>
          </p>
          <p className="text-xs leading-4 text-slate-500">
            Scopes: {token.scopes.join(", ") || "—"}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          Кешированный токен не обнаружен.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleClick}
          disabled={busy || Boolean(disabledReason)}
          className={clsx(
            "btn flex-1",
            connected ? "btn-secondary" : "btn-primary"
          )}
        >
          {busy
            ? connected
              ? "Отключаем…"
              : "Подключаем…"
            : connected
            ? "Отключить"
            : "Подключить"}
        </button>
        {connected ? (
          <button
            type="button"
            onClick={handleReauth}
            disabled={busy}
            className="btn btn-secondary flex-1 text-xs"
          >
            Prompt OAuth
          </button>
        ) : null}
      </div>

      {disabledReason ? (
        <p className="mt-2 text-xs text-amber-300">{disabledReason}</p>
      ) : null}
    </div>
  );
}

function formatRelativeTime(expiresAt: number): string {
  const delta = expiresAt - Date.now();
  if (delta <= 0) return "уже истёк";
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) {
    const seconds = Math.floor(delta / 1000);
    return `через ${seconds}s`;
  }
  if (minutes < 60) return `через ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `через ${hours}h`;
  const days = Math.floor(hours / 24);
  return `через ${days}d`;
}
