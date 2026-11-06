# Đặc tả MVP

Nguồn quyết định: `UniHack_avalanche/reports/2026-11-06-danh-gia-y-tuong.md` (mục 4, 7 và 8).

## Phạm vi

- **Tuần 1 (7–13/11):** MVP trên Fuji C-Chain. Không L1, không eERC.
- **Tuần 2 (14–20/11):** thêm L1 permissioned, rồi ICM nếu L1 chạy ổn trước 17/11. Nếu đến 17/11 ICM chưa chạy thì dừng.
- **Không làm eERC:** tốn công mà không hợp bài toán.

## Vai trò

| Vai | Việc |
|---|---|
| SME (bên bán) | Đăng ký khoản phải thu |
| Buyer (bên mua) | Ký xác nhận nợ |
| Bank (ngân hàng) | Đánh dấu đã tài trợ, xác nhận đã tất toán |
| Admin | Cấp và thu hồi vai cho các địa chỉ (trong demo là Nguyên) |

## Máy trạng thái

| Bước | Ai làm | Trạng thái sau | Chặn rủi ro |
|---|---|---|---|
| 1. Đăng ký hash hóa đơn | SME | `Registered` | Neo thời điểm và nội dung |
| 2. Ký xác nhận nợ | Buyer được chỉ định trong bản đăng ký | `Acknowledged` | Bên mua chối nợ |
| 3. Tài trợ | Bank | `Financed` | **Lần tài trợ thứ hai bị từ chối** |
| 4. Tất toán | Đúng ngân hàng đã tài trợ | `Settled` | Lịch sử tín nhiệm |

Hash hóa đơn = `keccak256(abi.encode(mstBenBan, mstBenMua, kyHieu, soHoaDon, soTienVND, ngayDenHan, salt))`. Frontend và contract/test phải dùng **đúng thứ tự và kiểu dữ liệu** này. Salt do hai bên giữ ngoài chuỗi, để không ai dò ngược được quan hệ mua bán.

## Năm user story

1. SME đăng ký một khoản phải thu.
2. Bên mua ký xác nhận nợ.
3. Ngân hàng tài trợ, và hệ thống chặn lần tài trợ thứ hai.
4. Ngân hàng xác nhận đã tất toán.
5. Người ngoài tra cứu trạng thái và lịch sử mà không cần ví (trang Verify).

**Demo 30 giây:** ngân hàng Y cố tài trợ một hóa đơn mà ngân hàng X đã tài trợ, và giao dịch bị từ chối ngay trên màn hình.

## Luật cuộc thi cần nhớ khi code và pitch

- Không có dữ liệu cá nhân on-chain, chỉ hash, thanh toán và trạng thái (luật 5).
- Dùng dữ liệu hay thời gian giả lập thì khai ngay đầu pitch (luật 6).
- Pitch phải nêu luật Việt Nam: crypto không phải phương tiện thanh toán; dự án chỉ bổ trợ sổ đăng ký biện pháp bảo đảm của Bộ Tư pháp (luật 8).
- Trả lời được 3 câu: vì sao on-chain, vì sao Avalanche, tiền đến từ đâu (luật 9).
