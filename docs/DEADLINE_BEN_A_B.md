# Deadline & Kế Hoạch Về Đích Hướng Mới (16/11 → 21/11/2026)

> **Bối cảnh cập nhật (16/11/2026):** GĐ 0–3c của AgentLeash đã hoàn thành và chạy trọn 7 bước demo thật trên Avalanche Fuji (`54/54` web tests, `18/18` agent tests, `29/29` Foundry tests). Từ chiều 16/11 đến hạn nộp **21/11**, nhóm bổ sung câu chuyện và nâng cấp gọn theo mô hình **Bên A – Bên B cho người dùng non-tech** (xem [README.md](../README.md) và [SPEC.md](SPEC.md)).

- **Mục tiêu nộp bài:** Trước **12:00 T7 21/11/2026** trên `team1vn.xyz`.
- **Hạn chót cứng (đóng server):** **23:59 T7 21/11/2026**.
- **Nguyên tắc sống còn:** Không sửa `contracts/` (đã verified trên Snowscan). Mọi phần nâng cấp hướng **Bên A (Antigravity / Claude Code) ↔ Bên B (AgentLeash)** chỉ làm gọn ở `agent/` và `web/`. Các phần mở rộng sâu (API truyền thống qua Vault/Proxy, trải nghiệm ẩn hoàn toàn crypto) đưa vào **Slide Roadmap**.

---

## 1. Bảng Deadline Chi Tiết (16/11 → 21/11/2026)

| Mốc thời gian | Người làm | Việc phải xong | Tiêu chí đạt ("Xong khi") |
| :--- | :--- | :--- | :--- |
| **T2 16/11**<br>*(Chiều – Tối)* | Nguyên | 1. Đẩy bản tổng quan mới (`AGENTS.md`, `CLAUDE.md`, `README.md`, `SPEC.md`, `SLIDES.md`, file này) lên repo.<br>2. Ký giao dịch mint NFT **ERC-8004** từ ví Privy trên Dashboard (hoàn tất GĐ 4).<br>3. Chốt thiết kế 2 nâng cấp nhỏ hướng mới: nút **1-click "Chuyển thành API quen"** trên Dashboard + khung **MCP Server (`agent/src/mcp.ts`)**. | Repo cập nhật; ERC-8004 hiển thị ID trên Dashboard; chốt xong spec 2 nâng cấp. |
| **T3 17/11**<br>*(08:30 – 19:30)* | Nguyên & Giang | **Nguyên (Code):**<br>- Thêm nút **1-click "Chuyển thành API quen"** (`setWhitelist`) ngay cạnh giao dịch API lạ trên Dashboard.<br>- Bọc rule engine + `policySigner` thành **MCP Server mỏng (`agent/src/mcp.ts`)** để Antigravity / Claude Code gọi thử `test_unknown_api` & `call_trusted_api`.<br>**Giang (Slide):**<br>- Cập nhật slide trên Canva (12 trang) theo [SLIDES.md](SLIDES.md): lồng câu chuyện **Bên A – Bên B (Thử API lạ → Duyệt API quen)** và slide **Roadmap (API truyền thống + Non-tech)**. | Bấm nút trên web đưa được địa chỉ lạ vào Whitelist; có bản nháp 12 slide trên Canva. |
| **T3 17/11**<br>*(20:00)* | Nguyên / Giang | Tham dự **Workshop 3: "Ship & Scale Your dApp"** (Google Meet — đăng ký Luma trước). | Nắm đủ lưu ý ship sản phẩm & tiêu chí chấm (nếu BTC nhắc thêm). |
| **T4 18/11**<br>*(08:30 – 18:00)*<br>**CODE FREEZE 18:00** | Nguyên | 1. Cắm thử **MCP Server** vào Claude Code hoặc Antigravity chạy kịch bản: Bên A test API lạ (Sandbox) → Người dùng bấm "Chuyển thành API quen" trên web → Bên A gọi lại (Trusted).<br>2. **Mốc cắt rủi ro (15:00):** Nếu MCP cắm vào Bên A còn lỗi bất thường, **cắt demo live MCP**, giữ lại file code MCP làm tài liệu minh họa và dùng Dashboard + CLI cho video.<br>3. Chạy toàn bộ test (`forge test`, `web` vitest + tsc + lint, `agent` vitest + typecheck). **Khóa code lúc 18:00.** | Toàn bộ test xanh sạch 100%; kịch bản demo chạy thông suốt không phải sửa tay. |
| **T5 19/11**<br>*(08:30 – 19:30)* | Nguyên & Giang | **Nguyên:**<br>- Rà soát [README.md](../README.md) (kiến trúc, cách chạy, địa chỉ Fuji).<br>- Chạy `scripts/seed-demo.mjs`, deploy Web Dashboard lên **Vercel** (mở tab ẩn danh kiểm tra đọc được dữ liệu thật trên Fuji).<br>**Giang:**<br>- Hoàn thiện Slide Canva (bật *"Anyone with the link can view"*).<br>- Chốt lời thoại kịch bản quay video 2–3 phút (nhớ câu khai Luật 6 ngay **15 giây đầu**). | Link Vercel chạy ở tab ẩn danh; Slide Canva chốt xong; kịch bản quay sẵn sàng. |
| **T5 19/11**<br>*(20:00)* | Nguyên & Giang | Tham dự **Office Hours 1** (Google Meet — đăng ký Luma). | Mang bản Vercel + Slide mới hỏi mentor góp ý về câu chuyện Bên A – Bên B. |
| **T6 20/11**<br>*(08:30 – 19:30)* | Nguyên & Giang | 1. Sửa lại Slide/UI chữ nghĩa nhỏ (nếu mentor góp ý ở Office Hours 1).<br>2. **Quay & dựng Video Demo (2–3 phút):**<br>   - *0:00–0:15:* Khai báo giả lập (chu kỳ 120s, API mock).<br>   - *0:15–1:45:* Demo Bên A test API lạ → bị chặn Sandbox/DailyCap → bấm **Chuyển thành API quen** → Kill Switch.<br>   - *1:45–2:30:* Đối chiếu Snowscan + Tầm nhìn Non-tech.<br>3. Up YouTube **Unlisted** + viết nháp 2 ô form nộp (`What it does` & `Anything else`, ≤ 800 ký tự/ô). | Video xem được khi chưa đăng nhập; nháp form đã lưu. |
| **T6 20/11**<br>*(20:00)* | Nguyên & Giang | Tham dự **Office Hours 2** (Google Meet — đăng ký Luma). | Mentor duyệt chéo Video & Slide lần cuối trước ngày nộp. |
| **T7 21/11**<br>*(08:30 – 12:00)*<br>**MỤC TIÊU NỘP TRƯỚC 12:00** | Nguyên & Giang | 1. **Kiểm tra tab ẩn danh toàn bộ link:** GitHub Repo (Public), Live App Vercel, Snowscan Factory (`0x369251fC…A864`), Slide Canva, Video YouTube.<br>2. **Bấm Submit trên `team1vn.xyz` trước 12:00.**<br>3. **Chiều (13:00–23:59):** Chỉ dự phòng kiểm tra lại hiển thị hồ sơ. | Trang hồ sơ `team1vn.xyz` xác nhận đã nộp thành công. |

---

## 2. Mốc Sau Khi Nộp (Vòng Chung Kết)

- **23/11/2026:** BTC công bố Top 10 Finalist. Nếu lọt Top 10, đăng ký ngay **Final Demo Day** trên Luma và luyện Q&A (trọng tâm: *"Khác gì Safe AllowanceModule?"* và *"Vì sao bảo vệ non-tech qua Bên A – Bên B cần chốt chặn on-chain?"*).
- **T2 30/11/2026 (09:00–11:30):** **Final Demo Day & Trao giải** trực tiếp tại Greenwich Vietnam (20 Cộng Hòa, P. Bảy Hiền, TP.HCM).

---

## 3. Quy Tắc Cắt Bỏ Khi Trễ (Không Đánh Đổi Mốc Nộp)

1. **Cắt đầu tiên:** Demo live cắm MCP vào Antigravity/Claude Code (giữ file `agent/src/mcp.ts` làm tài liệu và quay demo bằng CLI + Dashboard).
2. **Cắt thứ hai:** Giao dịch mint NFT ERC-8004 nếu phát sinh lỗi phiên Privy (giữ nguyên phần đọc/hiển thị sẵn có).
3. **Không bao giờ cắt:** 7 bước demo chạy thật trên Fuji (`ExceedsDailyCap`, `ExceedsSandboxPerTxCap`, `pause`/`unpause`), nút **Chuyển thành API quen**, link repo public, Video & Slide đúng hạn.
