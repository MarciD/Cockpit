import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  EncryptedFileStore,
  KeychainStore,
  type CalendarMeta,
  type CalendarSource,
  type CalendarSourceKind,
  type CredentialStore,
  type GoogleCalendarConfig,
} from "@cockpit/integrations";

export type Provider = "gitlab" | "jira" | "google" | "anthropic" | "calendar";

/**
 * cockpit shipped with a hardcoded fallback passphrase before COCKPIT_SECRET
 * became mandatory. Files written then are still readable: EncryptedFileStore
 * re-encrypts any record that only opens with this under the real secret.
 */
const LEGACY_PASSPHRASES = ["cockpit-dev-insecure"];

const MISSING_SECRET = `COCKPIT_SECRET is not set.

It is the passphrase that encrypts data/credentials.enc, so cockpit refuses to
start without one — otherwise every stored token would be encrypted under a
value published in this repository.

  COCKPIT_SECRET=$(openssl rand -base64 32)

Put it in .env (Docker) or the LaunchAgent's EnvironmentVariables, and keep a
copy: losing it means re-entering every widget connection. On macOS you can set
COCKPIT_KEYCHAIN=1 instead and use the system Keychain.`;

/**
 * Encrypted local file by default (no GUI prompts, good for dev + CI). Set
 * COCKPIT_KEYCHAIN=1 to use the macOS Keychain instead.
 *
 * Built lazily: `next build` imports every route module, and the secret is a
 * runtime concern, not a build-time one.
 */
function buildStore(): CredentialStore {
  if (process.env.COCKPIT_KEYCHAIN === "1") {
    if (process.platform !== "darwin") {
      throw new Error(
        "COCKPIT_KEYCHAIN=1 needs macOS (it shells out to `security`). " +
          "Use COCKPIT_SECRET with the encrypted-file store instead.",
      );
    }
    return new KeychainStore("cockpit");
  }
  const passphrase = process.env.COCKPIT_SECRET?.trim();
  if (!passphrase) throw new Error(MISSING_SECRET);
  const file =
    process.env.COCKPIT_CRED_FILE ??
    resolve(process.cwd(), "../../data/credentials.enc");
  return new EncryptedFileStore(file, passphrase, LEGACY_PASSPHRASES);
}

let cachedStore: CredentialStore | null = null;

function store(): CredentialStore {
  cachedStore ??= buildStore();
  return cachedStore;
}

/** Called at boot so a missing secret fails loudly, not on the first request. */
export function assertCredentialStoreReady(): void {
  store();
}

const keyFor = (provider: Provider) => `provider:${provider}`;

export async function getProviderConfig<T>(
  provider: Provider,
): Promise<T | null> {
  const raw = await store().get(keyFor(provider));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setProviderConfig(
  provider: Provider,
  config: unknown,
): Promise<void> {
  await store().set(keyFor(provider), JSON.stringify(config));
}

export async function deleteProviderConfig(provider: Provider): Promise<void> {
  await store().delete(keyFor(provider));
}

// --- calendars (multi-iCal) --------------------------------------------------
// Connected calendars live under the "calendar" provider. The iCal URL is the
// secret and is never returned to the client — only label/color/source are.

const CALENDAR_COLORS = [
  "#c65a34",
  "#4b7d52",
  "#3e6f8e",
  "#a76a35",
  "#b1556e",
  "#7c8a55",
];
const pickColor = (i: number) =>
  CALENDAR_COLORS[i % CALENDAR_COLORS.length] ?? "#c65a34";

async function readCalendars(): Promise<CalendarSource[]> {
  const cfg = await getProviderConfig<{ calendars: CalendarSource[] }>(
    "calendar",
  );
  if (cfg?.calendars?.length) return cfg.calendars;
  // Migrate the legacy single "google" iCal feed into one calendar.
  const legacy = await getProviderConfig<GoogleCalendarConfig>("google");
  if (legacy?.icalUrl) {
    const migrated: CalendarSource[] = [
      {
        id: randomUUID(),
        label: "Calendar",
        color: pickColor(0),
        url: legacy.icalUrl,
        source: "google",
      },
    ];
    await setProviderConfig("calendar", { calendars: migrated });
    return migrated;
  }
  return [];
}

export async function listCalendars(): Promise<CalendarSource[]> {
  return readCalendars();
}

export async function addCalendar(input: {
  label: string;
  color?: string;
  source: CalendarSourceKind;
  url: string;
}): Promise<CalendarMeta> {
  const list = await readCalendars();
  const cal: CalendarSource = {
    id: randomUUID(),
    label: input.label,
    color: input.color || pickColor(list.length),
    url: input.url,
    source: input.source,
  };
  await setProviderConfig("calendar", { calendars: [...list, cal] });
  return { id: cal.id, label: cal.label, color: cal.color, source: cal.source };
}

export async function updateCalendar(
  id: string,
  patch: {
    label?: string;
    color?: string;
    source?: CalendarSourceKind;
    url?: string;
  },
): Promise<boolean> {
  const list = await readCalendars();
  let found = false;
  const next = list.map((c) => {
    if (c.id !== id) return c;
    found = true;
    return {
      ...c,
      ...(patch.label !== undefined ? { label: patch.label } : {}),
      ...(patch.color ? { color: patch.color } : {}),
      ...(patch.source ? { source: patch.source } : {}),
      ...(patch.url ? { url: patch.url } : {}),
    };
  });
  if (found) await setProviderConfig("calendar", { calendars: next });
  return found;
}

export async function deleteCalendar(id: string): Promise<void> {
  const list = await readCalendars();
  await setProviderConfig("calendar", {
    calendars: list.filter((c) => c.id !== id),
  });
}
