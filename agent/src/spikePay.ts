// Nguồn: trích và điều chỉnh từ ../../x402-pay-per-request/src/pay.mjs và networks.mjs (starter kit BTC)
import { formatUnits, parseUnits, isAddress, type Address, type Hex } from "viem";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { createSpikePolicySigner } from "./policySigner.ts";

const URL = process.argv[2] || process.env.API_URL || `http://localhost:${process.env.WEATHER_API_PORT || 4021}/api/weather?city=Da%20Lat`;
const MAX_PRICE = process.env.MAX_PRICE_USDC || "0.01";
const POLICY_ADDRESS = (process.argv[3] || process.env.SPIKE_POLICY_ADDRESS || process.env.AGENT_POLICY_ADDRESS || "") as Address;
const AGENT_KEY = (process.env.AGENT_PRIVATE_KEY || "") as Hex;
const USDC_ADDRESS = (process.env.USDC_ADDRESS || "0x5425890298aed601595a70AB815c96711a31Bc65") as Address;
const NETWORK_ID = "eip155:43113";
const EXPLORER = "https://testnet.snowtrace.io";

if (!isAddress(POLICY_ADDRESS)) {
  console.error("Missing valid policy address (pass as arg or SPIKE_POLICY_ADDRESS env).");
  process.exit(1);
}
if (!/^0x[0-9a-fA-F]{64}$/.test(AGENT_KEY)) {
  console.error("Missing valid AGENT_PRIVATE_KEY in env.");
  process.exit(1);
}

const toUnits = (usdc: string) => parseUnits(String(usdc), 6).toString();
const fromUnits = (units: string) => formatUnits(BigInt(units), 6);

const signer = createSpikePolicySigner({
  policyAddress: POLICY_ADDRESS,
  agentPrivateKey: AGENT_KEY,
  rpcUrl: process.env.FUJI_RPC_URL,
});

const client = x402Client.fromConfig({
  schemes: [{ network: NETWORK_ID, client: new ExactEvmScheme(signer) }],
  spendControls: {
    allowedAssets: [{ network: NETWORK_ID, asset: USDC_ADDRESS, maxAmountPerPayment: toUnits(MAX_PRICE) }],
  },
});

client.onBeforePaymentCreation(async ({ selectedRequirements: asked }) => {
  console.log(`[Buyer] 402 Payment Required: ${fromUnits(asked.amount)} USDC to ${asked.payTo} on ${NETWORK_ID}`);
  console.log(`[Buyer] Policy payer address: ${signer.address}`);
});

const payingFetch = wrapFetchWithPayment(fetch, client);

console.log(`[Buyer] Requesting ${URL}...`);
try {
  const response = await payingFetch(URL);
  console.log(`[Buyer] Response status: ${response.status}`);

  if (response.status === 402) {
    const reqHeader = response.headers.get("PAYMENT-REQUIRED");
    if (reqHeader) {
      const refused = decodePaymentRequiredHeader(reqHeader);
      console.error("[Buyer] 402 Refused payload:", JSON.stringify(refused, null, 2));
    }
    const bodyText = await response.text();
    if (bodyText) console.error("[Buyer] 402 body:", bodyText);
    process.exit(1);
  }

  const body = await response.text();
  console.log(`[Buyer] Body:`, body);

  const receiptHeader = response.headers.get("PAYMENT-RESPONSE");
  if (!receiptHeader) {
    console.error("[Buyer] No PAYMENT-RESPONSE header returned.");
    process.exit(1);
  }

  const receipt = decodePaymentResponseHeader(receiptHeader);
  console.log(`[Buyer] PAYMENT-RESPONSE:`, JSON.stringify(receipt, null, 2));
  if (receipt.transaction) {
    console.log(`[Buyer] Snowtrace TX: ${EXPLORER}/tx/${receipt.transaction}`);
  }
} catch (err: any) {
  console.error(`[Buyer] Error during paid fetch:`, err?.message || err);
  if (err?.cause) console.error(`[Buyer] Cause:`, err.cause);
  process.exit(1);
}
