import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface DeveloperDiagnosticsProps {
  redirectUri: string;
  spotifyClientId?: string;
  googleClientId?: string;
  spotifyToken?: {
    expiresAt: number;
    scopes: string[];
  } | null;
  youtubeToken?: {
    expiresAt: number;
    scopes: string[];
  } | null;
  logs: string[];
  onSpotifySilentCheck: () => void;
  onYouTubeSilentCheck: () => void;
  onSpotifyInteractive?: () => void;
  onYouTubeInteractive?: () => void;
}

export function DeveloperDiagnostics({
  redirectUri,
  spotifyClientId,
  googleClientId,
  spotifyToken,
  youtubeToken,
  logs,
  onSpotifySilentCheck,
  onYouTubeSilentCheck,
  onSpotifyInteractive,
  onYouTubeInteractive,
}: DeveloperDiagnosticsProps) {
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-inner shadow-slate-950/40">
      <header className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-slate-100">
          Developer Diagnostics
        </h3>
        <p className="text-xs text-slate-500">
          Проверяйте OAuth-конфигурацию на реальных client_id и фиксируйте
          библиотеку Google Identity Services.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <DiagnosticCard
          title="Spotify OAuth"
          clientId={spotifyClientId}
          token={spotifyToken}
          redirectUri={redirectUri}
          onSilentCheck={onSpotifySilentCheck}
          onInteractive={onSpotifyInteractive}
          scopeHint="playlist-read-private playlist-read-collaborative"
        />
        <DiagnosticCard
          title="Google / YouTube Token"
          clientId={googleClientId}
          token={youtubeToken}
          redirectUri={redirectUri}
          onSilentCheck={onYouTubeSilentCheck}
          onInteractive={onYouTubeInteractive}
          scopeHint="https://www.googleapis.com/auth/youtube"
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
          Redirect URI (укажите в обоих кабинетах)
        </p>
        <code className="block overflow-x-auto rounded-lg bg-slate-950/80 px-3 py-2 text-xs text-slate-200">
          {redirectUri}
        </code>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
          Diagnostic log
        </p>
        <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 text-xs font-mono text-slate-300">
          {logs.length === 0 ? (
            <p className="px-3 py-2 text-slate-500">
              Нет записей — выполните проверки выше.
            </p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {logs.map((line, index) => (
                <li key={`${line}-${index}`} className="px-3 py-1.5">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

interface DiagnosticCardProps {
  title: string;
  clientId?: string;
  token?: { expiresAt: number; scopes: string[] } | null;
  redirectUri: string;
  onSilentCheck: () => void;
  onInteractive?: () => void;
  scopeHint: string;
}

function DiagnosticCard({
  title,
  clientId,
  token,
  redirectUri,
  onSilentCheck,
  onInteractive,
  scopeHint,
}: DiagnosticCardProps) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="text-xs text-slate-500">
          Скопируйте redirect URI в панели разработчика и выполните проверку.
        </p>
      </div>
      <InfoRow label="Client ID">
        {clientId ? (
          <span className="break-all text-xs text-slate-300">{clientId}</span>
        ) : (
          <span className="text-xs text-amber-300">
            Client ID не заполнен в настройках
          </span>
        )}
      </InfoRow>
      <InfoRow label="Scopes">
        <span className="text-xs text-slate-300">{scopeHint}</span>
      </InfoRow>
      <InfoRow label="Token status">
        {token ? (
          <span className="text-xs text-slate-300">
            expires {formatExpires(token.expiresAt)} · {token.scopes.length}{' '}
            scopes
          </span>
        ) : (
          <span className="text-xs text-slate-500">нет активного токена</span>
        )}
      </InfoRow>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onSilentCheck}
          className="flex-1 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-brand hover:text-brand-foreground"
        >
          Silent check
        </button>
        <button
          type="button"
          onClick={onInteractive}
          className={clsx(
            'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition',
            onInteractive
              ? 'bg-brand text-brand-foreground shadow shadow-brand/40 hover:bg-brand/90'
              : 'bg-slate-800 text-slate-500',
          )}
          disabled={!onInteractive}
        >
          Prompt OAuth
        </button>
      </div>
      <InfoRow label="Redirect URI">
        <span className="line-clamp-2 break-all text-xs text-slate-300">
          {redirectUri}
        </span>
      </InfoRow>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      {children}
    </div>
  );
}

function formatExpires(expiresAt: number): string {
  const now = Date.now();
  const delta = expiresAt - now;
  if (delta <= 0) {
    return 'expired';
  }
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) {
    const seconds = Math.floor(delta / 1000);
    return `in ${seconds}s`;
  }
  if (minutes < 60) {
    return `in ${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  return `in ${hours}h`;
}
