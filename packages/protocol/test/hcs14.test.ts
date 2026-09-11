import { describe, expect, it } from "vitest";
import { computeHcs14Id } from "../src/hcs14.js";

describe("computeHcs14Id", () => {
  it("produces the documented uaid:aid grammar with all parameters in canonical order", () => {
    const id = computeHcs14Id({
      uid: "novabook",
      name: "NovaBook Agent",
      nativeId: "hedera:testnet:0.0.10475939",
    });

    expect(id).toMatch(
      /^uaid:aid:[1-9A-HJ-NP-Za-km-z]+;uid=novabook;registry=hark-protocol;proto=hark-x402;nativeId=hedera:testnet:0\.0\.10475939$/,
    );
  });

  it("is deterministic for identical inputs", () => {
    const input = { uid: "flylite", name: "FlyLite Agent", nativeId: "hedera:testnet:0.0.10475939" };
    expect(computeHcs14Id(input)).toBe(computeHcs14Id(input));
  });

  it("changes the hash segment when any canonical field changes", () => {
    const base = { uid: "pace", name: "Pace Agent", nativeId: "hedera:testnet:0.0.10475939" };
    const idA = computeHcs14Id(base);
    const idB = computeHcs14Id({ ...base, nativeId: "hedera:testnet:0.0.99999999" });
    expect(idA).not.toBe(idB);
  });

  it("respects custom registry/protocol/version overrides", () => {
    const id = computeHcs14Id({
      uid: "x",
      name: "X",
      nativeId: "hedera:testnet:0.0.1",
      registry: "custom-registry",
      protocol: "custom-proto",
    });
    expect(id).toContain(";registry=custom-registry;proto=custom-proto;");
  });
});
