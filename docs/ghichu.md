# Ghi Chú Nhắc Nhở Nộp Bài & Pitch — AgentLeash (UniHack 2026)

**Cập nhật:** 18/11/2026  
**Mục tiêu:** Tránh sót các điểm dễ bị hỏi vặn, trừ điểm hoặc loại thủ tục trước hạn nộp **21/11/2026** và Final Demo Day **30/11/2026**.  
**Tài liệu đối chiếu:** [03-the-le-dieu-kien.md](../../doc/03-the-le-dieu-kien.md) · [06-tieu-chi-cham-diem.md](../../doc/06-tieu-chi-cham-diem.md) · [2026-11-18-deep-research-unihack-cac-mua-truoc.md](../../reports/2026-11-18-deep-research-unihack-cac-mua-truoc.md)

---

## 1. Xác nhận lịch nộp bài & thủ tục bắt buộc (Làm ngay hôm nay 18/11)

- [ ] **Chốt lại deadline trên Telegram `@Team1VNbuilders`:** Trang `https://team1vn.xyz/` ghi hạn nộp **23:59 ngày 21/11/2026** và Final Demo Day **30/11/2026 (09:00–11:30 tại Greenwich Vietnam, 20 Cộng Hòa, TP.HCM)**; một bản tóm tắt cũ trên `build.avax.network` từng ghi tuần 4 / mốc 25/11 -> hỏi xác nhận để không lệch giờ nộp.
- [ ] **Kiểm tra quyền mở mọi link (Luật loại trực tiếp: *"If the judges cannot open something, the team is disqualified"*):**
  - Repo GitHub `agentleash`: để **public**, hoặc nếu private phải mời đúng username **`tuantqse90`** làm collaborator.
  - Link **Slide** (Canva / Google Slides): mở quyền *"Anyone with the link can view"*, kiểm tra bằng trình duyệt ẩn danh.
  - **Video demo:** Độ dài đúng **2–3 phút** (tránh lố quá 3 phút), mở quyền xem công khai.
  - Bấm nút **Submit** chính thức trên `team1vn.xyz` (hệ thống có lưu nháp nhưng **chỉ tính khi đã bấm Submit**).

---

## 2. Luật 4 (AI Agent & Guardrails): Đã đạt chuẩn — Thủ sẵn câu trả lời cho nhánh Sandbox

Hiện trạng code `agentleash/` **không vi phạm Luật 4**, mà giải trực tiếp đúng yêu cầu *"rule engine is mandatory and the LLM must never be the one deciding to move money"*:
- **`agent/src/llm.ts`:** Chỉ gọi `@google/genai` với 2 tool tra cứu (`fetch_weather`, `fetch_exchange_rate`), không import `viem`, không giữ khóa, không ký hay gọi lệnh chuyển tiền.
- **`agent/src/rules.ts` (`RuleEngine`):** Lớp kiểm tra deterministic off-chain (`UNREGISTERED_API`, `INVALID_PAY_TO`, `PRICE_MISMATCH`, `RATE_LIMIT_EXCEEDED`, `DUPLICATE_QUERY`, `LOOP_DETECTED`).
- **`contracts/src/AgentPolicy.sol`:** Chốt chặn cuối non-custodial on-chain gồm **Spending cap** (`perTxCap`, `dailyCap`, `sandboxPerTxCap`, `sandboxDailyCap`), **Whitelist** (`whitelist[payTo]`), **Kill Switch** (`paused` chặn cả `authorize()` và `isValidSignature()`), và contract tự dựng EIP-712 `getDigest(...)` (dùng `--bypass-rules` vẫn bị contract chặn).

### Điểm duy nhất giám khảo có thể hỏi vặn & cách đáp trả
- **Câu hỏi vặn có thể gặp:** Trong `AgentPolicy.sol`, khi `whitelist[payTo] == false`, contract không revert ngay mà cho phép chi qua nhánh **Sandbox** (`sandboxPerTxCap`, `sandboxDailyCap`). Giám khảo có thể hỏi: *"Như vậy có bị coi là nới lỏng yêu cầu `whitelist` của Luật 4 không?"*
- **Cách trả lời chuẩn (không cần sửa/redeploy contract):**
  1. Đây là **Whitelist 2 tầng cách ly (*Strict Whitelist + Sandbox Quarantine*)**: tài khoản lạ bị nhốt trong hạn mức Sandbox siêu nhỏ do chính `owner` đặt ra và phải qua lọc URL chống SSRF ở `agent/src/mcp.ts` + `RuleEngine`; LLM tuyệt đối không tự mở được ngưỡng này.
  2. **Công tắc chuyển về Whitelist cứng 100% bất kỳ lúc nào:** Chỉ ra hàm `setCaps(perTxCap, dailyCap, 0, 0)` — chỉ cần chủ ví đặt `sandboxPerTxCap = 0` và `sandboxDailyCap = 0` là mọi địa chỉ ngoài `whitelist` đều bị revert `ExceedsSandboxPerTxCap` ngay lập tức (vì `amount > 0`).

---

## 3. Checklist các luật dễ bị trừ điểm khi quay video & pitch (Luật 3, 5, 6, 8, 9)

- [ ] **Luật 6 — Khai báo giả lập NGAY Ở ĐẦU video demo & bài pitch:**
  - Nói rõ ngay giây đầu tiên: bản demo rút ngắn chu kỳ hạn mức thành **120 giây** (`DEMO_PERIOD_SECONDS=120`) thay cho 1 ngày thật để giám khảo thấy hạn mức hồi lại; 3 API Thời tiết / Tỷ giá / Tin tức trả dữ liệu mock; và cảnh agent bị chiếm mã là kịch bản giả lập (`--bypass-rules`), còn Bên A trong video là Claude Code thật gọi MCP (sửa 21/11: video không dùng `--mock-llm`; đã ghi ở `README.md`, nhưng bắt buộc **nói rõ khi pitch/video**).
- [ ] **Luật 8 — Nhắc đúng giới hạn pháp lý Việt Nam (bỏ qua bị trừ điểm, nêu đúng được cộng điểm):**
  - Nhấn mạnh trong slide & lời pitch: **Crypto/USDC trên testnet không phải tiền pháp định tại Việt Nam**, doanh nghiệp trả lương nhân viên tại VN bắt buộc bằng **VND**, và AgentLeash **chỉ là lớp kiểm soát ngân sách kỹ thuật (technical guardrail / tool allowance)** chứ không cung cấp dịch vụ tư vấn tài chính có thu phí hay nắm giữ tiền hộ người dùng.
- [ ] **Luật 9 — Trả lời sắc nét 3 câu hỏi bắt buộc:**
  1. **Why on-chain?** Luật chi tiêu (`perTxCap`, `dailyCap`, `whitelist`, `paused`) và dấu vết kiểm toán (`Authorized` / `Released`) nằm bất biến trên Avalanche; kể cả server/agent/Privy bị chiếm bỏ qua rule engine off-chain thì `AgentPolicy` vẫn chặn trên chuỗi và chứng minh được trên Snowscan.
  2. **Why Avalanche?** Thanh toán `x402` pay-per-request cần xác nhận dưới 1 giây (`<1s` finality) và phí gas cực thấp để các micro-transaction `0.001 USDC` khả thi, đồng thời tương thích EVM (`ERC-1271`, `EIP-3009`, `ERC-8004`) và dễ mở rộng sang Avalanche L1 riêng cho doanh nghiệp sau này.
  3. **Where does the money / business model come from?** Doanh nghiệp/người dùng tự nạp ngân sách vào contract của riêng họ (non-custodial, không in token mới, không thu yield ảo); doanh thu bền vững của AgentLeash đến từ phí SaaS quản trị / Dashboard Proxy / gói enterprise cho đội dev & người dùng non-tech.
- [ ] **Luật 3 & Luật 5 (Kiểm tra nhanh):**
  - Khẳng định mỗi chủ ví deploy `AgentPolicy` riêng qua `AgentPolicyFactory` (non-custodial, chỉ `owner` rút tiền `withdraw()`).
  - Không lưu dữ liệu cá nhân/PII, audio hay prompt transcript lên chuỗi (chỉ có địa chỉ ví, số tiền, nonce, digest).

---

## 4. Điểm ăn trọn 50 điểm Technical + Avalanche Integration khi Demo (rút từ các mùa tiền nhiệm)

- [ ] **Giữ nguyên vẹn luồng lõi Fuji đang chạy ổn** (`x402` + `ERC-1271` + `EIP-3009 USDC` + `ERC-8004` + Dashboard), không thêm tính năng mạo hiểm làm vỡ demo sát giờ nộp.
- [ ] **Trong video 2–3 phút, bắt buộc quay đủ 3 cảnh đắt giá nhất:**
  1. Gọi API `x402` thành công và **mở link tx trên Snowscan Fuji** (chứng minh chạy thật, không chỉ là chatbot mock).
  2. Bật **`--bypass-rules` (Bỏ qua Rule Engine)** hoặc giả lập prompt injection vượt cap -> chứng minh **lớp on-chain `AgentPolicy` vẫn chặn đứng** (`ExceedsPerTxCap` / `ExceedsSandboxPerTxCap`).
  3. Bấm **Kill Switch (`pause`)** trên Dashboard -> chứng minh khóa cứng dòng tiền tức thì (`PausedError` / `isValidSignature = 0xffffffff`).
