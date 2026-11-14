// Nguồn: trích và điều chỉnh từ ../../x402-pay-per-request/src/server.mjs và networks.mjs (starter kit BTC)
import express from "express";
import { formatUnits, isAddress, parseUnits } from "viem";
import { avalancheFuji } from "viem/chains";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";

export const FUJI_NET = {
  name: "Avalanche Fuji",
  id: "eip155:43113",
  chain: avalancheFuji,
  usdc: process.env.USDC_ADDRESS || "0x5425890298aed601595a70AB815c96711a31Bc65",
  explorer: "https://testnet.snowtrace.io",
};

export const toUnits = (usdc) => parseUnits(String(usdc), 6).toString();
export const fromUnits = (units) => formatUnits(BigInt(units), 6);
export const txLink = (hash) => `${FUJI_NET.explorer}/tx/${hash}`;

/**
 * Creates and starts an Express seller server protected by x402 exact-EVM middleware.
 */
export async function createPaidSellerServer(config) {
  const { name, port, payTo, priceUsdc, routeKey, description, registerRoutes } = config;
  const facilitatorUrl = (process.env.FACILITATOR_URL || "http://localhost:4022").replace(/\/+$/, "");

  if (!isAddress(payTo)) {
    console.error(`[${name}] Invalid payTo address: "${payTo}".`);
    process.exit(1);
  }

  const priceObj = {
    amount: toUnits(priceUsdc),
    asset: FUJI_NET.usdc,
    extra: { name: "USD Coin", version: "2" },
  };

  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const payments = new x402ResourceServer(facilitatorClient).register(FUJI_NET.id, new ExactEvmScheme());

  try {
    await payments.initialize();
  } catch (err) {
    console.error(`[${name}] No facilitator answers at ${facilitatorUrl}:`, err?.message || err);
    process.exit(1);
  }

  if (!payments.getSupportedKind(2, FUJI_NET.id, "exact")) {
    console.error(`[${name}] Facilitator at ${facilitatorUrl} does not support ${FUJI_NET.id} exact scheme.`);
    process.exit(1);
  }

  payments.onAfterVerify(async ({ result }) => {
    if (!result.isValid) {
      console.log(`[${name}] Refused payment from ${result.payer || "unknown"}: ${result.invalidReason} ${result.invalidMessage || ""}`);
    } else {
      console.log(`[${name}] Verified payment from ${result.payer}`);
    }
  });

  payments.onAfterSettle(async ({ result, requirements }) => {
    if (result.success) {
      console.log(`[${name}] Settled ${fromUnits(requirements.amount)} USDC from ${result.payer}: ${txLink(result.transaction)}`);
    } else {
      console.log(`[${name}] Settle failed for ${result.payer || "unknown"}: ${result.errorReason} ${result.errorMessage || ""}`);
    }
  });

  const app = express();

  app.use(
    paymentMiddleware(
      {
        [routeKey]: {
          accepts: [{ scheme: "exact", network: FUJI_NET.id, payTo, price: priceObj }],
          description,
          mimeType: "application/json",
        },
      },
      payments,
    ),
  );

  app.get("/", (_req, res) => {
    res.json({
      name,
      network: FUJI_NET.name,
      networkId: FUJI_NET.id,
      facilitator: facilitatorUrl,
      payTo,
      paid: { [routeKey]: `${priceUsdc} USDC (${priceObj.amount} units)` },
    });
  });

  registerRoutes(app);

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`[${name}] Listening on http://localhost:${port}`);
      console.log(`[${name}] Protected route: ${routeKey} | Price: ${priceUsdc} USDC (${priceObj.amount} units)`);
      console.log(`[${name}] PayTo: ${payTo} | Facilitator: ${facilitatorUrl}`);
      resolve({ app, server });
    });
  });
}
