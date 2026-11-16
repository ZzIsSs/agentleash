# AgentLeash

Quy tắc cho AI agent chạy trên máy thành viên khác nằm ở [AGENTS.md](AGENTS.md). Các phiên của Nguyên (người phụ trách kỹ thuật) không bị giới hạn bởi file đó.

## Tổng quan & Định hướng phát triển (UniHack 2026 → Sản phẩm Non-tech)

- **Hiện trạng MVP UniHack (hạn nộp 21/11/2026):** GĐ 0–3c đã chạy trọn vẹn trên Avalanche Fuji (x402 + ERC-1271 + EIP-3009 USDC + `AgentPolicy` 2 tầng Trusted/Sandbox + Privy Dashboard + CLI agent). **Nguyên tắc ưu tiên:** giữ nguyên vẹn độ ổn định của luồng lõi này cho bài nộp 21/11; mọi mở rộng trước hạn nộp không được làm vỡ contract hoặc luồng demo 7 bước.
- **Hướng phát triển tiếp theo (Mô hình Bên A – Bên B cho người dùng non-tech):**
  - **Bên A:** Các công cụ lập trình tự động / AI coding agents (Antigravity, Claude Code, ...).
  - **Bên B:** **AgentLeash** đóng vai cổng kiểm thử & bảo vệ API (MCP Gateway / Vault Proxy) tích hợp vào Bên A.
  - **Chức năng cốt lõi:**
    1. Giúp Bên A **tự động test các API lạ** qua 4 lớp: (i) trần ngân sách Sandbox siêu nhỏ tránh cháy ví, (ii) kiểm tra uy tín/an toàn endpoint chống URL giả mạo/độc hại, (iii) chặn vòng lặp & giới hạn tần suất (rate limit), (iv) đánh giá chất lượng dữ liệu đầu ra có đúng yêu cầu người dùng.
    2. Cho phép Bên A **sử dụng các API quen** (Whitelist) với hạn mức cao hơn.
    3. Cho phép người dùng non-tech xem lại các API lạ mà Bên A đã thử truy cập trên Dashboard và **chọn chuyển thành API quen** (nâng cấp Sandbox → Trusted).
  - **Phạm vi API:** Kết hợp cả **API truyền thống** (API Key/thẻ qua két bảo mật & quota guard, không lộ key cho Bên A) và **API chuẩn x402** (Avalanche on-chain policy chạy ngầm).

Phạm vi và quyết định đã chốt: [docs/SPEC.md](docs/SPEC.md). Lý do chọn đề tài, phản biện và ước tính giờ: `../reports/2026-11-08-y-tuong-1-agentleash.md`. Phân tích hai starter kit: `../reports/2026-11-09-bao-cao-phan-tich-2-starter-kit-btc.md`.

- Starter kit của ban tổ chức nằm **ngoài repo**, ở `../x402-pay-per-request/` và `../privy-agent-wallet/`. Không chép nguyên thư mục vào repo, chỉ chép phần cần dùng.
- Contract: Foundry trong `contracts/`. Mọi đường tiền phải có test (`forge test`), kèm fuzz cho hạn mức.
- Web: Next.js 15 + Privy (`@privy-io/react-auth`, đăng nhập email) + viem 2 thuần trong `web/`, đã bỏ wagmi. Cấu hình chuỗi và đọc contract ở `web/src/lib/` (`chain.ts`, `policy.ts`); test `npm test` (vitest). `web/.npmrc` bật `legacy-peer-deps` vì peer tùy chọn của Privy xung đột với viem.
- Mạng: Fuji C-Chain (43113). Không commit `.env`.
- Nhật ký phiên: đầu phiên đọc log gần nhất (`/session-log` chế độ đọc), cuối phiên ghi log vào `docs/sessions/` (`/session-log`). Hook Stop trong `.claude/settings.json` nhắc nếu quên.
