/** An on-demand contextual hint (the LLM-generated "+ more" part). */
export interface Hint {
  /** A short example sentence in the target language + a gloss. */
  example: string;
  /** A brief usage/grammar explanation. */
  explanation: string;
}
