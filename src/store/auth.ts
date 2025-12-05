import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ProviderId } from '@/core/types';
import {
  createTokenKey,
  deleteToken,
  getToken,
  saveToken,
  type TokenRecord,
} from '@/services/idb';

export interface ProviderTokenState {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scopes: string[];
  obtainedAt: number;
}

export interface AuthState {
  tokens: Partial<Record<ProviderId, ProviderTokenState>>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setToken: (
    provider: ProviderId,
    token: Omit<TokenRecord, 'key' | 'provider'>,
  ) => Promise<void>;
  clearToken: (provider: ProviderId) => Promise<void>;
  logoutAll: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools((set, get) => ({
    tokens: {},
    hydrated: false,
    hydrate: async () => {
      if (get().hydrated) {
        return;
      }

      const providers: ProviderId[] = ['spotify', 'youtube'];
      const tokensEntries = await Promise.all(
        providers.map(async (provider) => {
          const record = await getToken(provider);
          if (!record) {
            return null;
          }

          const { key: _key, provider: _provider, ...rest } = record;
          return [provider, rest] as const;
        }),
      );

      const tokens = tokensEntries
        .filter((entry): entry is [ProviderId, ProviderTokenState] => !!entry)
        .reduce<Partial<Record<ProviderId, ProviderTokenState>>>(
          (acc, [provider, record]) => {
            acc[provider] = record;
            return acc;
          },
          {},
        );

      set({ tokens, hydrated: true });
    },
    setToken: async (provider, token) => {
      const key = createTokenKey(provider);
      await saveToken({
        ...token,
        key,
        provider,
      });

      set((state) => ({
        tokens: {
          ...state.tokens,
          [provider]: token,
        },
        hydrated: true,
      }));
    },
    clearToken: async (provider) => {
      await deleteToken(provider);
      set((state) => {
        const tokens = { ...state.tokens };
        delete tokens[provider];
        return { tokens, hydrated: true };
      });
    },
    logoutAll: async () => {
      const providers: ProviderId[] = ['spotify', 'youtube'];
      await Promise.all(providers.map((provider) => deleteToken(provider)));
      set({ tokens: {}, hydrated: true });
    },
  })),
);
