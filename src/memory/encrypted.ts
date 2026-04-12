import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import {
  MemoryStoreError,
  type MemoryEvent,
  type MemoryQueryOpts,
  type MemoryStore,
} from "./types.js";

export class MemoryDecryptError extends MemoryStoreError {
  constructor(message: string) {
    super(message);
    this.name = "MemoryDecryptError";
  }
}

export interface EncryptedMemoryOptions {
  inner: MemoryStore;
  secret: string;
}

interface EnvelopeV1 {
  v: 1;
  iv: string;
  tag: string;
  ct: string;
}

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function encryptJson(value: unknown, key: Buffer): EnvelopeV1 {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value ?? null), "utf8");
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: ct.toString("base64"),
  };
}

function isEnvelopeV1(value: unknown): value is EnvelopeV1 {
  if (!value || typeof value !== "object") return false;
  const env = value as Record<string, unknown>;
  return (
    env.v === 1 &&
    typeof env.iv === "string" &&
    typeof env.tag === "string" &&
    typeof env.ct === "string"
  );
}

function decryptJson(envelope: unknown, key: Buffer): unknown {
  if (!isEnvelopeV1(envelope)) {
    throw new MemoryDecryptError(
      "failed to decrypt memory value: envelope missing required fields",
    );
  }
  try {
    const iv = Buffer.from(envelope.iv, "base64");
    const tag = Buffer.from(envelope.tag, "base64");
    const ct = Buffer.from(envelope.ct, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(pt.toString("utf8")) as unknown;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new MemoryDecryptError(
      `failed to decrypt memory value: ${reason}`,
    );
  }
}

export function withEncryption(opts: EncryptedMemoryOptions): MemoryStore {
  const { inner, secret } = opts;
  if (typeof secret !== "string" || secret.length === 0) {
    throw new MemoryStoreError(
      "encryption secret must be a non-empty string",
    );
  }
  const key = deriveKey(secret);

  return {
    async get(agentId: string, k: string): Promise<unknown> {
      const raw = await inner.get(agentId, k);
      if (raw === undefined || raw === null) return raw;
      return decryptJson(raw, key);
    },
    async set(agentId: string, k: string, value: unknown): Promise<void> {
      const envelope = encryptJson(value, key);
      await inner.set(agentId, k, envelope);
    },
    async list(agentId: string): Promise<string[]> {
      return inner.list(agentId);
    },
    async append(agentId: string, event: MemoryEvent): Promise<void> {
      const envelope = encryptJson(event.payload, key);
      const wrapped: MemoryEvent = {
        id: event.id,
        ts: event.ts,
        kind: event.kind,
        payload: envelope,
      };
      await inner.append(agentId, wrapped);
    },
    async query(
      agentId: string,
      qopts?: MemoryQueryOpts,
    ): Promise<MemoryEvent[]> {
      const events = await inner.query(agentId, qopts);
      return events.map((e) => ({
        id: e.id,
        ts: e.ts,
        kind: e.kind,
        payload: decryptJson(e.payload, key),
      }));
    },
    async close(): Promise<void> {
      await inner.close();
    },
  };
}
