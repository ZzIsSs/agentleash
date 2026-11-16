# Dàn ý Slide Pitch AgentLeash (Nháp GĐ 17/11)

> **Mục tiêu:** 12 trang rõ ràng cho vòng Online (chọn Top 10) & Final Demo Day trên **Team1 Vietnam UniHack 2026**, đáp ứng đủ 3 câu hỏi bắt buộc (Luật 9), Luật Việt Nam (Luật 8), tiêu chí **Avalanche Integration (25/100 điểm)** và khai báo giả lập ngay đầu pitch (Luật 6).
>
> **Bản Canva đã dựng (12 trang, `1920×1080`, Design ID `DAHbCvD2kR8`):**
> - Xem slide: https://www.canva.com/d/w1E_z_mwcHMPnWc
> - Chỉnh sửa: https://www.canva.com/d/0fPNoGpvq1yz7L7
>
> **Khi nộp bài:** Mở nút Share trên Canva bật **"Anyone with the link can view"** và kiểm tra lại link bằng tab ẩn danh (luật loại bài).

---

## Slide 1 — Trang bìa & Khai báo mở đầu
- **Tên dự án:** **AgentLeash** — *Ví cho AI Agent có "dây xích" on-chain*
- **Track:** AI Agents & Security / Agent Economy on x402 (Avalanche Fuji Testnet)
- **Thông điệp 1 câu:** AI agent tự trả phí API qua x402, nhưng tiền nằm trong policy contract của chủ; agent chỉ được xin chi, smart contract mới quyết chi theo hạn mức, whitelist và Kill Switch.
- **Speaker note (Luật 6 — đọc ở 15 giây đầu tiên):**
  > *"Lưu ý trước khi bắt đầu: trong bản demo hôm nay, chu kỳ hạn mức được rút ngắn còn **120 giây** (`DEMO_PERIOD_SECONDS=120`) thay cho 1 ngày thật, và hai API Thời tiết & Tỷ giá trả dữ liệu mock; toàn bộ giao dịch `authorize`, chữ ký ERC-1271 và thanh toán USDC x402 đều chạy thật trên Avalanche Fuji."*

## Slide 2 — Vấn đề: AI Agent biết tiêu tiền là rủi ro lớn nhất
- **Thực tế mới:** Với chuẩn HTTP `402` (**x402**), AI agent có thể tự mua dữ liệu, gọi tool API, trả từng khoản `0.001 USDC` mà không cần con người bấm xác nhận từng lần.
- **Điểm gãy chí mạng nếu đưa ví EOA thẳng cho Agent:**
  1. **Prompt Injection / Tool Hijack:** Kẻ xấu lừa LLM gọi tới địa chỉ nhận lạ → rút sạch USDC trong ví agent.
  2. **Lỗi vòng lặp (Loop bug):** Agent lặp call API vô hạn → đốt hết ngân sách trong vài giây.
  3. **Mất kiểm soát khẩn cấp:** Không có cách ngắt tức thì từ xa khi phát hiện bất thường.

## Slide 3 — Giải pháp: AgentLeash — Lớp bảo vệ 2 tầng (Off-chain + On-chain)
- **Nguyên tắc lõi (Luật 4):** LLM (`gemini-3.8-flash`) **không bao giờ giữ khóa** và **không tự quyết chuyển tiền**.
- **Tầng 1 — Off-chain Rule Engine (`agent/src/rules.ts`):**
  - Chặn sớm trước khi tốn gas: kiểm tra API có trong danh mục, khớp địa chỉ `payTo`, khớp bảng giá, giới hạn tần suất (`5 lần/phút`), chống mua trùng trong `60 giây`.
- **Tầng 2 — On-chain Policy Contract (`AgentPolicy.sol`):**
  - Dù rule engine bị tắt hay mã agent bị chiếm (`--bypass-rules`), tiền nằm trong smart contract của chủ, buộc phải đi qua **Whitelist / Sandbox caps + `dailyCap` + Kill Switch**.

## Slide 4 — Kiến trúc kỹ thuật & Luồng thanh toán x402 (ERC-1271 + EIP-3009)
- **Sơ đồ kiến trúc:**
  `Người dùng (Privy Email)` → `AgentPolicyFactory` → `AgentPolicy (giữ USDC)`
  `AI Agent (chỉ giữ ít AVAX gas)` → `402 từ Seller (4021 / 4023)` → `Rule Engine` → `AgentPolicy.authorize()` → `x402 Header (PAYMENT-SIGNATURE)` → `Facilitator (4022)` → `Circle USDC.transferWithAuthorization` → `AgentPolicy.isValidSignature()`
- **Điểm kỹ thuật mấu chốt:**
  - `AgentPolicy.authorize(...)` tính đúng **EIP-712 digest** của `FiatTokenV2_2` (`transferWithAuthorization`) ngay trên chuỗi và ghi nhận `authorizedDigests[digest]`.
  - Khi x402 Facilitator gọi `USDC.transferWithAuthorization(...)`, USDC Fuji gọi ngược `AgentPolicy.isValidSignature(digest, sig)` (**ERC-1271**) — trả `0x1626ba7e` chỉ khi digest đã duyệt, chưa quá hạn và contract chưa `paused`.
  - Nếu facilitator không settle, chủ/agent gọi `release(nonce)` để hoàn hạn mức nhưng **chỉ tăng hạn mức khả dụng**, không phá vỡ bất biến ngân sách.

## Slide 5 — Guardrail phân tầng & Khác biệt với ví truyền thống / Safe
- **Hạn mức 2 tầng ngay trong `AgentPolicy.sol`:**
  - **Tầng 1 — Whitelist (Tin cậy):** Giới hạn `perTxCap` & `dailyCap` chung toàn chu kỳ (ví dụ `0.002 / 0.003 USDC`).
  - **Tầng 2 — Sandbox (Địa chỉ lạ):** Cho phép thử nhà cung cấp mới nhưng siết trần cực thấp (`sandboxPerTxCap` `0.0005` / `sandboxDailyCap` `0.001 USDC`), và vẫn cộng dồn vào `dailyCap` chung.
  - **Kill Switch nguyên tử (`pause()`):** Chặn cả giao dịch mới **lẫn** các digest đã `authorize` trước đó nhưng chưa settle.
- **So sánh nhanh với Safe `AllowanceModule` (trả lời câu hỏi kỹ thuật sâu):**
  - Safe `AllowanceModule` chỉ khóa `(safe, delegate, token)` theo tổng lượng/chu kỳ (`resetTimeMin`), **không có whitelist người nhận** (delegate gửi tới `to` bất kỳ trong hạn mức) và **không tích hợp chữ ký ERC-1271 theo từng khoản chi x402 EIP-3009**.
  - AgentLeash thiết kế chuyên biệt cho **HTTP x402 agent micropayments**.

## Slide 6 — Câu hỏi bắt buộc 1: Vì sao phải On-chain?
- *Luật off-chain nằm cùng chỗ với agent: kẻ tấn công chiếm được server hoặc qua mặt prompt là sửa được rule off-chain.*
- **Đặt luật chi tiêu on-chain trên `AgentPolicy.sol` giải quyết 3 điều không thể làm giả ở off-chain:**
  1. **Agent không thể tự sửa luật:** Chỉ `owner` (ví Privy của chủ) mới đổi được `setCaps`, `setWhitelist`, `pause` hay `withdraw`.
  2. **Thiệt hại có trần toán học:** Nếu agent bị chiếm quyền (`--bypass-rules`), lỗ tối đa chỉ bằng `sandboxDailyCap` / `remainingDailyCap` (đã chứng minh bất biến qua **128.000 invariant fuzz calls** trong Foundry).
  3. **Kiểm toán công khai, không cần tin đội phát triển:** Mọi khoản duyệt (`Authorized`), khóa (`Paused`) và chuyển USDC đều đối chiếu được trực tiếp trên Snowtrace / Routescan.

## Slide 7 — Câu hỏi bắt buộc 2: Vì sao là Avalanche?
- **Sự sẵn sàng của hạ tầng Avalanche cho x402 Agent Economy:**
  1. **Circle USDC gốc trên Fuji & C-Chain (`FiatTokenV2_2`)** hỗ trợ đầy đủ **ERC-1271 + EIP-3009** — điều kiện bắt buộc để smart contract giữ quỹ cho agent qua x402 mà không cần EOA trung gian.
  2. **Hệ sinh thái Facilitator x402 sẵn trên Avalanche Fuji (`eip155:43113`)**: hỗ trợ cả facilitator tự host (`localhost:4022`) lẫn PayAI công khai làm dự phòng.
  3. **Phí gas thấp & finality nhanh trên C-Chain:** Giúp các giao dịch siêu nhỏ `0.001 USDC` (gọi API thời tiết, tỷ giá từng lượt) khả thi về mặt kinh tế.
- *(Minh bạch theo tinh thần kỹ thuật: chuẩn x402 cũng có thể chạy trên các EVM chain khác hỗ trợ EIP-3009 + ERC-1271, nhưng Avalanche C-Chain / Fuji cung cấp đủ đồng bộ Circle USDC ERC-1271 + facilitator + tốc độ xác nhận cho kịch bản micropayment.)*

## Slide 8 — Kịch bản Demo 7 bước chạy thật trên Avalanche Fuji
- **Hiển thị ảnh Dashboard (4 thẻ một màn hình, Dark Mode):**
  - `[1] Tổng quan`: Số dư `0.051 USDC`, đồng hồ hạn mức Whitelist (`0.003`) & Sandbox (`0.001`), nút đỏ **KHÓA KHẨN CẤP**.
  - `[2] Dòng tiền`: Sơ đồ SVG `AI Agent → AgentPolicy → Thời tiết / Tỷ giá / Địa chỉ lạ` + danh sách kèm link Snowtrace.
  - `[3] Policy & luật chi tiêu`: Tạo policy qua Factory, bật/tắt Whitelist, sửa 4 ngưỡng `setCaps` ngay trên web.
  - `[4] Bị từ chối`: Gộp cả chặn off-chain (`RuleEngine`) lẫn revert on-chain (`ExceedsDailyCap`, `ExceedsSandboxPerTxCap`, `PausedError`).
- **Tóm tắt 3 khoảnh khắc "wow" trong video demo 2 phút:**
  1. Agent tự mua 3 lần API Thời tiết & Tỷ giá thành công → Lần 4 tự động bị contract chặn **`ExceedsDailyCap`**.
  2. Bật `--bypass-rules` giả lập agent bị chiếm gọi địa chỉ lạ `0x1111…1111` (`0.001 USDC`) → Contract vẫn chặn ngay vì **`ExceedsSandboxPerTxCap`**.
  3. Chủ bấm **KHÓA KHẨN CẤP (`pause`)** trên web → Agent bị **`PausedError`** ở mọi lệnh gọi → Mở khóa (`unpause`) khôi phục vận hành.

## Slide 9 — Trải nghiệm Non-Custodial & Onboarding bằng Privy
- **Không cần cài ví MetaMask:** Đăng nhập bằng email qua **Privy (`@privy-io/react-auth`) + `viem` thuần**, tự tạo Embedded Wallet cho chủ policy.
- **Mỗi chủ một smart contract (`AgentPolicyFactory.createPolicy`):**
  - Chủ toàn quyền `withdraw()`, `setCaps()`, `setWhitelist()`, `pause()`/`unpause()`.
  - Đội phát triển **không** gom quỹ, **không** có admin backdoor trên policy của người dùng.
- **Trạng thái giao dịch 3 bước minh bạch:** `Đang ký` → `Đang chờ xác nhận` → `Xong (kèm link Snowtrace)`.

## Slide 10 — Câu hỏi bắt buộc 3: Tiền đến từ đâu? (Mô hình kinh doanh)
- **Không giữ hộ tiền, không phát hành token, không hứa hẹn yield ảo (Luật 2, 3, 7):**
  1. **SaaS theo đội / doanh nghiệp:** Thu phí hàng tháng theo số lượng AI agent / policy được quản lý, dashboard giám sát dòng tiền đa agent, cảnh báo bất thường và xuất báo cáo audit.
  2. **Phí hạ tầng nhỏ (Infrastructure / Facilitator fee):** Phí rất nhỏ (tính bằng phần nghìn hoặc gói quota) trên các luồng thanh toán x402 đi qua hạ tầng facilitator / gateway cho nhà phát triển.
- **Khách hàng mục tiêu giai đoạn đầu:** Nhóm dev & startup AI dùng agent gọi API bên thứ ba (dữ liệu thị trường, tìm kiếm, công cụ tự động hóa) cần "hộp đen ngân sách" để dám đưa vào vận hành.

## Slide 11 — Tuân thủ Pháp luật Việt Nam & 9 Luật Chung (Luật 2, 3, 5, 8)
- **Ranh giới pháp lý tại Việt Nam (Luật 8):**
  - **Không phải phương tiện thanh toán:** AgentLeash không dùng crypto làm tiền pháp định thay VND cho tiêu dùng phổ thông hay **trả lương**; hệ thống chỉ minh họa thanh toán dữ liệu máy-với-máy (M2M) bằng **USDC testnet trên Fuji**.
  - **Không huy động vốn / không nhận tiền thật:** Không bán token, không thu tiền thật của người dùng, không hứa hẹn lợi nhuận hay yield.
  - **Không tư vấn tài chính / cổ phiếu token hóa:** Agent chỉ mua dữ liệu mô phỏng Thời tiết & Tỷ giá, không đưa lời khuyên đầu tư có thu phí.
- **Bảo vệ dữ liệu (Luật 5):** Không đưa prompt người dùng, nội dung hội thoại hay thông tin cá nhân (PII) lên blockchain — on-chain chỉ có địa chỉ ví, số tiền và mã trạng thái.

## Slide 12 — Bằng chứng kiểm thử & Bước tiếp theo
- **Đã chạy & kiểm chứng thật trước ngày nộp:**
  - **Smart Contracts (Foundry):** **29/29 tests pass** (unit + invariant fuzz 128.000 calls + fork Fuji với Circle USDC thật); `AgentPolicyFactory` (`0x369251fC256D8Ae3B25F66Fe1c4b3114A06BA864`) & `AgentPolicy` đã deploy & verified trên Fuji.
  - **Web Dashboard:** **54/54 vitest tests pass**, `tsc --noEmit` & `eslint` sạch.
  - **Agent & Rule Engine:** **18/18 vitest tests pass**, `tsc --noEmit` sạch, chạy thông suốt với x402 Facilitator & 2 API Seller trên Fuji.
- **Mở rộng sắp tới:** Tích hợp chuẩn danh tính agent **ERC-8004** (registry `0x8004A818BFB912233c491871b3d84c89A494BD9e` trên Fuji), công tắc test nâng cao trên web và đóng gói triển khai demo cho giám khảo.

---

## Phụ lục — Nháp sẵn nội dung Form Nộp Bài (`team1vn.xyz`)

> Ràng buộc độ dài từ `hack.js`: **≤ 800 ký tự** cho mỗi ô.

### 1. Nháp `What it does` (691 ký tự / ≤ 800)
> AgentLeash is a non-custodial spending policy wallet ("on-chain leash") for AI agents using HTTP x402 micropayments on Avalanche Fuji. When an LLM agent (`gemini-3.8-flash`) needs paid API data, an off-chain rule engine checks catalog, price, and rate limits before delegating payment authorization to a user-owned `AgentPolicy` smart contract (`ERC-1271` + `EIP-3009` Circle USDC). Even if the agent is prompt-injected or bypasses off-chain rules, the contract enforces tiered Trusted/Sandbox caps, recipient whitelists, and an owner-controlled Kill Switch. Today's working MVP includes verified Fuji contracts, local x402 facilitator + 2 paid APIs, CLI agent, and a Privy + viem dashboard.

### 2. Nháp `Anything else for the judges` (706 ký tự / ≤ 800)
> Demo disclosure (Rule 6): the live demo uses a 120s budget window (`DEMO_PERIOD_SECONDS=120`) and mocked Weather/Exchange-Rate x402 APIs while running real ERC-1271 + EIP-3009 USDC settlements on Avalanche Fuji.
>
> Test flow: Run `sellers` (4021, 4023), self-hosted x402 facilitator (4022), and Next.js dashboard (3000), or inspect Fuji policy `0x62Ea5e422b3ef66174B6Dd6Aa855F1f036894177` (created via verified Factory `0x369251fC256D8Ae3B25F66Fe1c4b3114A06BA864`). Log in on dashboard via Privy email to view real-time caps, spend SVG flow, rejections (`ExceedsDailyCap`, `ExceedsSandboxPerTxCap`, `PausedError`), and owner controls (`pause`, `setWhitelist`, `setCaps`). Agent LLM never holds private keys.
