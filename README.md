# AgentLeash

Ví cho AI agent có "dây xích" on-chain, dự thi **Team1 Vietnam UniHack 2026** trên Avalanche (track AI Agents / x402, hạn nộp 23:59 ngày 21/11/2026).

**Một câu:** AI agent tự trả tiền API qua x402, nhưng tiền nằm trong policy contract của chủ agent. Agent chỉ được xin chi, contract mới quyết chi theo hạn mức, whitelist và nút tắt khẩn cấp.

Kể cả khi agent bị chiếm, thiệt hại tối đa chỉ là phần hạn mức còn lại trong chu kỳ, và tiền chỉ chảy tới địa chỉ trong whitelist. LLM không bao giờ giữ khóa hay tự chuyển tiền. Chi tiết ở [docs/SPEC.md](docs/SPEC.md).

## Cấu trúc

| Thư mục | Nội dung | Trạng thái |
|---|---|---|
| `contracts/` | Policy contract `AgentPolicy` (Solidity, Foundry): hạn mức, whitelist, kill switch, ký x402 qua ERC-1271 | Khung Foundry, chưa có contract |
| `agent/` | LLM, rule engine và x402 client (TypeScript) | Chưa tạo |
| `sellers/` | 2–3 API mẫu thu phí qua x402 | Chưa tạo |
| `web/` | Dashboard Next.js: đăng nhập Privy, đồng hồ hạn mức, dòng tiền, kill switch | Khung Next.js |
| `docs/` | Đặc tả, kịch bản demo, ghi chú pitch | Có `SPEC.md` |

Starter kit x402 và Privy của ban tổ chức không nằm trong repo này. Chỉ chép phần code cần dùng.

## Chạy thử

```bash
# Contract
cd contracts
forge build
forge test

# Web
cd web
npm install
npm run dev   # http://localhost:3000
```

Mạng dùng: Avalanche **Fuji C-Chain** (chainId 43113), USDC test.

## Đội

- **Nguyên** (CNTT): contract, agent, web, hạ tầng
- **Giang** (Quản lý công nghiệp): kịch bản demo, pitch

Quy tắc cho AI agent trên máy thành viên khác: [AGENTS.md](AGENTS.md).
