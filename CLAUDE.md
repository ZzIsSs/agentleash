# AgentLeash

Quy tắc cho AI agent chạy trên máy thành viên khác nằm ở [AGENTS.md](AGENTS.md). Các phiên của Nguyên (người phụ trách kỹ thuật) không bị giới hạn bởi file đó.

Phạm vi và quyết định đã chốt: [docs/SPEC.md](docs/SPEC.md). Lý do chọn đề tài, phản biện và ước tính giờ: `../reports/2026-11-08-y-tuong-1-agentleash.md`. Phân tích hai starter kit: `../reports/2026-11-09-bao-cao-phan-tich-2-starter-kit-btc.md`.

- Starter kit của ban tổ chức nằm **ngoài repo**, ở `../x402-pay-per-request/` và `../privy-agent-wallet/`. Không chép nguyên thư mục vào repo, chỉ chép phần cần dùng.
- Contract: Foundry trong `contracts/`. Mọi đường tiền phải có test (`forge test`), kèm fuzz cho hạn mức.
- Web: Next.js 15 + wagmi 2 + viem 2 trong `web/`, chưa có Privy. Cấu hình chuỗi ở `web/src/lib/`.
- Mạng: Fuji C-Chain (43113). Không commit `.env`.
