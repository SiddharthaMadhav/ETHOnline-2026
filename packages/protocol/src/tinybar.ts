/** Tinybar amounts are opaque decimal strings - compare/add via BigInt, never as floats. */
export function tinybarLte(a: string, b: string): boolean {
  return BigInt(a) <= BigInt(b);
}

export function tinybarAdd(a: string, b: string): string {
  return (BigInt(a) + BigInt(b)).toString();
}
