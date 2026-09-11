import { PrivateKey } from "@hiero-ledger/sdk";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";

export type AgentWalletConfig = {
  accountId: string;
  privateKey: string;
  network: string;
  /** Per-payment cap passed to the client's spend-control allow-list, see below. */
  maxPriceTinybar: string;
};

/**
 * Builds a payment-wrapped fetch for one advertiser agent's Hedera wallet.
 *
 * Reuses the exact signer/client wiring already proven live in
 * scripts/live-payment-smoke.ts, including the allowedAssets entry: @x402/fetch's
 * client-side spend guard only recognizes each network's "default" asset
 * (Hedera's is USDC) unless HBAR (0.0.0) is explicitly allow-listed, capped here
 * at the agent's own configured max price.
 */
export function createAgentFetch(walletConfig: AgentWalletConfig): typeof fetch {
  const signer = createClientHederaSigner(
    walletConfig.accountId,
    PrivateKey.fromStringECDSA(walletConfig.privateKey),
    { network: walletConfig.network },
  );

  const network = walletConfig.network as `${string}:${string}`;
  const client = new x402Client().register(network, new ExactHederaScheme(signer)).setSpendControls({
    allowedAssets: [{ network, asset: "0.0.0", maxAmountPerPayment: walletConfig.maxPriceTinybar }],
  });

  return wrapFetchWithPayment(fetch, client);
}
