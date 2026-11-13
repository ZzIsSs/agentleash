// Nguồn: trích và điều chỉnh từ ../../x402-pay-per-request/src/server.mjs và networks.mjs (starter kit BTC)
import { createPaidSellerServer } from "./common.mjs";

const PORT = Number(process.env.RATES_API_PORT || 4023);
const PAY_TO = process.env.RATES_PAY_TO || "0x8D299966B407e9f189C1920f5A7324F13a9a4110";
const PRICE = process.env.RATES_PRICE_USDC || "0.001";

const MOCK_RATES_DB = {
  "USD/VND": {
    pair: "USD/VND",
    base: "USD",
    quote: "VND",
    rate: 25350,
    buyRate: 25180,
    sellRate: 25450,
    change24hPercent: 0.12,
  },
  "AVAX/USD": {
    pair: "AVAX/USD",
    base: "AVAX",
    quote: "USD",
    rate: 31.85,
    high24h: 32.6,
    low24h: 30.9,
    change24hPercent: 2.45,
  },
  "AVAX/VND": {
    pair: "AVAX/VND",
    base: "AVAX",
    quote: "VND",
    rate: 807397.5,
    change24hPercent: 2.57,
  },
  "EUR/VND": {
    pair: "EUR/VND",
    base: "EUR",
    quote: "VND",
    rate: 27420,
    buyRate: 27150,
    sellRate: 27650,
    change24hPercent: -0.18,
  },
  "JPY/VND": {
    pair: "JPY/VND",
    base: "JPY",
    quote: "VND",
    rate: 165.4,
    buyRate: 162.8,
    sellRate: 168.0,
    change24hPercent: 0.31,
  },
  "USDC/VND": {
    pair: "USDC/VND",
    base: "USDC",
    quote: "VND",
    rate: 25345,
    buyRate: 25200,
    sellRate: 25440,
    change24hPercent: 0.05,
  },
};

function parsePair(query) {
  if (query.from && query.to) {
    return `${String(query.from).trim().toUpperCase()}/${String(query.to).trim().toUpperCase()}`;
  }
  const raw = String(query.pair || "USD/VND").trim().toUpperCase();
  return raw.replace(/[-_]/g, "/");
}

await createPaidSellerServer({
  name: "RatesSeller",
  port: PORT,
  payTo: PAY_TO,
  priceUsdc: PRICE,
  routeKey: "GET /api/rates",
  description: "Structured mock FX & crypto exchange rates API (Avalanche Fuji x402)",
  registerRoutes(app) {
    app.get("/api/rates", (req, res) => {
      const pair = parsePair(req.query);
      const matched = MOCK_RATES_DB[pair];

      if (matched) {
        res.json({
          ...matched,
          inverseRate: Number((1 / matched.rate).toFixed(8)),
          isMockData: true,
          source: "AgentLeash Mock Exchange Rates API",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const [base = "USD", quote = "VND"] = pair.split("/");
      res.json({
        pair,
        base,
        quote,
        rate: 1.0,
        inverseRate: 1.0,
        change24hPercent: 0,
        note: "Pair not in primary mock table; returned deterministic fallback rate.",
        isMockData: true,
        source: "AgentLeash Mock Exchange Rates API",
        timestamp: new Date().toISOString(),
      });
    });
  },
});
