# KỊCH BẢN VIDEO DEMO AGENTLEASH (2:30)
*Tác giả kịch bản: Giang | Trích xuất từ ảnh chụp kịch bản: 20/11/2026*

---

## I. THIẾT LẬP GHI HÌNH & TỔNG QUAN

- **Thiết lập màn hình ghi hình:** Chia đôi màn hình (Split screen):
  - **Bên trái (40%):** Terminal chạy Agent CLI (`powershell` / `bash`).
  - **Bên phải (60%):** Trình duyệt mở Web Console tại `http://localhost:3000`.
- **Giọng đọc (Voiceover):** Rõ ràng, tự tin, dứt khoát; nhấn mạnh các thuật ngữ kỹ thuật và các khoảnh khắc on-chain revert.

### Sơ đồ phân cảnh theo từng giây:

```
0:00         0:15         0:45             1:25             1:55         2:15         2:30
|------------|------------|----------------|----------------|------------|------------|
Khai báo      Vấn đề &     WOW 1: Chặn      WOW 2: API lạ    WOW 3:       3 Câu hỏi    Luật VN
Luật 6        Bên A-Bên B  vượt trần ngày   & 1-Click        Kill         bắt buộc     & Kết
                           (ExceedsDaily)   Whitelist        Switch
```

---

## II. PHÂN CẢNH CHI TIẾT THEO TỪNG GIÂY

### ⏰ 0:00 – 0:15 | Khai báo Luật 6
*(Theo quy chế cuộc thi & tổng quan phân cảnh)*
- **Hình ảnh (Visual/Action):** Hiện chữ khai báo mô phỏng Luật 6 ở góc màn hình ngay từ giây 0.
- **Lời thoại (Voiceover):** Nhóm xin khai báo trước các yếu tố mô phỏng: chu kỳ hạn mức rút ngắn còn 120 giây, 2 seller API dùng mock data, agent CLI chạy mock LLM; toàn bộ logic `authorize`, `AgentPolicy` và thanh toán USDC x402 chạy thật trên Avalanche Fuji testnet.

---

### ⏰ 0:15 – 0:45 | Vấn đề & Khung tích hợp Bên A – Bên B

- **Hình ảnh (Visual/Action):**
  - Chuyển nhanh qua trang MCP Bên A – Bên B (`/mcp`), trỏ chuột vào sơ đồ: **Bên A (Antigravity / Claude Code) → Cổng AgentLeash → Nhà cung cấp x402**.
  - Bên Terminal trái: Gõ lệnh chạy agent thông thường:
    ```bash
    npm --prefix agent run demo:mock
    ```
  - Web bên phải mở tab Dòng tiền (`/flows`): Sơ đồ SVG chuyển động, hiện giao dịch thanh toán thành công `0.001 USDC` cho API Thời tiết.

- **Lời thoại (Voiceover):**
  > *"Khi tích hợp các AI Coding Agent như Antigravity hay Claude Code (Bên A) tự mua dữ liệu qua HTTP 402, rủi ro lớn nhất là Prompt Injection hoặc lỗi lặp vô hạn khiến agent đốt sạch ví. Với AgentLeash (Bên B), LLM tuyệt đối không giữ khóa riêng. Tiền nằm an toàn trong smart contract `AgentPolicy` của chủ sở hữu. Agent chỉ được quyền đề xuất; smart contract mới là chốt chặn cuối cùng kiểm tra hạn mức và duyệt chữ ký."*

- **Checklist giám khảo:** ✅ Đạt Creativity & Impact (15% + 15%), nguyên tắc LLM không giữ key.

---

### ⏰ 0:45 – 1:25 | Khoảnh khắc WOW 1: Chặn on-chain khi vượt trần ngày

- **Hình ảnh (Visual/Action):**
  - Agent tiếp tục gọi liên tiếp các lệnh mua API Thời tiết & Tỷ giá.
  - Đến lần gọi thứ 4: Terminal báo lỗi đỏ, Web Console tự động cập nhật sang trang Nhật ký & Giám sát (`/audit`).
  - Mục Rejections hiện rõ lỗi revert từ smart contract: `ExceedsDailyCap(0.004 > 0.003 USDC)`.
  - Click vào mã giao dịch mở trang Snowtrace Fuji: Hiện rõ smart contract đã từ chối thực thi.

- **Lời thoại (Voiceover):**
  > *"Hãy quan sát: Sau 3 lượt mua thành công, tổng chi tiêu đạt 0.003 USDC. Ở lần gọi thứ 4, smart contract lập tức kích hoạt cơ chế bảo vệ và revert giao dịch với mã lỗi `ExceedsDailyCap`. Dù mã nguồn agent có cố gửi yêu cầu bao nhiêu lần, giao dịch vẫn bị chặn đứng ngay trên chuỗi Avalanche mà không tốn thêm một đồng USDC nào!"*

- **Checklist giám khảo:** ✅ Đạt Technical Implementation (25%) — Invariant Fuzzing & Smart Contract Logic.

---

### ⏰ 1:25 – 1:55 | Khoảnh khắc WOW 2: Chặn API lạ & 1-Click "Chuyển thành API quen"

- **Hình ảnh (Visual/Action):**
  - Terminal bên trái chạy lệnh giả lập agent bị chiếm quyền / prompt injection gọi địa chỉ lạ:
    ```bash
    npm --prefix agent run demo:bypass
    ```
  - Terminal văng lỗi: `ExceedsSandboxPerTxCap`.
  - Trên Web bên phải (trang `/policies`), hàng giao dịch API lạ hiện nút nổi bật: **[+ Chuyển thành API quen]**.
  - Người dùng bấm nút → Popup Privy hiện lên → Ký giao dịch `setWhitelist` trên chuỗi thành công.

- **Lời thoại (Voiceover):**
  > *"Bây giờ, giả sử Agent bị Prompt Injection hoặc hacker sửa code để gọi tới một API lạ hòng rút ruột quỹ. Smart contract lập tức cô lập địa chỉ này vào chế độ Sandbox với trần siêu nhỏ và chặn đứng vì vượt `SandboxPerTxCap`. Khi chủ ví kiểm tra và xác nhận đây là đối tác an toàn, chỉ cần 1 cú click: 'Chuyển thành API quen'. Hạn mức Trusted lập tức được cấp mà không cần cấu hình phức tạp!"*

- **Checklist giám khảo:** ✅ Đạt UI/UX & Demo (10%) — Thao tác 1-click Whitelist thực tế.

---

### ⏰ 1:55 – 2:15 | Khoảnh khắc WOW 3: Khóa khẩn cấp (Kill Switch)

- **Hình ảnh (Visual/Action):**
  - Chuột rê lên thanh Header, bấm mạnh vào nút đỏ **[KHÓA KHẨN CẤP]** (`pause()`).
  - Biểu tượng ổ khóa đóng lại, toàn bộ Console chuyển sang trạng thái cảnh báo đỏ: `CONTRACT PAUSED`.
  - Terminal cố gửi bất kỳ lệnh gọi API nào → Nhận ngay mã lỗi: `PausedError()`.

- **Lời thoại (Voiceover):**
  > *"Và đây là lớp phòng thủ tối thượng: Khi phát hiện bất thường, chủ ví bấm 'Khóa khẩn cấp'. Toàn bộ các chữ ký EIP-3009 chưa settle lập tức vô hiệu lực, và mọi yêu cầu mới bị đóng băng hoàn toàn chỉ trong 1 block của Avalanche."*

- **Checklist giám khảo:** ✅ Atomic Kill Switch bảo vệ quỹ tức thì.

---

### ⏰ 2:15 – 2:30 | 3 Câu hỏi bắt buộc & Tuân thủ Luật Việt Nam

- **Hình ảnh (Visual/Action):**
  - Chuyển về trang `/` (Overview), mở tab Explorer Snowtrace của Factory `0x369251fC...A864` (đã verified xanh).
  - Hiện Slide tóm tắt 3 câu hỏi và cam kết pháp lý.

- **Lời thoại (Voiceover):**
  > *"Để tổng kết:*
  > 1. *Vì sao on-chain? Để tạo trần thiệt hại bất biến toán học mà mã agent không thể tự sửa.*
  > 2. *Vì sao Avalanche? Circle USDC trên Fuji hỗ trợ native ERC-1271 và EIP-3009, với tốc độ sub-second lý tưởng cho thanh toán micro.*
  > 3. *Tiền đến từ đâu? Doanh thu SaaS quản lý agent và phí cổng x402; không huy động vốn, không phát hành token, không yield ảo. Đặc biệt, AgentLeash tuân thủ pháp luật Việt Nam: không dùng crypto thay thế VND, không trả lương, và không tư vấn tài chính. Cảm ơn Ban giám khảo!"*

- **Checklist giám khảo:** ✅ Trả lời đủ 3 câu hỏi bắt buộc + Điểm cộng tuyệt đối Luật Việt Nam.

---

## III. BẢNG TỔNG HỢP CÁC LỆNH CẦN CHUẨN BỊ TRƯỚC KHI BẤM REC

*Mục đích: Để video quay mượt mà trong 1 take không bị vấp.*

| Bước quay | Cửa sổ Terminal / Web | Lệnh / Thao tác | Kết quả hiển thị trên màn hình |
|---|---|---|---|
| **Chuẩn bị** | Terminal 1 (Sellers) | `npm --prefix sellers run start:weather`<br>`npm --prefix sellers run start:rates` | Server cổng 4021 & 4023 sẵn sàng |
| **Chuẩn bị** | Terminal 2 (Facilitator) | Khởi động mock facilitator cổng 4022 | Server cổng 4022 sẵn sàng |
| **Chuẩn bị** | Terminal 3 (Web) | `npm --prefix web run dev` | Web mở tại `http://localhost:3000` |
| **0:25** | Terminal 4 (Agent) | `npm --prefix agent run demo:mock` | Mua thành công 2 API (Thời tiết & Tỷ giá) |
| **0:55** | Terminal 4 (Agent) | Chạy tiếp lượt 3 & 4 | Chặn on-chain: `ExceedsDailyCap` |
| **1:30** | Terminal 4 (Agent) | `npm --prefix agent run demo:bypass` | Chặn on-chain: `ExceedsSandboxPerTxCap` |
| **1:45** | Trình duyệt Web | Bấm nút **Chuyển thành API quen** trên `/policies` | Ký Privy thành công, đưa vào Whitelist |
| **2:00** | Trình duyệt Web | Bấm nút **Khóa khẩn cấp** trên Header | Header hiện `PAUSED`, terminal văng `PausedError` |
