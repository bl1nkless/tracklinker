import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import {
  loadSettings,
  saveSettings,
  clearSettings,
  type ThemePreference,
} from '@/services/idb';

export interface SettingsState {
  lang: 'ru' | 'en';
  theme: ThemePreference;
  syncOnOpen: boolean;
  odesliApiKey?: string;
  googleClientId?: string;
  spotifyClientId?: string;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (input: Partial<Omit<SettingsState, 'hydrated' | 'hydrate' | 'update' | 'reset'>>) => Promise<void>;
  reset: () => Promise<void>;
}

const baseState: Omit<SettingsState, 'hydrate' | 'update' | 'reset'> = {
  lang: 'ru',
  theme: 'system',
  syncOnOpen: false,
  hydrated: false,
};

const mergeBaseState = (state: SettingsState) => ({
  ...state,
  lang: baseState.lang,
  theme: baseState.theme,
  syncOnOpen: baseState.syncOnOpen,
  odesliApiKey: undefined,
  googleClientId: undefined,
  spotifyClientId: undefined,
});

export const useSettingsStore = create<SettingsState>()(
  subscribeWithSelector(
    devtools((set, get) => ({
      ...baseState,
      hydrate: async () => {
        if (get().hydrated) {
          return;
        }

        const persisted = await loadSettings();
        if (persisted) {
          set((current) => ({
            ...current,
            lang: persisted.lang,
            theme: persisted.theme,
            syncOnOpen: persisted.syncOnOpen,
            odesliApiKey: persisted.odesliApiKey,
            googleClientId: persisted.googleClientId,
            spotifyClientId: persisted.spotifyClientId,
            hydrated: true,
          }));
          return;
        }

        set((current) => ({ ...current, hydrated: true }));
      },
      update: async (input) => {
        set((current) => ({
          ...current,
          ...input,
          hydrated: true,
        }));
      },
      reset: async () => {
        await clearSettings();
        set((current) => ({
          ...mergeBaseState(current),
          hydrated: true,
        }));
      },
    })),
  ),
);

const selectPersistedSlice = (state: SettingsState) => ({
  lang: state.lang,
  theme: state.theme,
  syncOnOpen: state.syncOnOpen,
  odesliApiKey: state.odesliApiKey,
  googleClientId: state.googleClientId,
  spotifyClientId: state.spotifyClientId,
});

useSettingsStore.subscribe(
  selectPersistedSlice,
  (slice) => {
    if (!useSettingsStore.getState().hydrated) {
      return;
    }
    void saveSettings({
      lang: slice.lang,
      theme: slice.theme,
      syncOnOpen: slice.syncOnOpen,
      odesliApiKey: slice.odesliApiKey,
      googleClientId: slice.googleClientId,
      spotifyClientId: slice.spotifyClientId,
    });
  },
  { equalityFn: shallow, fireImmediately: true },
);
