const EXTENSION = /\.[a-z0-9]{2,4}$/i;
const BRACKETED_HASH = /\[[0-9a-f]{8}\]/gi;

/**
 * Identity of a file across bots and indexers: pack numbers get renumbered and
 * the same release sits on several bots, so the normalised filename is the key.
 */
export function releaseKey(filename: string): string {
  return filename
    .toLowerCase()
    .replace(BRACKETED_HASH, "")
    .replace(EXTENSION, "")
    .replace(/[._\s-]+/g, " ")
    .trim();
}
