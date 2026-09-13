/** Tinybar amounts are opaque decimal strings - compare/add via BigInt, never as floats. */
export function tinybarLte(a: string, b: string): boolean {
  return BigInt(a) <= BigInt(b);
}

export function tinybarAdd(a: string, b: string): string {
  return (BigInt(a) + BigInt(b)).toString();
}

/**
 * Splits a tinybar amount by basis points (1/100th of a percent). `share` and
 * `remainder` always sum back to exactly `amountTinybar` - integer division
 * rounds `share` down, so any rounding loss lands in `remainder` rather than
 * vanishing.
 */
export function splitTinybarByBps(
  amountTinybar: string,
  shareBps: number,
): { share: string; remainder: string } {
  if (!Number.isInteger(shareBps) || shareBps < 0 || shareBps > 10000) {
    throw new RangeError(`shareBps must be an integer between 0 and 10000, got ${shareBps}`);
  }
  const total = BigInt(amountTinybar);
  const share = (total * BigInt(shareBps)) / 10000n;
  const remainder = total - share;
  return { share: share.toString(), remainder: remainder.toString() };
}
