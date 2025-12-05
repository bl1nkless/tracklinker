import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ProviderId, TrackCore, TransferRunLog } from '@/core/types';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface SettingsRecord {
  id: 'settings';
  lang: 'ru' | 'en';
  theme: ThemePreference;
  syncOnOpen: boolean;
  odesliApiKey?: string;
  googleClientId?: string;
  spotifyClientId?: string;
  lastUpdatedAt: number;
}

export interface TokenRecord {
  key: string;
  provider: ProviderId;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scopes: string[];
  obtainedAt: number;
}

export interface PlaylistSnapshotRecord {
  key: string;
  provider: ProviderId;
  playlistId: string;
  name: string;
  takenAt: number;
  trackIds: string[];
  snapshotId?: string;
}

export interface TrackRecord {
  key: string;
  provider: ProviderId;
  trackId: string;
  core: TrackCore;
  cachedAt: number;
}

export interface MatchRecord {
  key: string;
  sourceProvider: ProviderId;
  sourceTrackId: string;
  targetProvider: ProviderId;
  targetId: string;
  score: number;
  decidedBy: 'auto' | 'user';
  via: 'odesli' | 'yt_search' | 'manual';
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface RunRecord extends TransferRunLog {
  id?: number;
}

export interface LogEntryRecord {
  id: string;
  runId: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  ts: number;
  data?: Record<string, unknown>;
}

interface TrackLinkerDB extends DBSchema {
  settings: {
    key: string;
    value: SettingsRecord;
  };
  tokens: {
    key: string;
    value: TokenRecord;
  };
  playlists: {
    key: string;
    value: PlaylistSnapshotRecord;
  };
  tracks: {
    key: string;
    value: TrackRecord;
  };
  matches: {
    key: string;
    value: MatchRecord;
  };
  runs: {
    key: number;
    value: RunRecord;
  };
  logEntries: {
    key: string;
    value: LogEntryRecord;
    indexes: { runId: number };
  };
}

const DB_NAME = 'tracklinker';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<TrackLinkerDB>> | undefined;

async function getDb(): Promise<IDBPDatabase<TrackLinkerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TrackLinkerDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings');
          }
          if (!db.objectStoreNames.contains('tokens')) {
            db.createObjectStore('tokens', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('playlists')) {
            db.createObjectStore('playlists', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('tracks')) {
            db.createObjectStore('tracks', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('matches')) {
            db.createObjectStore('matches', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('runs')) {
            db.createObjectStore('runs', {
              keyPath: 'id',
              autoIncrement: true,
            });
          }
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('logEntries')) {
            const store = db.createObjectStore('logEntries', {
              keyPath: 'id',
            });
            store.createIndex('runId', 'runId', { unique: false });
          }
        }
      },
    });
  }

  return dbPromise;
}

export async function loadSettings(): Promise<SettingsRecord | null> {
  const db = await getDb();
  return (await db.get('settings', 'settings')) ?? null;
}

export type SettingsInput = Omit<SettingsRecord, 'id' | 'lastUpdatedAt'>;

export async function saveSettings(settings: SettingsInput): Promise<void> {
  const db = await getDb();
  const payload: SettingsRecord = {
    ...settings,
    id: 'settings',
    lastUpdatedAt: Date.now(),
  };
  await db.put('settings', payload, 'settings');
}

export async function clearSettings(): Promise<void> {
  const db = await getDb();
  await db.delete('settings', 'settings');
}

export function createTokenKey(provider: ProviderId): string {
  return `${provider}`;
}

export async function saveToken(token: TokenRecord): Promise<void> {
  const db = await getDb();
  await db.put('tokens', token);
}

export async function getToken(
  provider: ProviderId,
): Promise<TokenRecord | undefined> {
  const db = await getDb();
  return db.get('tokens', createTokenKey(provider));
}

export async function deleteToken(provider: ProviderId): Promise<void> {
  const db = await getDb();
  await db.delete('tokens', createTokenKey(provider));
}

export function createMatchKey(
  sourceProvider: ProviderId,
  sourceTrackId: string,
): string {
  return `${sourceProvider}:${sourceTrackId}`;
}

export async function saveMatch(record: MatchRecord): Promise<void> {
  const db = await getDb();
  await db.put('matches', record);
}

export async function getMatch(
  sourceProvider: ProviderId,
  sourceTrackId: string,
): Promise<MatchRecord | undefined> {
  const db = await getDb();
  return db.get('matches', createMatchKey(sourceProvider, sourceTrackId));
}

export async function saveTrackSnapshot(
  record: TrackRecord,
): Promise<void> {
  const db = await getDb();
  await db.put('tracks', record);
}

export async function getTrackSnapshot(
  provider: ProviderId,
  trackId: string,
): Promise<TrackRecord | undefined> {
  const db = await getDb();
  return db.get('tracks', `${provider}:${trackId}`);
}

export async function savePlaylistSnapshot(
  record: PlaylistSnapshotRecord,
): Promise<void> {
  const db = await getDb();
  await db.put('playlists', record);
}

export async function getPlaylistSnapshot(
  provider: ProviderId,
  playlistId: string,
): Promise<PlaylistSnapshotRecord | undefined> {
  const db = await getDb();
  return db.get('playlists', `${provider}:${playlistId}`);
}

export async function logRun(run: RunRecord): Promise<number> {
  const db = await getDb();
  return db.add('runs', run);
}

export async function updateRun(
  runId: number,
  patch: Partial<RunRecord>,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('runs', 'readwrite');
  const store = tx.store;
  const existing = await store.get(runId);
  if (!existing) {
    await tx.done;
    return;
  }
  await store.put({ ...existing, ...patch, id: runId });
  await tx.done;
}

export async function getRecentRuns(limit = 20): Promise<RunRecord[]> {
  const db = await getDb();
  const tx = db.transaction('runs', 'readonly');
  const store = tx.store;

  const result: RunRecord[] = [];
  let cursor = await store.openCursor(null, 'prev');

  while (cursor && result.length < limit) {
    result.push(cursor.value);
    cursor = await cursor.continue();
  }

  await tx.done;
  return result;
}

export async function appendLogEntry(entry: LogEntryRecord): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('logEntries', 'readwrite');
  await tx.store.put(entry);
  await tx.done;
}

export async function getLogEntries(
  runId: number,
  limit = 200,
): Promise<LogEntryRecord[]> {
  const db = await getDb();
  const tx = db.transaction('logEntries', 'readonly');
  const index = tx.store.index('runId');
  const entries: LogEntryRecord[] = [];
  let cursor = await index.openCursor(runId, 'prev');
  while (cursor && entries.length < limit) {
    entries.push(cursor.value);
    cursor = await cursor.continue();
  }
  await tx.done;
  return entries.reverse();
}

export async function clearDatabase(): Promise<void> {
  const db = await getDb();
  await Promise.all(
    Array.from(db.objectStoreNames).map((storeName) => db.clear(storeName)),
  );
}

export async function listCachedTracks(): Promise<TrackCore[]> {
  const db = await getDb();
  const tx = db.transaction('tracks', 'readonly');
  const items: TrackCore[] = [];
  let cursor = await tx.store.openCursor();

  while (cursor) {
    items.push(cursor.value.core);
    cursor = await cursor.continue();
  }

  await tx.done;
  return items;
}

export function resetForTesting(): void {
  dbPromise = undefined;
  void indexedDB.deleteDatabase(DB_NAME);
}
