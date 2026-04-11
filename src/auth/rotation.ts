import type { CredentialStore } from "./types.js";

export interface RotationOptions {
  inner: CredentialStore;
  now?: () => number;
  maxAgeMs?: number;
}

export interface RotatingCredentialStore extends CredentialStore {
  lastRotated(providerId: string): Promise<number | undefined>;
  stale(providerId: string, maxAgeMs?: number): Promise<boolean>;
  markRotated(providerId: string): Promise<void>;
}

const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const timestampKey = (providerId: string): string => `${providerId}:rotated-at`;

const isTimestampKey = (key: string): boolean => key.endsWith(":rotated-at");

export function withRotation(opts: RotationOptions): RotatingCredentialStore {
  const { inner } = opts;
  const now = opts.now ?? Date.now;
  const defaultMaxAge = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;

  const readTimestamp = async (providerId: string): Promise<number | undefined> => {
    const raw = await inner.get(timestampKey(providerId));
    if (raw === undefined) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const writeTimestamp = async (providerId: string): Promise<void> => {
    await inner.set(timestampKey(providerId), String(now()));
  };

  return {
    async get(providerId: string): Promise<string | undefined> {
      return inner.get(providerId);
    },
    async set(providerId: string, secret: string): Promise<void> {
      await inner.set(providerId, secret);
      await writeTimestamp(providerId);
    },
    async list(): Promise<string[]> {
      const all = await inner.list();
      return all.filter((key) => !isTimestampKey(key));
    },
    async remove(providerId: string): Promise<void> {
      await inner.remove(providerId);
      const existing = await inner.get(timestampKey(providerId));
      if (existing !== undefined) {
        await inner.remove(timestampKey(providerId));
      }
    },
    async lastRotated(providerId: string): Promise<number | undefined> {
      return readTimestamp(providerId);
    },
    async stale(providerId: string, maxAgeMs?: number): Promise<boolean> {
      const ts = await readTimestamp(providerId);
      if (ts === undefined) return true;
      const limit = maxAgeMs ?? defaultMaxAge;
      return now() - ts > limit;
    },
    async markRotated(providerId: string): Promise<void> {
      await writeTimestamp(providerId);
    },
  };
}
