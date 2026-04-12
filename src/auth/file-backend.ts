import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import {
  CredentialStore,
  CredentialStoreError,
} from "./types.js";

export interface FileBackendOptions {
  filePath?: string;
  env?: NodeJS.ProcessEnv;
}

interface EncryptedEnvelope {
  version: 1;
  algorithm: "aes-256-gcm";
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

type Secrets = Record<string, string>;

const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const SCRYPT_COST = 1 << 14;

function defaultFilePath(): string {
  return join(homedir(), ".argent-lite", "credentials.json.enc");
}

function readMasterKey(env: NodeJS.ProcessEnv): string {
  const key = env.ARGENT_MASTER_KEY;
  if (!key || key.length === 0) {
    throw new CredentialStoreError(
      "ARGENT_MASTER_KEY is not set. Generate one with " +
        "`node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"` " +
        "and export it before using the file credential backend: " +
        "`export ARGENT_MASTER_KEY=<hex>`.",
    );
  }
  return key;
}

function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, KEY_LENGTH, { N: SCRYPT_COST });
}

function encrypt(secrets: Secrets, masterKey: string): EncryptedEnvelope {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(masterKey, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(secrets), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: "aes-256-gcm",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decrypt(envelope: EncryptedEnvelope, masterKey: string): Secrets {
  if (envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm") {
    throw new CredentialStoreError(
      `Unsupported credential envelope: version=${envelope.version} algorithm=${envelope.algorithm}`,
    );
  }
  const salt = Buffer.from(envelope.salt, "base64");
  const iv = Buffer.from(envelope.iv, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  const ciphertext = Buffer.from(envelope.ciphertext, "base64");
  const key = deriveKey(masterKey, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const parsed: unknown = JSON.parse(plaintext.toString("utf8"));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new CredentialStoreError("Decrypted credential payload is not an object.");
    }
    const result: Secrets = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v !== "string") {
        throw new CredentialStoreError(`Credential entry '${k}' is not a string.`);
      }
      result[k] = v;
    }
    return result;
  } catch (err) {
    if (err instanceof CredentialStoreError) throw err;
    throw new CredentialStoreError(
      "Failed to decrypt credential store. The ARGENT_MASTER_KEY is wrong or the file is corrupt.",
    );
  }
}

async function loadSecrets(filePath: string, masterKey: string): Promise<Secrets> {
  if (!existsSync(filePath)) return {};
  const raw = await readFile(filePath, "utf8");
  if (raw.trim().length === 0) return {};
  let envelope: EncryptedEnvelope;
  try {
    envelope = JSON.parse(raw) as EncryptedEnvelope;
  } catch {
    throw new CredentialStoreError(`Credential file at ${filePath} is not valid JSON.`);
  }
  return decrypt(envelope, masterKey);
}

async function saveSecrets(
  filePath: string,
  secrets: Secrets,
  masterKey: string,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
  const envelope = encrypt(secrets, masterKey);
  await writeFile(filePath, JSON.stringify(envelope, null, 2), { mode: 0o600 });
}

export function createFileBackend(options: FileBackendOptions = {}): CredentialStore {
  const env = options.env ?? process.env;
  const filePath = options.filePath ?? defaultFilePath();

  return {
    async get(providerId: string): Promise<string | undefined> {
      const masterKey = readMasterKey(env);
      const secrets = await loadSecrets(filePath, masterKey);
      return secrets[providerId];
    },

    async set(providerId: string, secret: string): Promise<void> {
      const masterKey = readMasterKey(env);
      const secrets = await loadSecrets(filePath, masterKey);
      secrets[providerId] = secret;
      await saveSecrets(filePath, secrets, masterKey);
    },

    async list(): Promise<string[]> {
      const masterKey = readMasterKey(env);
      const secrets = await loadSecrets(filePath, masterKey);
      return Object.keys(secrets).sort();
    },

    async remove(providerId: string): Promise<void> {
      const masterKey = readMasterKey(env);
      const secrets = await loadSecrets(filePath, masterKey);
      if (providerId in secrets) {
        delete secrets[providerId];
        await saveSecrets(filePath, secrets, masterKey);
      }
    },
  };
}
