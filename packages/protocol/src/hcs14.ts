import { createHash } from "node:crypto";

/**
 * Computes a syntactically-valid HCS-14 ("Universal Agent ID") identifier,
 * per the published grammar at hol.org/docs/standards/hcs-14:
 *
 *   uaid:aid:{base58(sha384(canonicalJson))};uid=...;registry=...;proto=...;nativeId=...
 *
 * CLAUDE.md section 36 deliberately treats HCS-14 as optional and
 * non-blocking, since it's still a draft standard with no stable public
 * registry to integrate against. This computes a correctly-shaped id
 * locally - it is NOT registered with, or resolvable via, any live
 * Hashgraph Online (or other) HCS-14 registry. `registry`/`protocol` below
 * are Hark's own self-declared namespace values, not officially assigned
 * codes.
 *
 * Deliberately server-only (uses node:crypto) - imported via the
 * `@hark-protocol/protocol/hcs14` subpath, not the package's main barrel, so
 * it never ends up in a browser bundle (packages/protocol's main export is
 * consumed by apps/web client components too).
 */
export type Hcs14AgentInput = {
  /** Stable identifier within the registry, e.g. the agent's slug. */
  uid: string;
  name: string;
  /** CAIP-10-shaped native chain identifier, e.g. "hedera:testnet:0.0.12345". */
  nativeId: string;
  registry?: string;
  protocol?: string;
  version?: string;
  skills?: string[];
};

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes: Uint8Array): string {
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      carry += digits[i]! * 256;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let leadingZeros = 0;
  for (const byte of bytes) {
    if (byte !== 0) break;
    leadingZeros += 1;
  }

  return (
    BASE58_ALPHABET[0]!.repeat(leadingZeros) +
    digits
      .reverse()
      .map((digit) => BASE58_ALPHABET[digit]!)
      .join("")
  );
}

export function computeHcs14Id(input: Hcs14AgentInput): string {
  const registry = input.registry ?? "hark-protocol";
  const protocol = input.protocol ?? "hark-x402";
  const version = input.version ?? "0.1.0";

  const canonical = JSON.stringify({
    registry,
    name: input.name,
    version,
    protocol,
    nativeId: input.nativeId,
    skills: input.skills ?? [],
  });

  const hash = createHash("sha384").update(canonical).digest();
  const id = base58Encode(hash);

  return `uaid:aid:${id};uid=${input.uid};registry=${registry};proto=${protocol};nativeId=${input.nativeId}`;
}
