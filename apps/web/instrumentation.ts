/**
 * Next runs this once when the server boots.
 *
 * The dynamic import has to sit *inside* a positive `=== "nodejs"` check —
 * that exact shape is what lets Next dead-code-eliminate the boot sequence,
 * and its node-only dependencies, out of the Edge bundle. An early
 * `if (... !== "nodejs") return;` reads the same but does not eliminate, and
 * the Edge build then fails on `node:crypto` and friends.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // `next build` runs this hook too. A build must not migrate a database,
    // start a scheduler, or require a runtime secret.
    if (process.env.NEXT_PHASE === "phase-production-build") return;

    const { boot } = await import("./lib/boot");
    try {
      boot();
    } catch (err) {
      // Next keeps the process alive when this hook throws, which leaves a
      // container Docker still calls "running" but that can never serve.
      // A misconfigured server should stop, so the supervisor reports it.
      process.stderr.write(`\n[cockpit] ${(err as Error).message}\n\n`);
      process.exit(1);
    }
  }
}
