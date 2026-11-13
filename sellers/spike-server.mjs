// Nguồn: trích và điều chỉnh từ ../../x402-pay-per-request/src/server.mjs và networks.mjs (starter kit BTC)
import express from "express";
import { formatUnits, isAddress, parseUnits } from "viem";
import { avalancheFuji } from "viem/chains";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";

const NET = {
  name: "Avalanche Fuji",
  id: "eip155:43113",
  chain: avalancheFuji,
  usdc: process.env.USDC_ADDRESS || "0x5425890298aed601595a70AB815c96711a31Bc65",
  explorer: "https://testnet.snowtrace.io",
};

const PORT = Number(process.env.WEATHER_API_PORT || process.env.PORT || 4021);
const PAY_TO = process.env.WEATHER_PAY_TO || process.env.PAY_TO || "";
const PRICE = process.env.WEATHER_PRICE_USDC || process.env.PRICE_USDC || "0.001";
const FACILITATOR_URL = (process.env.FACILITATOR_URL || "http://localhost:4022").replace(/\/+$/, "");

if (!isAddress(PAY_TO)) {
  console.error("Set WEATHER_PAY_TO or PAY_TO to a valid EVM address.");
  process.exit(1);
}

const toUnits = (usdc) => parseUnits(String(usdc), 6).toString();
const fromUnits = (units) => formatUnits(BigInt(units), 6);
const price = (usdc) => ({ amount: toUnits(usdc), asset: NET.usdc, extra: { name: "USD Coin", version: "2" } });
const txLink = (hash) => `${NET.explorer}/tx/${hash}`;

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const payments = new x402ResourceServer(facilitatorClient).register(NET.id, new ExactEvmScheme());

try {
  await payments.initialize();
} catch (err) {
  console.error(`No facilitator answers at ${FACILITATOR_URL}:`, err?.message || err);
  process.exit(1);
}

if (!payments.getSupportedKind(2, NET.id, "exact")) {
  console.error(`The facilitator at ${FACILITATOR_URL} does not handle ${NET.name} (${NET.id}) with exact scheme.`);
  process.exit(1);
}

payments.onAfterVerify(async ({ result }) => {
  if (!result.isValid) {
    console.log(`[Seller] Refused payment from ${result.payer || "unknown"}: ${result.invalidReason} ${result.invalidMessage || ""}`);
  } else {
    console.log(`[Seller] Verified payment from ${result.payer}`);
  }
});

payments.onAfterSettle(async ({ result, requirements }) => {
  if (result.success) {
    console.log(`[Seller] Settled ${fromUnits(requirements.amount)} USDC from ${result.payer}: ${txLink(result.transaction)}`);
  } else {
    console.log(`[Seller] Settle failed for ${result.payer || "unknown"}: ${result.errorReason} ${result.errorMessage || ""}`);
  }
});

const app = express();

app.use(
  paymentMiddleware(
    {
      "GET /api/weather": {
        accepts: [{ scheme: "exact", network: NET.id, payTo: PAY_TO, price: price(PRICE) }],
        description: `Mock weather data for Da Lat on ${NET.name}`,
        mimeType: "application/json",
      },
    },
    payments,
  ),
);

app.get("/", (req, res) => {
  res.json({
    name: "agentleash-spike-seller",
    network: NET.name,
    facilitator: FACILITATOR_URL,
    payTo: PAY_TO,
    paid: { "GET /api/weather": `${PRICE} USDC` },
  });
});

app.get("/api/weather", (req, res) => {
  const city = String(req.query.city || "Da Lat");
  res.json({
    city,
    temperatureC: 19,
    condition: "Cool & Misty",
    humidity: 82,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`[Seller] Listening on http://localhost:${PORT}/api/weather`);
  console.log(`[Seller] Price: ${PRICE} USDC on ${NET.name}, payTo: ${PAY_TO}`);
  console.log(`[Seller] Facilitator: ${FACILITATOR_URL}`);
});
