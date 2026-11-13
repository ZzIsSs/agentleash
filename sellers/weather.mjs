// Nguồn: trích và điều chỉnh từ ../../x402-pay-per-request/src/server.mjs và networks.mjs (starter kit BTC)
import { createPaidSellerServer } from "./common.mjs";

const PORT = Number(process.env.WEATHER_API_PORT || 4021);
const PAY_TO = process.env.WEATHER_PAY_TO || "0x9D014376C3296db41770015AF074CF4D14c075E1";
const PRICE = process.env.WEATHER_PRICE_USDC || "0.001";

const MOCK_WEATHER_DB = {
  "da lat": {
    city: "Da Lat",
    temperatureC: 19,
    feelsLikeC: 18,
    condition: "Cool & Misty",
    humidity: 82,
    windKmh: 11,
    uvIndex: 4,
    clothingAdvice: "Mang áo khoác ấm nhẹ vào buổi tối và áo mưa mỏng vì có sương mù.",
    forecast: [
      { day: 1, label: "Hôm nay", minC: 14, maxC: 22, condition: "Sương mù sáng sớm, trưa nắng nhẹ", rainChancePct: 20 },
      { day: 2, label: "Ngày mai", minC: 15, maxC: 21, condition: "Nhiều mây, chiều có mưa rào nhẹ", rainChancePct: 45 },
      { day: 3, label: "Ngày kia", minC: 14, maxC: 23, condition: "Trời quang, se lạnh về đêm", rainChancePct: 10 },
    ],
  },
  "ha noi": {
    city: "Ha Noi",
    temperatureC: 24,
    feelsLikeC: 25,
    condition: "Partly Cloudy",
    humidity: 70,
    windKmh: 14,
    uvIndex: 5,
    clothingAdvice: "Trang phục thoáng mát ban ngày, khoác mỏng vào sáng sớm.",
    forecast: [
      { day: 1, label: "Hôm nay", minC: 20, maxC: 27, condition: "Nắng nhẹ, gió mùa Đông Bắc yếu", rainChancePct: 15 },
      { day: 2, label: "Ngày mai", minC: 19, maxC: 26, condition: "Có mây, không mưa", rainChancePct: 10 },
      { day: 3, label: "Ngày kia", minC: 20, maxC: 28, condition: "Trời ấm áp", rainChancePct: 20 },
    ],
  },
  "ho chi minh": {
    city: "Ho Chi Minh City",
    temperatureC: 31,
    feelsLikeC: 34,
    condition: "Warm & Breezy",
    humidity: 68,
    windKmh: 16,
    uvIndex: 8,
    clothingAdvice: "Trang phục thoáng mát, mang theo ô hoặc áo mưa đề phòng mưa dông chiều tối.",
    forecast: [
      { day: 1, label: "Hôm nay", minC: 25, maxC: 33, condition: "Nắng ấm, chiều có thể có mưa rào", rainChancePct: 40 },
      { day: 2, label: "Ngày mai", minC: 25, maxC: 34, condition: "Nắng nhiều", rainChancePct: 25 },
      { day: 3, label: "Ngày kia", minC: 24, maxC: 32, condition: "Mây rải rác", rainChancePct: 35 },
    ],
  },
};

function normalizeCityKey(raw) {
  return String(raw || "Da Lat")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase();
}

await createPaidSellerServer({
  name: "WeatherSeller",
  port: PORT,
  payTo: PAY_TO,
  priceUsdc: PRICE,
  routeKey: "GET /api/weather",
  description: "Structured mock weather & travel forecast API (Avalanche Fuji x402)",
  registerRoutes(app) {
    app.get("/api/weather", (req, res) => {
      const rawCity = String(req.query.city || "Da Lat").trim();
      const days = Math.min(Math.max(Number(req.query.days || 3), 1), 3);
      const key = normalizeCityKey(rawCity);
      const matched = MOCK_WEATHER_DB[key];

      const base = matched || {
        city: rawCity || "Da Lat",
        temperatureC: 22,
        feelsLikeC: 22,
        condition: "Mild & Clear",
        humidity: 72,
        windKmh: 12,
        uvIndex: 5,
        clothingAdvice: "Trang phục thoải mái, phù hợp di chuyển ngoài trời.",
        forecast: [
          { day: 1, label: "Hôm nay", minC: 18, maxC: 25, condition: "Nắng nhẹ", rainChancePct: 15 },
          { day: 2, label: "Ngày mai", minC: 18, maxC: 26, condition: "Ít mây", rainChancePct: 20 },
          { day: 3, label: "Ngày kia", minC: 19, maxC: 25, condition: "Mát mẻ", rainChancePct: 25 },
        ],
      };

      res.json({
        ...base,
        forecast: base.forecast.slice(0, days),
        isMockData: true,
        source: "AgentLeash Mock Weather API",
        timestamp: new Date().toISOString(),
      });
    });
  },
});
