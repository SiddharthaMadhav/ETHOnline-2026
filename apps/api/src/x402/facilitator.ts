import { HTTPFacilitatorClient } from "@x402/core/server";
import { config } from "../config.js";

/** Blocky402 testnet facilitator client (CLAUDE.md section 18). */
export const facilitatorClient = new HTTPFacilitatorClient({
  url: config.blocky402FacilitatorUrl,
});
