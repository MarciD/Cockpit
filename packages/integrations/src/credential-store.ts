import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const run = promisify(execFile);

/**
 * Stores integration secrets outside the database and out of the browser.
 * Swap implementations without touching call sites:
 *   - KeychainStore       → macOS Keychain (local dev)
 *   - EncryptedFileStore  → portable fallback (CI, non-macOS)
 *   - (later) SecretManagerStore → GCP Secret Manager (hosted)
 */
export interface CredentialStore {
  get(key: string): Promise<string | null>;
  set(key: string, secret: string): Promise<void>;
  delete(key: string): Promise<void>;
}

const DEFAULT_SERVICE = "cockpit";

/** macOS Keychain via the `security` CLI — no native module required. */
export class KeychainStore implements CredentialStore {
  constructor(private readonly service: string = DEFAULT_SERVICE) {}

  async get(key: string): Promise<string | null> {
    try {
      const { stdout } = await run("security", [
        "find-generic-password",
        "-s",
        this.service,
        "-a",
        key,
        "-w",
      ]);
      return stdout.replace(/\n$/, "");
    } catch {
      return null; // item not found
    }
  }

  async set(key: string, secret: string): Promise<void> {
    // -U updates the item in place if it already exists.
    await run("security", [
      "add-generic-password",
      "-s",
      this.service,
      "-a",
      key,
      "-w",
      secret,
      "-U",
    ]);
  }

  async delete(key: string): Promise<void> {
    try {
      await run("security", [
        "delete-generic-password",
        "-s",
        this.service,
        "-a",
        key,
      ]);
    } catch {
      // already absent
    }
  }
}

interface EncryptedRecord {
  iv: string;
  salt: string;
  tag: string;
  data: string;
}

/**
 * AES-256-GCM encrypted JSON file keyed off a passphrase. Portable fallback
 * for environments without a system keychain. Node built-ins only.
 */
export class EncryptedFileStore implements CredentialStore {
  constructor(
    private readonly filePath: string,
    private readonly passphrase: string,
    /**
     * Passphrases this file may still be encrypted under. A record that only
     * opens with one of these is transparently re-encrypted under
     * `passphrase` on read, so rotating the secret costs nothing.
     */
    private readonly legacyPassphrases: readonly string[] = [],
  ) {}

  private async readAll(): Promise<Record<string, EncryptedRecord>> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as Record<
        string,
        EncryptedRecord
      >;
    } catch {
      return {};
    }
  }

  private async writeAll(all: Record<string, EncryptedRecord>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(all, null, 2), {
      mode: 0o600,
    });
  }

  /**
   * Every mutation is a read-modify-write of one shared file, so concurrent
   * calls would clobber each other — two widgets saving at once, or several
   * providers being rekeyed in parallel by the scheduler's startup refresh.
   * Serialize them through a promise chain (one process, one store instance).
   */
  private queue: Promise<unknown> = Promise.resolve();

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** null when this passphrase doesn't open the record (GCM tag mismatch). */
  private static open(rec: EncryptedRecord, passphrase: string): string | null {
    try {
      const dk = scryptSync(passphrase, Buffer.from(rec.salt, "base64"), 32);
      const decipher = createDecipheriv(
        "aes-256-gcm",
        dk,
        Buffer.from(rec.iv, "base64"),
      );
      decipher.setAuthTag(Buffer.from(rec.tag, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(rec.data, "base64")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      return null;
    }
  }

  async get(key: string): Promise<string | null> {
    const rec = (await this.readAll())[key];
    if (!rec) return null;

    const current = EncryptedFileStore.open(rec, this.passphrase);
    if (current !== null) return current;

    for (const legacy of this.legacyPassphrases) {
      const value = EncryptedFileStore.open(rec, legacy);
      if (value === null) continue;
      await this.set(key, value); // rekey under the current passphrase
      return value;
    }

    // Wrong passphrase for an existing record. Returning null makes the widget
    // ask to reconnect rather than throwing a 500, but that reads as "never
    // configured", so say what actually happened.
    process.stderr.write(
      `[cockpit] could not decrypt credential "${key}" in ${this.filePath} — ` +
        `is COCKPIT_SECRET the value it was saved with?\n`,
    );
    return null;
  }

  async set(key: string, secret: string): Promise<void> {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const dk = scryptSync(this.passphrase, salt, 32);
    const cipher = createCipheriv("aes-256-gcm", dk, iv);
    const enc = Buffer.concat([
      cipher.update(Buffer.from(secret, "utf8")),
      cipher.final(),
    ]);
    const record: EncryptedRecord = {
      iv: iv.toString("base64"),
      salt: salt.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: enc.toString("base64"),
    };
    await this.serialize(async () => {
      const all = await this.readAll();
      all[key] = record;
      await this.writeAll(all);
    });
  }

  async delete(key: string): Promise<void> {
    await this.serialize(async () => {
      const all = await this.readAll();
      delete all[key];
      await this.writeAll(all);
    });
  }
}
