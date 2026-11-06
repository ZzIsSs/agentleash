# Receivable Registry

Sổ đăng ký khoản phải thu chống cầm cố trùng, dự thi **Team1 Vietnam UniHack 2026** trên Avalanche (hạn nộp 23:59 ngày 21/11/2026).

**Một câu:** giúp doanh nghiệp nhỏ vay vốn bằng hóa đơn bán hàng thay vì bằng sổ đỏ, vì các ngân hàng cùng thấy được một hóa đơn đã được dùng để vay ở đâu chưa, và bên mua đã ký xác nhận nợ hay chưa.

**Không có tiền chạy trên chuỗi.** Blockchain chỉ lưu hash có salt và trạng thái. Việc thanh toán diễn ra ngoài chuỗi, bằng VND.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `contracts/` | Smart contract Solidity, dùng Foundry |
| `web/` | Giao diện Next.js + wagmi/viem, gồm 3 màn hình theo vai và trang Verify |
| `docs/` | Đặc tả, kịch bản demo, ghi chú pitch |

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

Mạng dùng: Avalanche **Fuji C-Chain** (chainId 43113). L1 permissioned là phần làm thêm ở tuần 2, xem [docs/SPEC.md](docs/SPEC.md).

## Đội

- **Nguyên** (CNTT): contract, web, hạ tầng
- **Giang** (Quản lý công nghiệp): quy trình nghiệp vụ, kịch bản demo, pitch

Quy tắc cho AI agent trên máy thành viên khác: [AGENTS.md](AGENTS.md).
