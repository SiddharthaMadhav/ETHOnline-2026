import { tinybarAdd, tinybarLte } from "@hark-protocol/protocol";

/** The agent's own local budget state (CLAUDE.md section 25). */
export type RunBudgetState = {
  spentTinybar: string;
  runBudgetTinybar: string;
};

/**
 * Defense-in-depth on top of (not a replacement for) Hark's own server-side
 * budget enforcement in apps/api/src/services/payment-service.ts. The LLM
 * recommends relevance; only this deterministic check - never the model -
 * decides whether money can move.
 */
export function canAffordReach(
  state: RunBudgetState,
  priceTinybar: string,
  maxPriceTinybar: string,
): boolean {
  if (!tinybarLte(priceTinybar, maxPriceTinybar)) return false;
  if (!tinybarLte(tinybarAdd(state.spentTinybar, priceTinybar), state.runBudgetTinybar)) return false;
  return true;
}
