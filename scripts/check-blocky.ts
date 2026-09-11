import { fileURLToPath } from "node:url";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { HTTPFacilitatorClient } from "@x402/core/server";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(scriptDir, "..", ".env") });

const facilitatorUrl = process.env.BLOCKY402_FACILITATOR_URL ?? "https://api.testnet.blocky402.com";
const targetNetwork = process.env.HEDERA_NETWORK ?? "hedera:testnet";

async function main() {
  console.log(`Checking Blocky402 facilitator: ${facilitatorUrl}`);

  const client = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const supported = await client.getSupported();

  const hederaKind = supported.kinds.find(
    (kind) => kind.network === targetNetwork && kind.scheme === "exact",
  );

  if (!hederaKind) {
    console.error(
      `Blocky402 does not advertise scheme "exact" for network "${targetNetwork}". ` +
        `Supported kinds: ${JSON.stringify(supported.kinds)}`,
    );
    process.exitCode = 1;
    return;
  }

  const feePayer = hederaKind.extra?.feePayer ?? "(not advertised)";
  console.log(`OK: ${targetNetwork} / exact is supported. Facilitator fee payer: ${feePayer}`);
}

main().catch((error) => {
  console.error("Blocky402 check failed:", error);
  process.exitCode = 1;
});
