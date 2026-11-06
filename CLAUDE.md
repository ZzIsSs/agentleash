# Receivable Registry

Quy tắc cho AI agent chạy trên máy thành viên khác nằm ở [AGENTS.md](AGENTS.md). Các phiên của Nguyên (người phụ trách kỹ thuật) không bị giới hạn bởi file đó.

Phạm vi và quyết định đã chốt: [docs/SPEC.md](docs/SPEC.md). Lý do chọn đề tài và ước tính thời gian: `../reports/2026-11-06-danh-gia-y-tuong.md`.

- Contract: Foundry trong `contracts/`. Mọi thay đổi contract phải có test (`forge test`).
- Web: Next.js 15 + wagmi 2 + viem 2 trong `web/`. Cấu hình chuỗi ở `web/src/lib/`.
- Mạng tuần 1: Fuji C-Chain (43113). Không commit `.env`.
