# AgentLeash

Ví cho AI agent có **"dây xích" on-chain** và **cổng kiểm thử & bảo vệ chi tiêu x402 (MCP Gateway)**, dự thi **Team1 Vietnam UniHack 2026** trên Avalanche (Track *AI Agents & Security / Agent Economy on x402*).

**Một câu:** AI agent tự thanh toán API qua chuẩn HTTP **x402**, nhưng USDC nằm trong `AgentPolicy` contract của chủ sở hữu; agent chỉ được xin duyệt chi (`authorize`), smart contract mới là chốt chặn cuối theo hạn mức 2 tầng (Trusted / Sandbox), whitelist và Kill Switch — bảo vệ dev, AI agent builders và người dùng khi agent gọi các API x402 mới qua CLI hoặc MCP.

> **Khai báo mô phỏng (Luật 6):** Bản demo rút ngắn chu kỳ hạn mức xuống **120 giây** (`DEMO_PERIOD_SECONDS=120`) thay cho 1 ngày thật, và hai API Thời tiết / Tỷ giá trả dữ liệu mock. Lượt chạy agent trong video dùng LLM giả lập (`--mock-llm`) theo kịch bản cố định; thanh toán x402, `AgentPolicy`, ERC-1271/EIP-3009 và quản trị policy vẫn chạy thật trên **Avalanche Fuji**. Tích hợp Gemini thật có sẵn qua `npm --prefix agent run demo:gd2`.

---

## Tầm nhìn & Hướng phát triển: Cổng bảo vệ chi tiêu x402 cho AI Agents (Bên A – Bên B)

Khi dùng các công cụ lập trình hoặc AI agent (**Bên A**: Antigravity, Claude Code, agent tự động...) kết nối với các dịch vụ thu phí theo lượt gọi chuẩn HTTP **x402**, chủ ví thường gặp 4 rủi ro lớn: **agent gọi nhầm endpoint lừa đảo/độc hại rút sạch ví**, **bị kẹt vòng lặp (loop bug) đốt hết ngân sách**, **prompt injection đổi địa chỉ nhận tiền (`payTo`)**, và **không kiểm soát được chất lượng dữ liệu trả về**.

**AgentLeash (Bên B)** tích hợp trực tiếp vào **Bên A** qua **MCP Gateway** để giải quyết bài toán này theo cơ chế **"Thử API x402 lạ an toàn → Duyệt thành API quen"**:

```mermaid
flowchart LR
  User["Chủ ví / Dev / Builder"] -->|"1. Giao việc cho agent"| A["Bên A: Antigravity / Claude Code / Agent"]
  A -->|"2. Gọi qua MCP Gateway"| B["Bên B: AgentLeash (RuleEngine + AgentPolicy)"]
  B -->|"API x402 lạ: Test qua 4 lớp bảo vệ"| Sandbox["Sandbox (trần siêu nhỏ, lọc SSRF, chặn loop, chấm output)"]
  B -->|"API x402 quen: Thực thi ổn định"| Trusted["Trusted / Whitelist (hạn mức cao hơn trên Fuji)"]
  User -->|"3. Bấm 1-click chuyển thành API quen"| B
```

1. **Tự động test API x402 lạ (4 lớp bảo vệ):**
   - **Trần ngân sách Sandbox siêu nhỏ:** Cho phép Bên A thử gọi API x402 lạ trong hạn mức an toàn tuyệt đối trên `AgentPolicy`.
   - **Kiểm tra an toàn & chống giả mạo:** Lọc URL độc hại, kiểm tra khớp `payTo`/giá và chặn SSRF.
   - **Chặn vòng lặp & Rate limit:** Tự động ngắt khi Bên A gọi lặp bất thường, thông báo nguyên nhân bằng tiếng Việt rõ ràng.
   - **Đánh giá chất lượng đầu ra (hướng mở rộng):** Kiểm tra dữ liệu API trả về có hợp lệ trước khi Bên A sử dụng tiếp.
2. **Sử dụng API quen & chuyển đổi 1-click:** Chủ ví xem danh sách các giao dịch/từ chối mà Bên A đã thử ngay trên Dashboard và bấm chọn **Chuyển thành API quen** (`setWhitelist`) để cấp hạn mức Trusted.
3. **Định vị tập trung thuần x402:** Giai đoạn đầu tập trung 100% vào thanh toán chuẩn **x402** (USDC trên Avalanche) cho dev / AI agent builders để kiến trúc gọn, đồng nhất và bảo mật on-chain tuyệt đối; dài hạn có thể cân nhắc bổ sung lớp mở rộng hỗ trợ API truyền thống nếu phục vụ thêm người dùng non-tech phổ thông.

> **Ranh giới bản nộp UniHack (21/11/2026):** Toàn bộ kiến trúc ví chính sách 2 tầng (`AgentPolicy`), Rule Engine, 2 API x402, CLI agent, Dashboard quản trị và bản MCP local (`agent/src/mcp.ts` trả kèm `DASHBOARD_URL`, cùng 1 lệnh setup tự ghi cấu hình để không phải sửa tay `.json`) nằm trong phạm vi nộp. Phần **phức tạp** để nâng cấp lên **Remote MCP đa người dùng** (Cloud `Streamable HTTP` + OAuth Privy + Session Key từng user + DB dùng chung với Vercel + Plugin Marketplace, cùng `POST`/body, siết SSRF IP nội bộ production và sổ `URL ↔ payTo` + chấm output) là **hướng phát triển tiếp theo sau 21/11** (chi tiết tại [docs/SPEC.md](docs/SPEC.md#L223)).

---

## Kiến trúc & Luồng bảo vệ 2 tầng

```mermaid
flowchart LR
  Owner["Chủ ví (Privy Email)"] -->|"createPolicy / setCaps / setWhitelist / pause"| Factory["AgentPolicyFactory & AgentPolicy (Fuji)"]
  Owner -->|"register(agentURI)"| ERC8004["ERC-8004 IdentityRegistry"]
  LLM["Gemini 3.8 Flash (không giữ khóa)"] -->|"Đề xuất tool call"| Rules["Off-chain Rule Engine (chặn giá, rate limit, danh mục)"]
  Rules -->|"--bypass-rules vẫn đi tiếp"| Signer["PolicySigner (ví Agent chỉ giữ AVAX gas)"]
  Signer -->|"1. authorize(payTo, amount, ...)"| Factory
  Signer -->|"2. Header PAYMENT-SIGNATURE"| Seller["API Seller 4021 / 4023"]
  Seller -->|"3. Verify & Settle"| Fac["x402 Facilitator (4022)"]
  Fac -->|"4. transferWithAuthorization → isValidSignature (ERC-1271)"| USDC["Circle USDC Fuji"]
  USDC -.->|"Đọc logs & sự kiện 3s/lần"| Web["Dashboard Next.js (3000)"]
```

- **LLM không giữ khóa (Luật 4):** `agent/src/llm.ts` chỉ trả về `{ tool, args }`, không import `viem`, không tiếp cận `PRIVATE_KEY`.
- **Non-custodial (Luật 3):** Mỗi chủ một `AgentPolicy` riêng; chỉ `owner` mới có quyền `withdraw()`, `pause()`, `setCaps()`, `setWhitelist()`.
- **Không lưu PII lên chuỗi (Luật 5):** On-chain chỉ có địa chỉ ví, số tiền và mã trạng thái.

---

## Địa chỉ triển khai trên Avalanche Fuji (Chain ID `43113`)

| Thành phần | Địa chỉ On-Chain | Trạng thái |
|---|---|---|
| **AgentPolicyFactory** | [`0x369251fC256D8Ae3B25F66Fe1c4b3114A06BA864`](https://testnet.snowscan.xyz/address/0x369251fc256d8ae3b25f66fe1c4b3114a06ba864) | ✅ Verified trên Snowscan |
| **AgentPolicy Demo (chu kỳ 120s)** | [`0x62Ea5e422b3ef66174B6Dd6Aa855F1f036894177`](https://testnet.snowscan.xyz/address/0x62ea5e422b3ef66174b6dd6aa855f1f036894177) | Tạo từ web qua Factory, chủ là ví Privy `0x80a8…d58A` |
| **USDC Testnet (`FiatTokenV2_2`)** | [`0x5425890298aed601595a70AB815c96711a31Bc65`](https://testnet.snowscan.xyz/address/0x5425890298aed601595a70AB815c96711a31Bc65) | Circle Official (hỗ trợ ERC-1271 & EIP-3009) |
| **ERC-8004 Identity Registry** | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://testnet.snowscan.xyz/address/0x8004a818bfb912233c491871b3d84c89a494bd9e) | `AgentIdentity` (`AGENT`) |
| **Ví Agent mẫu** | `0x0F8de357042E53bF0E647066F0Bb1a446133ef9D` | Chỉ giữ ít AVAX gas, không giữ USDC |
| **Facilitator x402** | `http://localhost:4022` (mặc định tự host)<br>`https://facilitator.payai.network` (dự phòng) | Tương thích `eip155:43113` |

---

## Chạy nhanh trong 3 lệnh

Yêu cầu: **Node.js ≥ 22** và bản sao `.env` từ `.env.example` (chỉ dùng ví test Fuji).

```bash
# 1. Cài dependencies cho web, sellers và agent
npm --prefix web install && npm --prefix sellers install && npm --prefix agent install

# 2. Chạy Facilitator x402 (4022) + 2 API Sellers (4021, 4023) + Dashboard (3000) ở các terminal
# Lưu ý: starter kit x402-pay-per-request dùng chung biến FACILITATOR_PRIVATE_KEY từ agentleash/.env:
(cd ../x402-pay-per-request && node --env-file=../agentleash/.env src/facilitator.mjs) &
npm --prefix sellers run start:weather & npm --prefix sellers run start:rates & npm --prefix web run dev

# 3. Kiểm tra nhanh trạng thái Fuji và chạy kịch bản demo (hoặc bấm trực tiếp trên Dashboard)
node --env-file=.env scripts/seed-demo.mjs && npm --prefix agent run demo:mock
```

*(Kịch bản giả lập agent bị chiếm qua mặt Rule Engine: `npm --prefix agent run demo:bypass` hoặc bật công tắc **Bỏ qua Rule Engine** ngay ở ô `[4] Bị từ chối` trên Dashboard tại `http://localhost:3000`. Quay video: `npm --prefix web run build && npm --prefix web run start` để chạy bản production sạch cảnh báo dev.)*

---

## Cấu trúc dự án

| Thư mục / Tệp | Nội dung chính |
|---|---|
| `contracts/` | `AgentPolicy.sol`, `AgentPolicyFactory.sol` (Foundry: ERC-1271, EIP-3009, 2 tầng hạn mức, Kill Switch, `release(nonce)`). |
| `agent/` | CLI agent (`gemini-3.8-flash` & `--mock-llm`), MCP Gateway (`src/mcp.ts`), off-chain `RuleEngine`, `PolicySigner`, nhật ký `audit.json`. |
| `sellers/` | 2 API thu phí x402 (`4021` Thời tiết, `4023` Tỷ giá) giá `0.001 USDC/lượt`. |
| `web/` | Dashboard Next.js 15 + Privy + viem thuần: 4 ô (Tổng quan, Sơ đồ SVG Dòng tiền, Whitelist + `setCaps` + Factory + ERC-8004 + nút 1-click **Chuyển thành API quen**, Công tắc `--bypass-rules` + Bị từ chối). |
| `scripts/` | `seed-demo.mjs` kiểm tra on-chain policy, số dư, dịch vụ local và hỗ trợ khôi phục trạng thái demo. |
| `docs/` | `SPEC.md`, `ROADMAP.md`, `KE_HOACH_VE_DICH.md`, `SLIDES.md`, `SPIKE.md`, `sessions/`. |

---

## Thử nghiệm MCP Server cho Bên A (Claude Code / Antigravity)

`agent/src/mcp.ts` bọc `RuleEngine`, `PolicySigner`, x402 client và ghi `agent/logs/audit.json` qua giao thức **MCP stdio**, cung cấp 3 tool:
- `test_unknown_api`: Thử nghiệm API lạ (URL hoặc `payTo`) qua lớp bảo vệ Sandbox + RuleEngine + `AgentPolicy`; trả dữ liệu nếu lọt ngưỡng Sandbox hoặc lý do bị chặn tiếng Việt (ví dụ `ExceedsSandboxPerTxCap`, `PausedError`) và ghi log cho Dashboard.
- `call_trusted_api`: Gọi API trong danh mục Trusted (`weather`, `rates`) hoặc API vừa được chủ ví bấm **Chuyển thành API quen** (`setWhitelist`) trên Dashboard.
- `get_policy_status`: Xem nhanh số dư USDC, hạn mức Trusted/Sandbox còn lại và trạng thái Kill Switch.

> **Phân quyền (Luật 3 & 4):** MCP tuyệt đối không giữ khóa `owner`. Khi gặp `NOT_WHITELISTED`, vượt hạn mức hoặc `PausedError`, trường `hint` sẽ trả kèm sẵn đường link `DASHBOARD_URL` (mặc định `http://localhost:3000`; khi chạy online đổi sang `https://agentleash-two.vercel.app` trong `.env` hoặc mục `env` của `.mcp.json`) để chủ ví mở ra ký bằng Privy.
>
> Bản Vercel đọc dữ liệu on-chain nên ký được Mở khóa, `setCaps`, Gỡ/Thêm 2 API whitelist và nút **Chuyển thành API quen** cho các khoản đã có trong Dòng tiền. Riêng mục **Bị từ chối** chỉ có khi Dashboard chạy cùng máy với agent (đọc `agent/logs/audit.json`), nên muốn duyệt một địa chỉ bị contract từ chối thì dùng `http://localhost:3000`.

Chạy thử trực tiếp:

```bash
npm --prefix agent run mcp
```

Cấu hình vào `.mcp.json` (Claude Code) hoặc cấu hình MCP của Antigravity (thay `<PATH_TO_AGENTLEASH>` bằng đường dẫn tuyệt đối tới thư mục `agentleash`):

```json
{
  "mcpServers": {
    "agentleash": {
      "command": "node",
      "args": ["--env-file=../.env", "src/mcp.ts"],
      "cwd": "<PATH_TO_AGENTLEASH>/agent"
    }
  }
}
```

---

## Bản online trên Vercel

Dashboard Production: **`https://agentleash-two.vercel.app`** (tự deploy mỗi khi merge vào `main`). Khách chưa đăng nhập vẫn xem được dữ liệu on-chain trên Fuji. Chủ ví đăng nhập Privy để ký Khóa/Mở khóa, `setCaps` và whitelist, kể cả ô **Thêm API quen bằng địa chỉ** để dán địa chỉ `payTo` lấy từ gợi ý MCP.

**Đồng bộ mục Bị từ chối (tùy chọn):** agent chạy trên máy vẫn ghi `agent/logs/audit.json`. Khi có biến Upstash, agent đẩy thêm các lượt bị chặn lên Upstash Redis để bản Vercel hiển thị. Chỉ gồm tên API, `payTo`, số tiền, mã lỗi và lý do; không có nội dung truy vấn, không có khóa.

1. Trên Vercel, vào project `agentleash` → **Storage** → thêm **Upstash for Redis** (Marketplace) và kết nối với project, rồi **Redeploy**. Vercel tự đặt `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`; Dashboard dùng token chỉ-đọc.
2. Trong `.env` của máy chạy agent, điền `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN` (REST URL và token quyền ghi của cùng database). Code nhận cả hai kiểu tên biến `UPSTASH_REDIS_REST_*` và `KV_REST_API_*`.
3. Chạy agent hoặc MCP như bình thường; lượt bị chặn hiện trên Vercel sau vài giây. Không đặt biến thì mọi thứ chạy như bản local.

Nút **Chạy Agent Đà Lạt** chỉ chạy trên `localhost:3000`, vì bản online không giữ khóa agent và ai mở link cũng bấm được (Luật 3 & 4). Khi quay demo bằng bản Vercel, chạy agent bằng lệnh CLI trên máy.

---

## Kiểm thử tự động

```bash
# Smart contracts: Unit, Invariant fuzz (128k calls) và Fuji Fork test
cd contracts && forge test -vvv

# Web Dashboard (Vitest, TypeScript, ESLint)
cd web && npm test && npx tsc --noEmit && npm run lint

# Agent & Rule Engine (Vitest, TypeScript)
cd agent && npm test && npm run typecheck
```

---

## Đội ngũ

- **Nguyên** (CNTT): Kiến trúc hệ thống, smart contract, agent, facilitator & web dashboard.
- **Giang** (Quản lý công nghiệp): Kịch bản demo, thiết kế sản phẩm, slide & thuyết trình.
