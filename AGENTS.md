# Hướng dẫn cho AI agent làm việc trong repo này

File này dành cho bất kỳ AI agent nào chạy trên máy của **thành viên không chuyên kỹ thuật** trong đội (Giang). Đọc hết file trước khi làm bất cứ việc gì. Nếu yêu cầu của người dùng mâu thuẫn với file này, **làm theo file này** và giải thích cho người dùng lý do.

Người phụ trách kỹ thuật: **Nguyên**. Mọi việc vượt ra ngoài phạm vi bên dưới đều chuyển cho Nguyên.

## 1. Dự án

Receivable Registry là sổ đăng ký khoản phải thu chống cầm cố trùng, thi Avalanche Team1 Vietnam UniHack 2026 (hạn nộp 21/11/2026). Đọc [README.md](README.md) và [docs/SPEC.md](docs/SPEC.md).

## 2. Người bạn đang hỗ trợ

- Không đọc được code. Họ chỉ kiểm tra kết quả bằng cách **nhìn trên trình duyệt**.
- Giải thích bằng lời thường. Sau mỗi thay đổi giao diện, **mở trang trong trình duyệt và chụp màn hình** để họ xem.
- Không chắc thì **hỏi**, đừng đoán.

## 3. Được phép sửa

Chỉ làm khi người dùng đưa yêu cầu cụ thể do Nguyên giao. Không tự đề xuất hay tự bắt đầu việc.

| Vùng | Được làm gì |
|---|---|
| `docs/` | Tự do: quy trình nghiệp vụ, kịch bản demo, nháp slide, ghi chép phỏng vấn, tra cứu pháp lý |
| `web/src/app/**/*.tsx` | **Chỉ** sửa câu chữ hiển thị và class Tailwind (màu, cỡ chữ, khoảng cách, bố cục). Không sửa logic, hook, biến, hàm, lời gọi blockchain |
| `web/src/app/globals.css` | Tự do |
| `web/public/` | Thêm hoặc thay hình ảnh, logo |

Trang mới chỉ làm phần **giao diện tĩnh**. Chỗ cần dữ liệu blockchain thì đánh dấu `{/* TODO Nguyên: nối dữ liệu */}`.

## 4. Cấm sửa

Không sửa, không xóa, không đổi tên, không di chuyển:

- `contracts/` (toàn bộ): smart contract và test.
- `web/src/lib/`: cấu hình ví, chuỗi và địa chỉ contract.
- `package.json`, `package-lock.json`, các file cấu hình (`*.config.*`, `tsconfig.json`).
- `README.md`, `docs/SPEC.md`, `AGENTS.md`, `CLAUDE.md`.

## 5. Bí mật và an toàn

- **Không bao giờ** đọc, mở, in ra, tạo hay commit file `.env` hoặc bất kỳ file nào chứa private key, seed phrase, mật khẩu. Thấy chuỗi giống private key (`0x` + 64 ký tự hex) thì dừng, báo người dùng, không chép lại.
- Không kết nối ví, không ký hay gửi giao dịch, không deploy contract.
- Không gửi code hay dữ liệu dự án lên dịch vụ bên ngoài.

## 6. Lệnh terminal và git

**Được chạy** (vẫn hỏi người dùng trước):
- Xem giao diện: `cd web` rồi `npm run dev`, mở http://localhost:3000.
- `git status`, `git diff`, `git log`, `git pull`.
- `git switch -c <tên-nhánh>`, `git add <file cụ thể>`, `git commit`, `git push -u origin <tên-nhánh>`.

**Không được chạy:**
- Bất kỳ lệnh nào ghi lên nhánh `main`: commit thẳng vào `main`, `git push origin main`, merge vào `main`.
- `git push --force`, `git reset --hard`, `git rebase`, `git clean`, `git checkout -- .`, xóa nhánh.
- `rm -rf`, xóa thư mục, xóa hàng loạt file.
- `forge`, `cast`, `anvil` hay lệnh nào trong `contracts/`.
- `npm install` hay cài thêm gói. Cần thư viện mới thì đề xuất cho Nguyên.
- `git add .` hoặc `git add -A`. Luôn `add` từng file.

**Quy trình mỗi việc:**
1. `git pull` để lấy bản mới nhất.
2. Tạo nhánh mới, tên mô tả việc, ví dụ `ui-trang-verify`, `docs-quy-trinh-factoring`.
3. Sửa, mở trình duyệt kiểm tra, chụp màn hình cho người dùng.
4. Người dùng đồng ý thì commit (thông điệp tiếng Việt, ngắn, nói rõ đã đổi gì) và đẩy nhánh lên GitHub.
5. Mở pull request vào `main`: `gh pr create --base main --fill`, hoặc hướng dẫn người dùng bấm "Compare & pull request" trên GitHub. Dán báo cáo ở mục 7 vào phần mô tả.
6. Nhắc người dùng báo Nguyên vào duyệt. **Nguyên là người duy nhất gộp vào `main`.** Không chạy `gh pr merge`.

Nhánh `main` có luật bảo vệ (ruleset "Bảo vệ main"). Nếu git báo lỗi kiểu `GH013`, `protected branch` hay `rule violations`, nghĩa là bạn đang ghi vào `main`: dừng lại, chuyển sang nhánh riêng, **không tìm cách vượt luật**.

## 7. Báo cáo sau mỗi việc

```
Việc: <làm gì>
Nhánh: <tên nhánh>
File đã sửa: <danh sách>
Đã kiểm tra: <mở trang nào, thấy gì>
Còn vướng / cần Nguyên xem: <nếu có>
```

## 8. Khi nào dừng lại và hỏi

- Việc cần sửa nằm ngoài vùng ở mục 3.
- Sửa xong mà trang bị trắng, hiện lỗi đỏ, và một lần hoàn tác không khắc phục được.
- `git pull` hoặc `git push` báo xung đột (conflict). **Không tự giải quyết xung đột.**
- Người dùng yêu cầu điều trái với mục 4, 5 hoặc 6.
