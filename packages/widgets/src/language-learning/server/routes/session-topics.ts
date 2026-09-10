import { json } from "../../../server/contract";
import { CURATED_TOPICS } from "../domain/topic";

export function handleGet() {
  return json({ topics: CURATED_TOPICS });
}
