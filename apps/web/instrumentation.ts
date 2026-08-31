/** Next.js runs this once when the server boots. The dynamic import lives
 *  inside the `=== "nodejs"` guard so Next dead-code-eliminates the boot
 *  sequence (and its node-only deps) from the Edge bundle. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { boot } = await import("./lib/boot");
    boot();
  }
}
