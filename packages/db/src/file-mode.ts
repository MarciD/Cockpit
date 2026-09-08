import { chmodSync } from "node:fs";

/**
 * Tighten the database files to owner-only.
 *
 * SQLite creates them with the process umask — 0644 on a default macOS or Linux
 * account — and they are not encrypted: the `cache` table holds plaintext
 * integration payloads (merge request titles, Jira issue summaries, calendar
 * events), alongside todos, learning history and profile names. Any other local
 * user could read all of it.
 *
 * `credentials.enc` beside it is already written `mode: 0o600`
 * (`packages/integrations/src/credential-store.ts`), so this closes an
 * inconsistency rather than inventing a policy.
 *
 * Best-effort by design. A bind-mounted volume, a root-owned directory or a
 * filesystem with no POSIX modes can all refuse, and failing to tighten
 * permissions must never stop the server from booting.
 */
export function restrictDbFileMode(dbPath: string): void {
  // The companions carry recently written pages, so they matter as much as the
  // database itself. -journal is included because a filesystem that refuses
  // `journal_mode = WAL` leaves SQLite in rollback-journal mode instead, and
  // then that is the file holding the data. Any of them may be absent — a
  // clean close checkpoints -wal and -shm away — which is not an error.
  for (const path of [
    dbPath,
    `${dbPath}-wal`,
    `${dbPath}-shm`,
    `${dbPath}-journal`,
  ]) {
    try {
      chmodSync(path, 0o600);
    } catch {
      // Absent, or not ours to change.
    }
  }
}
