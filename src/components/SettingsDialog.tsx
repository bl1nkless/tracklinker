import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition, Switch } from '@headlessui/react';
import clsx from 'clsx';
import { useSettingsStore } from '@/store/settings';
import { useShallow } from 'zustand/react/shallow';

export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

type ThemeOption = 'system' | 'light' | 'dark';
type LanguageOption = 'ru' | 'en';

interface FormState {
  spotifyClientId: string;
  googleClientId: string;
  odesliApiKey: string;
  theme: ThemeOption;
  lang: LanguageOption;
  syncOnOpen: boolean;
}

const themeOptions: Array<{ value: ThemeOption; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const languageOptions: Array<{ value: LanguageOption; label: string }> = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
];

const toFormState = (state: ReturnType<typeof useSettingsStore.getState>): FormState => ({
  spotifyClientId: state.spotifyClientId ?? '',
  googleClientId: state.googleClientId ?? '',
  odesliApiKey: state.odesliApiKey ?? '',
  theme: state.theme,
  lang: state.lang,
  syncOnOpen: state.syncOnOpen,
});

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const {
    hydrated,
    spotifyClientId,
    googleClientId,
    odesliApiKey,
    theme,
    lang,
    syncOnOpen,
  } = useSettingsStore(
    useShallow((state) => ({
      hydrated: state.hydrated,
      spotifyClientId: state.spotifyClientId,
      googleClientId: state.googleClientId,
      odesliApiKey: state.odesliApiKey,
      theme: state.theme,
      lang: state.lang,
      syncOnOpen: state.syncOnOpen,
    })),
  );
  const hydrateSettings = useSettingsStore((state) => state.hydrate);
  const updateSettings = useSettingsStore((state) => state.update);

  const [form, setForm] = useState<FormState>(() => toFormState(useSettingsStore.getState()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const redirectUri = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    const { origin, pathname } = window.location;
    return `${origin}${pathname}`;
  }, []);

  const hydrationOnceRef = useRef(false);
  useEffect(() => {
    if (!hydrationOnceRef.current) {
      hydrationOnceRef.current = true;
      void hydrateSettings();
    }
  }, [hydrateSettings]);

  useEffect(() => {
    if (open && hydrated) {
      setForm(toFormState(useSettingsStore.getState()));
    }
  }, [open, hydrated, spotifyClientId, googleClientId, odesliApiKey, theme, lang, syncOnOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await updateSettings({
        spotifyClientId: form.spotifyClientId.trim() || undefined,
        googleClientId: form.googleClientId.trim() || undefined,
        odesliApiKey: form.odesliApiKey.trim() || undefined,
        theme: form.theme,
        lang: form.lang,
        syncOnOpen: form.syncOnOpen,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyRedirect = () => {
    if (!redirectUri) {
      return;
    }
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(redirectUri).then(() => {
        setCopiedRedirect(true);
        window.setTimeout(() => setCopiedRedirect(false), 2000);
      });
    }
  };

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 px-6 py-6 shadow-2xl shadow-slate-950/70">
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div>
                    <Dialog.Title className="text-xl font-semibold text-slate-100">
                      Project Settings
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 text-sm text-slate-400">
                      Provide BYO OAuth client IDs and tweak runtime options.
                    </Dialog.Description>
                  </div>

                  <fieldset className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      OAuth Clients
                    </legend>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="flex flex-col gap-2 text-sm">
                        <span className="font-medium text-slate-200">
                          Spotify Client ID
                        </span>
                        <input
                          type="text"
                          value={form.spotifyClientId}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              spotifyClientId: event.target.value,
                            }))
                          }
                          className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand"
                          placeholder="e.g. 1234abcd..."
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm">
                        <span className="font-medium text-slate-200">
                          Google Client ID
                        </span>
                        <input
                          type="text"
                          value={form.googleClientId}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              googleClientId: event.target.value,
                            }))
                          }
                          className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand"
                          placeholder="client-id.apps.googleusercontent.com"
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-2 text-sm md:w-1/2">
                      <span className="font-medium text-slate-200">
                        Odesli API Key (optional)
                      </span>
                      <input
                        type="text"
                        value={form.odesliApiKey}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            odesliApiKey: event.target.value,
                          }))
                        }
                        className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand"
                        placeholder="sk_live_..."
                      />
                    </label>
                    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Redirect URI
                      </p>
                      <code className="block break-all rounded bg-slate-900/80 px-2 py-1 text-slate-200">
                        {redirectUri || '—'}
                      </code>
                      <p>
                        Добавьте этот адрес в <span className="text-slate-200">Spotify Dashboard</span> (
                        <em>Redirect URIs</em>) и <span className="text-slate-200">Google Cloud Console</span> (
                        <em>Authorized JavaScript origins</em>).
                      </p>
                      <button
                        type="button"
                        onClick={handleCopyRedirect}
                        className="inline-flex items-center justify-center rounded border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-brand hover:text-brand-foreground"
                      >
                        {copiedRedirect ? 'Copied!' : 'Copy to clipboard'}
                      </button>
                    </div>
                  </fieldset>

                  <fieldset className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Preferences
                    </legend>
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="flex flex-col gap-2 text-sm">
                        <span className="font-medium text-slate-200">
                          Theme
                        </span>
                        <select
                          value={form.theme}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              theme: event.target.value as ThemeOption,
                            }))
                          }
                          className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand"
                        >
                          {themeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-2 text-sm">
                        <span className="font-medium text-slate-200">
                          Language
                        </span>
                        <select
                          value={form.lang}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              lang: event.target.value as LanguageOption,
                            }))
                          }
                          className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand"
                        >
                          {languageOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex flex-col gap-2 text-sm">
                        <span className="font-medium text-slate-200">
                          Sync on open
                        </span>
                        <Switch
                          checked={form.syncOnOpen}
                          onChange={(checked) =>
                            setForm((prev) => ({
                              ...prev,
                              syncOnOpen: checked,
                            }))
                          }
                          className={clsx(
                            'relative inline-flex h-8 w-16 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-brand',
                            form.syncOnOpen
                              ? 'border-emerald-500/40 bg-emerald-500/60'
                              : 'border-slate-700 bg-slate-800',
                          )}
                        >
                          <span className="sr-only">Toggle sync on open</span>
                          <span
                            className={clsx(
                              'inline-block h-6 w-6 transform rounded-full bg-slate-950 transition',
                              form.syncOnOpen
                                ? 'translate-x-8 bg-emerald-900'
                                : 'translate-x-1',
                            )}
                          />
                        </Switch>
                        <span className="text-xs text-slate-500">
                          Automatically resume pending transfers when the app
                          loads.
                        </span>
                      </div>
                    </div>
                  </fieldset>

                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-600"
                      onClick={onClose}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm shadow-brand/40 transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
