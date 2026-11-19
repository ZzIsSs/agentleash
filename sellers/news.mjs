import { createPaidSellerServer } from "./common.mjs";

const PORT = Number(process.env.NEWS_API_PORT || 4024);
// Không có địa chỉ mặc định: địa chỉ mẫu kiểu Hardhat/Anvil có khóa bí mật công khai, ai cũng rút được USDC gửi vào.
const PAY_TO = process.env.NEWS_PAY_TO;
if (!PAY_TO) {
  console.error("[NewsSeller] Thiếu NEWS_PAY_TO trong .env (địa chỉ ví nhận tiền do bạn giữ khóa). Dừng.");
  process.exit(1);
}
const PRICE = process.env.NEWS_PRICE_USDC || "0.001";

const MOCK_NEWS_DB = {
  avalanche: [
    {
      title: "Avalanche Fuji x402 Facilitator settles sub-second agent micropayments",
      source: "Avalanche Dev Digest",
      sentiment: "positive",
    },
    {
      title: "ERC-1271 smart policy wallets gain traction for AI agent guardrails",
      source: "Web3 Security Weekly",
      sentiment: "positive",
    },
  ],
  dalat: [
    {
      title: "Da Lat weekend travel advisory: cool evening temperatures around 16°C",
      source: "Vietnam Travel Wire",
      sentiment: "neutral",
    },
    {
      title: "Flower festival routes see higher weekend demand near Xuan Huong Lake",
      source: "Lam Dong Local",
      sentiment: "positive",
    },
  ],
};

await createPaidSellerServer({
  name: "NewsSeller",
  port: PORT,
  payTo: PAY_TO,
  priceUsdc: PRICE,
  routeKey: "GET /api/news",
  description: "Structured mock news & intel API for testing unknown x402 seller onboarding",
  registerRoutes(app) {
    app.get("/api/news", (req, res) => {
      const topic = String(req.query.topic || "avalanche").trim().toLowerCase();
      // Object.hasOwn để topic như "constructor" hay "__proto__" không trả về thuộc tính của prototype.
      const articles = (Object.hasOwn(MOCK_NEWS_DB, topic) ? MOCK_NEWS_DB[topic] : null) || [
        {
          title: `Latest briefing on ${topic}`,
          source: "AgentLeash Mock News Wire",
          sentiment: "neutral",
        },
      ];

      res.json({
        topic,
        articles,
        isMockData: true,
        source: "AgentLeash Mock News API",
        timestamp: new Date().toISOString(),
      });
    });
  },
});
