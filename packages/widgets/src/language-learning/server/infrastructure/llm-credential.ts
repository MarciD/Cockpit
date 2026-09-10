/**
 * The Anthropic key comes from the app's credential store, which a widget
 * must not reach into directly; the server module sets this accessor when it
 * is built. Never the Claude subscription — Anthropic disallows that.
 */
export type LlmCredential = () => Promise<{ apiKey: string } | null>;

let accessor: LlmCredential = async () => null;

export function setLlmCredential(fn: LlmCredential): void {
  accessor = fn;
}

export function llmCredential(): Promise<{ apiKey: string } | null> {
  return accessor();
}
