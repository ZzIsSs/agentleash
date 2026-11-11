# So sánh 2 phương án bố cục UI/UX để đưa vào Figma (AgentLeash)

> **Tài liệu đi kèm:** [HUONG_DAN_CHUAN_BI_FIGMA.md](HUONG_DAN_CHUAN_BI_FIGMA.md)  
> **Sơ đồ trên FigJam:** [Mở bảng FigJam](https://www.figma.com/board/lUMYemD6G4EiO4H3dcP7uj)  
> **Mục đích:** Chuẩn bị chi tiết khung bố cục cho **Bản A** và **Bản B** (cùng mô hình Hạn mức 2 tầng **1B** và Sơ đồ dòng tiền nối dây **5**) để Nguyên và nhóm so sánh trước khi lên màu chi tiết trên Figma.

---

## 1. Phần dùng chung ở cả 2 bản (Header & Thanh công cụ Demo)

Cả Bản A và Bản B đều giữ cố định 2 phần quan trọng nhất ở phía trên màn hình để lúc nào cũng nhìn thấy và bấm được ngay:

```text
+---------------------------------------------------------------------------------------------------+
| [Logo AgentLeash]  Agent: [Bot Du Lich v] [+ Tao Agent]   | Fuji Testnet | 0xPolicy... | 0.05 USDC|
| [Email: giang@...] [DEMO: Chu ky 2 phut (thuc te: 24h)]   | [ Cong tac Demo: Bo qua kiem tra mem ]|
|                                                             | [    NUT DO: KHOA KHAN CAP (PAUSE)   ]|
+---------------------------------------------------------------------------------------------------+
```

- **Gợi ý Mục 2 (đã áp dụng vào khung trên):**
  - Nút **`+ Tạo Agent`** đặt gọn ngay cạnh ô chọn Agent hiện tại (giúp giữ khung dưới thoáng).
  - Công tắc **`Bỏ qua kiểm tra mềm (Giả lập bị hack)`** đặt trong ô viền vàng ở góc phải Header để khi quay video 2 phút bấm chỉ 1 lần, không lẫn vào cài đặt thật.
  - Nút đỏ **`KHÓA KHẨN CẤP (KILL SWITCH)`** luôn ghim ở góc trên bên phải ở mọi màn hình.

---

## 2. Bản A — 1 Trang Dashboard Tổng Hợp (Khuyến nghị cho Video Demo 2 phút)

Tất cả 5 khu vực nằm gọn trên **1 màn hình cuộn ngắn (hoặc vừa 1 khung desktop 1440px)** theo lưới 2 cột:

```text
+---------------------------------------------------------------------------------------------------+
| HEADER CHUNG (Privy + +Tao Agent + Nhan Demo 2 phut + Cong tac Demo + Nut Do KILL SWITCH)         |
+-------------------------------------------------+-------------------------------------------------+
| [1] TONG QUAN - DONG HO XANG 2 TANG             | [2] SO DO DONG TIEN TRUC QUAN                   |
| - Trang thai: [● DANG HOAT DONG]  Con: 01:24    |                                                 |
|                                                 |   [AI Agent] ===> [Policy Contract]             |
| Tang 1 - Whitelist (Tin cay):                   |                      |--> (xanh) API Thoi tiet   |
| [████████████░░░░] 0.002 / 0.003 USDC           |                      |--> (xanh) API Ty gia      |
|                                                 |                      |--x (do)   API La Sandbox  |
| Tang 2 - Sandbox (API la vi mo):                |                                                 |
| [░░░░░░░░░░░░░░░░] 0.000 / 0.002 USDC (toi da   |   *Do day duong noi ty le theo so USDC da chi* |
|                    0.001 USDC / lan goi)        |                                                 |
+-------------------------------------------------+-------------------------------------------------+
| [3] LUAT CHI TIEU 2 TANG                        | [4] LICH SU CHI & NHAT KY BI TU CHOI            |
| - Tang 1 Whitelist:                             | Tab nho: [Tat ca (4)] [Thanh cong (3)] [Bi chan]|
|   [x] API Thoi tiet (0x11...aa)                 | - #3 API Ty gia   | 0.001 | Xong -> [Snowtrace]   |
|   [x] API Ty gia   (0x22...bb)                  | - #2 API Thoi tiet| 0.001 | Xong -> [Snowtrace]   |
|   [+ Them dia chi]  Tran/lan: 0.001 | Chu ky:... | - #1 API Thoi tiet| 0.001 | Xong -> [Snowtrace]   |
| - Tang 2 Sandbox API la: [BAT]                  | - [DO] Lan 4: Vuot han muc chu ky Tang 1        |
|   Tran/lan: 0.001 USDC | Tran chu ky: 0.002     | - [DO] API la: Vuot tran Sandbox vi mo          |
+-------------------------------------------------+-------------------------------------------------+
```

### Điểm mạnh & Điểm yếu của Bản A
- **Ưu điểm:** Khi quay video demo 2 phút, người xem thấy cùng lúc **đồng hồ xăng tụt xuống**, **dây dòng tiền sáng lên**, **dòng Snowtrace xuất hiện**, và **thông báo đỏ bật lên ngay khi bị chặn** mà không cần chuyển trang. Ít công vẽ nhất trên Figma.
- **Nhược điểm:** Mật độ thông tin khá dày trên 1 màn hình; nếu về sau thêm nhiều Agent hoặc bảng lịch sử dài ra thì sẽ phải cuộn trang.

---

## 3. Bản B — Chia Menu Nhiều Trang / Tab (Tối ưu dùng thực tế)

Dùng bố cục **Sidebar bên trái + Vùng nội dung rộng bên phải**. Thanh Header phía trên vẫn ghim nút đỏ **Kill Switch** và nhãn **Demo 2 phút** để an toàn ở mọi lúc.

```text
+------------------+--------------------------------------------------------------------------------+
| AGENTLEASH       | HEADER CHUNG (Email Privy | +Tao Agent | Demo 2 phut | Nut Do KILL SWITCH)    |
+------------------+--------------------------------------------------------------------------------+
| MENU TRAI:       |                                                                                |
| > 1. Tong quan   |  (NOI DUNG THAY DOI THEO TAB DANG CHON)                                        |
|   2. Dong tien   |                                                                                |
|   3. Luat 2 tang |  - Tab 1 (Tong quan): Phong to 2 dong ho xang (Whitelist & Sandbox),           |
|   4. Bi tu choi  |    tom tat 3 giao dich gan nhat va trang thai he thong.                        |
|                  |                                                                                |
| ---------------- |  - Tab 2 (Dong tien): So do noi day lon chiem 60% khung hinh +                 |
| [Cong tac Demo:  |    Bang chi tiet trang thai (Dang ky -> Dang cho -> Xong) + link Snowtrace.    |
|  Bo qua kiem tra |                                                                                |
|  mem - OFF/ON]   |  - Tab 3 (Luat 2 tang): Quan ly danh sach Whitelist, o nhap dia chi,           |
|                  |    cau hinh han muc Tang 1 & Tang 2 Sandbox thoang rong, de nhap lieu.         |
|                  |                                                                                |
|                  |  - Tab 4 (Bi tu choi): Bang log chi tiet cac lan chan (Rule Engine vs Contract)|
|                  |    kem giai thich ly do tieng Viet va goi y khac phuc.                         |
+------------------+--------------------------------------------------------------------------------+
```

### Điểm mạnh & Điểm yếu của Bản B
- **Ưu điểm:** Giao diện thoáng, chuyên nghiệp như sản phẩm SaaS thật; sơ đồ dòng tiền và bảng luật 2 tầng có không gian rộng để trình bày đẹp.
- **Nhược điểm:** Khi quay demo 2 phút phải bấm chuyển qua lại giữa các tab; số lượng khung hình cần vẽ trong Figma Design nhiều hơn Bản A (tối thiểu 4–5 khung cho mỗi trạng thái).

---

## 4. Phần chờ Nguyên chốt (Mục 4: Màu sắc & Nhận diện)

Nguyên xem 2 gợi ý phong cách màu sắc dưới đây để chốt tông màu chung cho cả Bản A hoặc Bản B:

| Tiêu chí | Phương án Dark Mode (Nền tối) | Phương án Light Mode (Nền sáng) |
|---|---|---|
| **Cảm giác mang lại** | Công nghệ, Web3, bảo mật / trung tâm điều khiển an ninh | Tài chính, sạch sẽ, dễ đọc giống app ngân hàng / SaaS doanh nghiệp |
| **Màu nền & chữ gợi ý** | Nền `#020617` (tối sâu), thẻ `#0F172A`, chữ sáng `#F8FAFC` | Nền `#F8FAFC` (xám trắng dịu), thẻ `#FFFFFF`, chữ đậm `#0F172A` |
| **Màu trạng thái (giữ chung)** | An toàn/Whitelist: Xanh lá `#10B981` · Dòng tiền: Xanh cyan `#06B6D4` · Sandbox/Cảnh báo: Vàng `#F59E0B` · Kill Switch/Chặn: Đỏ `#EF4444` | Tương tự nhưng chỉnh độ đậm hơn chút để nổi trên nền trắng (`#059669`, `#0284C7`, `#D97706`, `#DC2626`) |
| **Phù hợp khi chiếu video** | Rất nổi bật hiệu ứng sáng của sơ đồ dòng tiền và nút đỏ Kill Switch | Rõ chữ khi chiếu máy chiếu phòng họp sáng đèn hoặc xem trên điện thoại |

### Bảng chốt nhanh dành cho Nguyên
- [ ] **Chọn bố cục chính:** `[ ] Bản A (1 trang tổng hợp)` · `[ ] Bản B (Menu 4 tab)` · `[ ] Dùng Bản A cho màn hình Demo, Bản B để tham khảo mở rộng`
- [ ] **Chọn tông màu (Mục 4):** `[ ] Dark Mode` · `[ ] Light Mode`
- [ ] **Ý tưởng Logo / Icon AgentLeash (Mục 4):** *(ví dụ: Khiên + Dây xích, hoặc Chú chó robot có vòng cổ phát sáng, hoặc chữ đơn giản)* → `...`
