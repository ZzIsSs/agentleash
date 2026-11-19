# AgentLeash

- **Phạm vi duy nhất (chốt 18/11/2026):** `agentleash/` (`https://github.com/ZzIsSs/agentleash.git`) là **repo duy nhất** của Nguyên, và **Avalanche Team1 Vietnam UniHack 2026** (hạn nộp `21/11/2026`) là **cuộc thi duy nhất** Nguyên tham gia. Không tham chiếu hay coi bất kỳ repo cũ hoặc cuộc thi nào khác (`archive/CareerHunter/`, `ZzIsSs/UniHack_avalanche`, TDTU InnoStartup, v.v.) là đang hoạt động.
- Quy tắc cho AI agent chạy trên máy thành viên khác nằm ở [AGENTS.md](AGENTS.md). Các phiên của Nguyên (người phụ trách kỹ thuật) không bị giới hạn bởi file đó.

## Tổng quan & Định hướng phát triển (UniHack 2026 → Thuần x402 MCP Gateway)

- **Hiện trạng & Phạm vi nộp UniHack (hạn nộp 21/11/2026):** GĐ 0–3c + nâng cấp 17–19/11 đã chạy trọn vẹn trên Avalanche Fuji (x402 + ERC-1271 + EIP-3009 USDC + `AgentPolicy` 2 tầng Trusted/Sandbox + Privy Dashboard + nút 1-click *Chuyển thành API quen* + ô *Thêm API quen bằng địa chỉ* + tùy chọn đồng bộ mục *Bị từ chối* qua Upstash cho bản Vercel + CLI agent + MCP `agent/src/mcp.ts`). Phạm vi **mức dễ** trước 21/11 đã hoàn tất: trả kèm `DASHBOARD_URL` trong `hint` (✅ xong 18/11, PR #12), bản Vercel có ô thêm whitelist theo địa chỉ & hỗ trợ đồng bộ *Bị từ chối* qua Upstash khi cấu hình biến môi trường (✅ xong 19/11, PR #14), và **1 lệnh `setup:mcp`** tự ghi cấu hình MCP cho Claude Code & Antigravity (✅ xong 19/11, PR #15). **Nguyên tắc ưu tiên:** giữ nguyên vẹn độ ổn định của luồng lõi này cho bài nộp 21/11; mọi mở rộng không được làm vỡ contract hoặc luồng demo 7 bước.
- **Hướng phát triển tiếp theo (Thuần x402 MCP Gateway — Mô hình Bên A – Bên B):**
  - **Bên A:** Các công cụ lập trình tự động / AI agents (Antigravity, Claude Code, ...).
  - **Bên B:** **AgentLeash** đóng vai cổng kiểm thử & bảo vệ chi tiêu x402 (MCP Gateway + `RuleEngine` + `AgentPolicy`) tích hợp vào Bên A.
  - **Chức năng cốt lõi:**
    1. Giúp Bên A **tự động test các API x402 lạ** qua 4 lớp: (i) trần ngân sách Sandbox siêu nhỏ trên `AgentPolicy`, (ii) kiểm tra an toàn endpoint chống URL giả mạo/SSRF, (iii) chặn vòng lặp & giới hạn tần suất (rate limit), (iv) đánh giá chất lượng dữ liệu đầu ra (hướng mở rộng).
    2. Cho phép Bên A **sử dụng các API x402 quen** (Whitelist) với hạn mức cao hơn.
    3. Cho phép chủ ví xem lại các API lạ mà Bên A đã thử truy cập trên Dashboard và **bấm 1-click chuyển thành API quen** (nâng cấp Sandbox → Trusted).
  - **Phạm vi sau 21/11 (Mức phức tạp — chốt 18/11/2026):** Tập trung **thuần chuẩn x402**; phần phức tạp làm sau hạn nộp gồm: **Remote MCP đa người dùng** (`Streamable HTTP` cloud + OAuth gắn ví Privy + Session Key riêng từng user + DB đa người dùng với Vercel + Plugin Marketplace), bổ sung `POST`/body, siết SSRF IP nội bộ production và sổ `URL ↔ payTo`. Vault giữ API Key truyền thống cho non-tech chỉ là tùy chọn tầm nhìn dài hạn.

Phạm vi và quyết định đã chốt: [docs/SPEC.md](docs/SPEC.md). Lý do chọn đề tài, phản biện và ước tính giờ: `../reports/2026-11-08-y-tuong-1-agentleash.md`. Phân tích hai starter kit: `../reports/2026-11-09-bao-cao-phan-tich-2-starter-kit-btc.md`.

- Starter kit của ban tổ chức nằm **ngoài repo**, ở `../x402-pay-per-request/` và `../privy-agent-wallet/`. Không chép nguyên thư mục vào repo, chỉ chép phần cần dùng.
- Contract: Foundry trong `contracts/`. Mọi đường tiền phải có test (`forge test`), kèm fuzz cho hạn mức.
- Web: Next.js 15 + Privy (`@privy-io/react-auth`, đăng nhập email) + viem 2 thuần trong `web/`, đã bỏ wagmi. Cấu hình chuỗi và đọc contract ở `web/src/lib/` (`chain.ts`, `policy.ts`); test `npm test` (vitest). `web/.npmrc` bật `legacy-peer-deps` vì peer tùy chọn của Privy xung đột với viem.
- Mạng: Fuji C-Chain (43113). Không commit `.env`.
- Nhật ký phiên: đầu phiên đọc log gần nhất (`/session-log` chế độ đọc), cuối phiên ghi log vào `docs/sessions/` (`/session-log`). Hook Stop trong `.claude/settings.json` nhắc nếu quên.
