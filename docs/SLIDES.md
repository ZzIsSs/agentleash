# Slide Pitch AgentLeash (bản nộp 21/11/2026)

> **Mục tiêu:** bộ slide cho vòng online (chọn Top 10) và pitch 5 phút kèm demo ở Final Demo Day của **Avalanche Team1 Vietnam UniHack 2026**. Giám khảo chấm theo 3 tiêu chí: giá trị đề xuất, độ phức tạp kỹ thuật, mức dùng công nghệ Avalanche. Slide phải trả lời 3 câu bắt buộc (Luật 9), khai báo phần giả lập ngay đầu pitch (Luật 6) và nêu ranh giới pháp lý Việt Nam (Luật 8).
>
> **Bản Canva (dựng từ mẫu "Blue and Black Modern Technology Presentation", 20 trang):** https://canva.link/jaccx7sy0wk2lam
> Bộ cũ 12 trang (Design ID `DAHbCvD2kR8`, dựng 17/11) không dùng nữa.
>
> **Trước khi nộp:**
> - Link trên mở ở chế độ chỉnh sửa khi chủ thiết kế đăng nhập. Trong Canva bấm **Share**, chọn **Anyone with the link → Can view**, rồi dán link chỉ xem đó vào form. Mở thử bằng tab ẩn danh để chắc người ngoài xem được và không sửa được.
> - Trang 18 (OUR TEAM) do Nguyên tự làm: tên, vai trò và ảnh thật của thành viên. Chưa xong thì không nộp, vì trang này đang còn ảnh người mẫu của template.
> - Nên thay ảnh stock ở trang 13 (Demo) và trang 12 (Đã chạy thật) bằng ảnh chụp màn hình khung điều khiển thật, vì giám khảo vòng online chỉ đọc slide.

Nguồn của từng thông tin trên slide và việc cần kiểm trước khi chỉnh: [SLIDES_NGUON.md](SLIDES_NGUON.md).

**Số liệu dùng trong slide (kiểm lại ngày 20/11/2026):**

| Mục | Giá trị | Nguồn |
|---|---|---|
| Test contract | `forge test` 29/29, gồm invariant fuzz 128.000 lượt gọi (256 runs) và fork Fuji với Circle USDC thật | nhật ký 13/11 và 20/11 |
| Test agent / web | vitest 49/49 / vitest 91/91, `tsc`, `eslint`, `next build` sạch | nhật ký 20/11 |
| `AgentPolicyFactory` | `0x369251fC256D8Ae3B25F66Fe1c4b3114A06BA864`, đã verify | README |
| `AgentPolicy` demo | `0x62Ea5e422b3ef66174B6Dd6Aa855F1f036894177`: Trusted `0.002 / 0.003`, Sandbox `0.0005 / 0.001` USDC, chu kỳ 120 giây, số dư 0.03 USDC | đọc trực tiếp trên Fuji bằng `cast call` ngày 20/11 |
| RuleEngine | tối đa 5 lần/phút, chống mua trùng trong 60 giây | `agent/src/rules.ts` |
| Dịch vụ local | Thời tiết `4021`, Tỷ giá `4023`, Tin tức `4024` (API lạ mẫu), facilitator `4022`, khung điều khiển `3000` | README, `sellers/` |
| Khung điều khiển | 5 trang: Tổng quan, Dòng tiền x402, Policy & Luật 2 tầng, Nhật ký & Rules, MCP Bên A – Bên B | `web/src/components/ConsoleShell.tsx` |
| MCP | 3 tool `test_unknown_api`, `call_trusted_api`, `get_policy_status`; cài bằng `npm --prefix agent run setup:mcp` | README |
| Triển khai | Không có bản online (bỏ Vercel 20/11), demo chạy local, ô *Live app* để trống | CLAUDE.md |

**Sơ đồ luồng (trang 6–8):** ảnh PNG nền trong suốt dựng từ HTML trong `docs/slides/flows/`. Sửa nội dung thì sửa file `.html`, chạy `bash docs/slides/flows/render.sh` rồi dùng nút Replace trên Canva để thay ảnh (giữ nguyên khung, không bị cắt).

**Kiểu chữ:** toàn bộ chữ dùng font Gentium Plus (hỗ trợ đủ dấu tiếng Việt). Các ô nội dung (đoạn văn, cột, mục lục, dòng khai báo trên bìa) để cỡ 24; tiêu đề và tiêu đề cột giữ cỡ của mẫu.

Dòng nhãn nhỏ ở góc mỗi trang (template ghi "LARANA, INC.") đổi thành `AGENTLEASH`. Tiêu đề cột trên slide dùng font Retropix chữ hoa, ô hẹp, nên chỉ giữ 1 đến 2 từ cho khỏi xuống dòng; phần giải thích nằm ở nội dung cột.

Trên Canva mới chỉ trang 1 có speaker note. Speaker note của các trang khác nằm trong file này; nếu cần đọc khi trình chiếu thì dán vào ô Notes của từng trang.

---

## Trang 1 — Bìa (bố cục: tiêu đề lớn + dòng phụ)
- **Tiêu đề:** AGENTLEASH
- **Dòng phụ:** Dây xích on-chain cho ví AI agent · x402 trên Avalanche Fuji
- **Dòng khai báo (Luật 6, hiện trên slide):** Khai báo mô phỏng: chu kỳ hạn mức rút còn 120 giây, API Thời tiết, Tỷ giá và Tin tức trả dữ liệu mock, cảnh agent bị chiếm mã là kịch bản giả lập (--bypass-rules). Contract, x402 và USDC chạy thật trên Avalanche Fuji; Bên A trong video là Claude Code thật gọi MCP. *(Sửa 21/11 theo video thật, thay câu "--mock-llm" cũ; trên Canva Nguyên đã đổi.)*
- **Speaker note (đọc trong 15 giây đầu):**
  > Trước khi bắt đầu, nhóm xin khai báo phần mô phỏng. Chu kỳ hạn mức được rút ngắn còn 120 giây thay cho 1 ngày (`DEMO_PERIOD_SECONDS=120`). Ba API Thời tiết, Tỷ giá và Tin tức trả dữ liệu mock. Cảnh agent bị chiếm mã là kịch bản giả lập: bật `--bypass-rules` và trả tiền cho địa chỉ lạ `0x1111…`. Còn lại đều chạy thật trên Avalanche Fuji: `authorize`, `AgentPolicy`, chữ ký ERC-1271 và thanh toán USDC x402 (EIP-3009); Bên A trong video là Claude Code thật gọi MCP AgentLeash. Tích hợp Gemini thật có sẵn qua `demo:gd2`.

## Trang 2 — Mục lục (bố cục: tiêu đề + 2 cột chữ)
- **Cột 1:** 01 Vấn đề · 02 Giải pháp · 03 Kiến trúc · 04 Vì sao on-chain? · 05 Tính mới · 06 Vì sao Avalanche? · 07 Đã chạy thật trên Fuji
- **Cột 2:** 08 Demo 3 khoảnh khắc · 09 MCP Gateway cho agent · 10 Tiền đến từ đâu? · 11 Tuân thủ pháp luật · 12 Lộ trình sau 21/11 · 13 Đội ngũ · 14 Thử ngay
- **Speaker note:** Bài gồm 3 phần: vấn đề và giải pháp, 3 câu hỏi bắt buộc kèm bằng chứng chạy thật, cuối cùng là mô hình kinh doanh và lộ trình.

## Trang 3 — Vấn đề (bố cục: tiêu đề + 2 cột chữ)
- **Cột 1:** Với chuẩn HTTP 402 (x402), AI agent tự mua dữ liệu và gọi API trả phí, mỗi lượt chỉ 0.001 USDC, không cần người bấm duyệt. Nếu đưa thẳng ví EOA cho agent, quyền chi tiền nằm trong tay một LLM có thể bị lừa.
- **Cột 2:** Ba điểm gãy: (1) Prompt injection đổi địa chỉ nhận tiền (payTo) và rút sạch ví. (2) Lỗi vòng lặp gọi API liên tục, đốt hết ngân sách trong vài giây. (3) Không có nút ngắt khẩn cấp khi phát hiện bất thường.
- **Speaker note:** x402 làm việc trả tiền máy với máy trở nên dễ, nhưng cũng biến mọi lỗi của agent thành mất tiền thật. Câu hỏi không phải agent có nên tiêu tiền không, mà là ai giữ quyền quyết định cuối cùng.

## Trang 4 — Giải pháp (bố cục: tiêu đề + 2 cột chữ)
- **Cột 1 · Tầng 1, RuleEngine off-chain:** Chặn sớm trước khi tốn gas: API phải có trong danh mục, khớp payTo và bảng giá, tối đa 5 lần/phút, chống mua trùng trong 60 giây. LLM (gemini-3.8-flash) chỉ đề xuất tool call, không giữ khóa, không tự chuyển tiền.
- **Cột 2 · Tầng 2, AgentPolicy on-chain:** USDC nằm trong contract của chủ. API quen (Trusted) và API lạ (Sandbox) có trần riêng, cùng cộng vào dailyCap chung. Kill Switch pause() chặn cả khoản đã duyệt nhưng chưa settle. Agent bị chiếm và bỏ qua RuleEngine thì contract vẫn chặn.
- **Speaker note:** Hai tầng có vai trò khác nhau. Tầng 1 tiết kiệm gas và trả lý do dễ hiểu. Tầng 2 là chốt chặn cuối cùng, không phụ thuộc vào việc mã agent còn đáng tin hay không.

## Trang 5 — Kiến trúc (bố cục: tiêu đề + 3 khối chữ)
- **Khối 1 · Luồng thanh toán:** Agent gọi API, nhận mã 402 → RuleEngine duyệt → AgentPolicy.authorize() ghi nhận digest EIP-712 → agent gửi header PAYMENT-SIGNATURE → facilitator x402 (4022) gọi USDC.transferWithAuthorization (EIP-3009).
- **Khối 2 · Chốt chặn ERC-1271:** USDC Fuji gọi ngược AgentPolicy.isValidSignature(digest). Contract chỉ trả 0x1626ba7e khi digest đã được duyệt, chưa hết hạn và policy chưa bị khóa. Ví agent chỉ giữ ít AVAX trả gas, không giữ USDC.
- **Khối 3 · Chủ ví:** Đăng nhập bằng email qua Privy, tạo policy riêng qua AgentPolicyFactory, quản trị trên khung điều khiển Next.js + viem. Facilitator không settle thì release(nonce) trả lại hạn mức.
- **Speaker note:** Điểm khó nhất là để một smart contract "ký" thay agent. `authorize` tính đúng digest mà `FiatTokenV2_2` sẽ kiểm, nên USDC chỉ chuyển khi chính contract đã đồng ý khoản chi đó.

## Trang 6 — Luồng thanh toán x402 (sơ đồ tuần tự)
- **Tiêu đề:** THANH TOÁN X402
- **Ảnh:** `docs/slides/flows/1-thanh-toan-x402.png`. Sáu cột: AI Agent, RuleEngine, API Seller, Facilitator x402 (4022), Circle USDC, AgentPolicy. Mười bước từ gọi API nhận 402, `authorize` lưu digest EIP-712, gửi `PAYMENT-SIGNATURE`, facilitator gọi `transferWithAuthorization`, USDC gọi ngược `isValidSignature` (ERC-1271) rồi chuyển 0.001 USDC, tới 200 OK. Nét vàng là bước on-chain.
- **Speaker note:** Điểm mấu chốt là bước 4 và 8. Agent không ký chuyển tiền; nó chỉ xin contract duyệt một digest. Khi facilitator settle, chính USDC hỏi lại contract, và contract chỉ trả `0x1626ba7e` cho digest đã duyệt, chưa hết hạn và chưa bị khóa.

## Trang 7 — Hai tầng chặn (sơ đồ quyết định)
- **Tiêu đề:** HAI TẦNG CHẶN
- **Ảnh:** `docs/slides/flows/2-hai-tang-chan.png`. Agent → RuleEngine (tầng 1, mã chặn `UNREGISTERED_API`, `INVALID_PAY_TO`, `PRICE_MISMATCH`, `RATE_LIMIT_EXCEEDED`, `LOOP_DETECTED`) → AgentPolicy (tầng 2, `PausedError` khi khóa) → rẽ nhánh theo whitelist: Trusted (≤ 0.002/lượt, ≤ 0.003/chu kỳ) hoặc Sandbox (≤ 0.0005/lượt, ≤ 0.001/chu kỳ, vẫn tính vào dailyCap) → Duyệt. Đường nét đứt: `--bypass-rules` bỏ qua tầng 1 nhưng vẫn phải qua tầng 2.
- **Speaker note:** Thứ tự kiểm tra lấy đúng từ `AgentPolicy.authorize()`. Kể cả khi agent bị chiếm và bỏ qua RuleEngine, khoản chi cho địa chỉ lạ vẫn rơi vào nhánh Sandbox với trần rất thấp.

## Trang 8 — MCP Bên A – Bên B (từ API lạ thành API quen)
- **Tiêu đề:** MCP BÊN A – BÊN B
- **Ảnh:** `docs/slides/flows/3-mcp-ben-a-b.png`. (1) Bên A (Claude Code, Antigravity) gọi `test_unknown_api` → lọc URL (`UNSAFE_URL`) → RuleEngine → AgentPolicy trần Sandbox → lọt thì trả dữ liệu, bị chặn thì trả lý do kèm link khung điều khiển. (2) Chủ ví đăng nhập Privy, bấm "Chuyển thành API quen" → `setWhitelist(payTo)` on-chain. (3) Bên A gọi lại bằng `call_trusted_api` với hạn mức Trusted.
- **Speaker note:** Ví dụ trong demo là API Tin tức (cổng 4024) giá 0.001 USDC, vượt trần Sandbox 0.0005 nên bị chặn lần đầu. Sau khi chủ ví duyệt một lần, agent gọi được như API quen. MCP không bao giờ giữ khóa owner.

## Trang 9 — Câu hỏi bắt buộc 1: Vì sao on-chain? (bố cục mẫu ABOUT US: tiêu đề + 2 đoạn)
- **Tiêu đề:** VÌ SAO ON-CHAIN?
- **Đoạn 1:** Luật off-chain nằm cùng chỗ với agent: chiếm được server hoặc lừa được prompt là sửa được luật. Đặt luật trong AgentPolicy.sol thì agent không tự sửa được. Chỉ owner (ví Privy của chủ) mới gọi được setCaps, setWhitelist, pause, withdraw.
- **Đoạn 2:** Thiệt hại có trần: agent bị chiếm cũng chỉ tiêu được phần hạn mức còn lại, đã kiểm bằng invariant fuzz 128.000 lượt gọi trong Foundry. Mọi khoản Authorized, Paused và chuyển USDC đều kiểm tra công khai được trên Snowtrace, không cần tin đội phát triển.
- **Speaker note:** Đây là câu hỏi bắt buộc 1. Ba lý do: agent không tự sửa luật, thiệt hại có trần, và ai cũng kiểm toán được.

## Trang 10 — Tính mới (bố cục mẫu ABOUT US nhân bản)
- **Tiêu đề:** TÍNH MỚI
- **Đoạn 1 · Luật chạy trước chữ ký:** Mỗi khoản chi x402 phải được AgentPolicy duyệt on-chain thì mới có hiệu lực. authorize() kiểm whitelist, trần mỗi lượt và trần chu kỳ rồi giữ chỗ trong hạn mức; USDC chỉ chuyển khi isValidSignature (ERC-1271) xác nhận đúng khoản đã duyệt. Khoản không được settle thì release() trả lại hạn mức. Agent không giữ USDC và không có chữ ký chuyển tiền nào để bị đánh cắp.
- **Đoạn 2 · Từ API lạ thành API quen:** Mỗi khoản chi tự rơi vào tầng Trusted hoặc Sandbox theo địa chỉ nhận. Coding agent (Claude Code, Antigravity) thử API x402 lạ qua MCP dưới trần Sandbox, chủ ví bấm 1 lần để nâng thành API quen. Kill Switch pause() vô hiệu ngay cả những khoản đã duyệt nhưng chưa settle.
- **Speaker note:** Điểm đột phá là đảo thứ tự: luật chạy trước, chữ ký chỉ là bước xác nhận, giống phiếu chi trong doanh nghiệp phải được duyệt rồi kế toán mới chi. `authorize()` không lấy tiền, nó chỉ giữ chỗ trong hạn mức; tiền chỉ chuyển khi facilitator settle. Khi settle, USDC hỏi ví bằng lệnh chỉ đọc, nên hạn mức tích lũy chỉ có hiệu lực thật nếu được giữ chỗ từ trước. Phần còn lại biến cơ chế này thành sản phẩm: hai tầng theo người nhận, MCP cho coding agent, và nút ngắt có hiệu lực cả với khoản đã duyệt.
- **Lưu ý (không dán vào Notes):** Trang này không nhắc Safe. Nếu giám khảo hỏi, dùng phụ lục Q&A cuối file.

## Trang 11 — Câu hỏi bắt buộc 2: Vì sao Avalanche? (bố cục mẫu VISION: tiêu đề + 4 cột)
- **Tiêu đề:** VÌ SAO AVALANCHE?
- **USDC:** Circle USDC trên Fuji (FiatTokenV2_2) hỗ trợ cả ERC-1271 lẫn EIP-3009, điều kiện để contract giữ quỹ thay agent.
- **X402:** Facilitator x402 chạy với eip155:43113: tự host ở cổng 4022, PayAI công khai làm dự phòng.
- **PHÍ THẤP:** Phí gas thấp và finality nhanh trên C-Chain giúp khoản 0.001 USDC mỗi lượt gọi có ý nghĩa kinh tế.
- **NÓI THẬT:** x402 cũng chạy trên EVM khác. Fuji là nơi có đủ USDC ERC-1271, facilitator và registry ERC-8004 cho danh tính agent.
- **Speaker note:** Đây là câu hỏi bắt buộc 2. Nhóm nói thẳng x402 không độc quyền Avalanche; lý do chọn là hạ tầng đã đủ để contract giữ quỹ và trả tiền theo từng lượt.

## Trang 12 — Đã chạy thật trên Fuji (bố cục mẫu VISION nhân bản)
- **Tiêu đề:** CHẠY THẬT
- **CONTRACT:** forge test 29/29: unit, invariant fuzz 128.000 lượt gọi, fork Fuji với Circle USDC thật. Factory 0x3692…A864 đã verify.
- **AGENT:** vitest 49/49 cho RuleEngine, PolicySigner, x402 client và MCP Gateway 3 tool, cài bằng 1 lệnh setup:mcp.
- **WEB:** vitest 91/91, next build sạch. Khung điều khiển 5 trang trên Privy + viem, che email khi trình chiếu.
- **POLICY:** AgentPolicy 0x62Ea…4177 trên Fuji, chu kỳ 120 giây. Mọi giao dịch tra được trên Snowtrace.
- **Speaker note:** Mọi con số ở trang này chạy lại được từ repo. Địa chỉ đầy đủ có trong README.

## Trang 13 — Demo 3 khoảnh khắc (bố cục mẫu MISSION: tiêu đề dọc + 3 mục)
- **Tiêu đề dọc:** DEMO
- **LẦN THỨ 4:** Agent mua dữ liệu Thời tiết và Tỷ giá 3 lần thành công. Lần thứ 4 contract trả ExceedsDailyCap.
- **BỊ CHIẾM:** Bật --bypass-rules, agent trả 0.001 USDC cho địa chỉ lạ. Contract chặn bằng ExceedsSandboxPerTxCap.
- **KHÓA GẤP:** Chủ bấm Khóa khẩn cấp trên web, mọi lệnh gọi trả PausedError. Mở khóa thì agent chạy lại.
- **Speaker note:** Demo chạy trên khung điều khiển 5 trang: Tổng quan (hạn mức 2 tầng, Kill Switch), Dòng tiền x402, Policy & Luật 2 tầng, Nhật ký & Rules, MCP Bên A – Bên B. Cả ba lần chặn đều là revert on-chain, không phải chặn ở giao diện.

## Trang 14 — MCP Gateway cho agent (bố cục mẫu MISSION nhân bản)
- **Tiêu đề dọc:** MCP
- **API LẠ:** test_unknown_api cho Claude Code, Antigravity thử API x402 mới trong trần Sandbox. Bị chặn thì trả lý do và link khung điều khiển.
- **API QUEN:** call_trusted_api gọi API trong whitelist với hạn mức Trusted. get_policy_status xem số dư, hạn mức và Kill Switch.
- **1-CLICK:** Chủ ví xem các API lạ agent đã thử, bấm Chuyển thành API quen (setWhitelist). MCP không bao giờ giữ khóa owner.
- **Speaker note:** Agent lập trình như Claude Code hay Antigravity là Bên A, AgentLeash là Bên B cắm vào qua MCP. API Tin tức (cổng 4024) là API lạ mẫu để minh họa luồng thử rồi duyệt.

## Trang 15 — Câu hỏi bắt buộc 3: Tiền đến từ đâu? (bố cục mẫu SERVICES: tiêu đề + 3 cột)
- **Tiêu đề:** TIỀN TỪ ĐÂU?
- **SAAS:** Thu phí tháng theo số agent và policy được quản lý: giám sát dòng tiền nhiều agent, cảnh báo bất thường, xuất báo cáo audit.
- **HẠ TẦNG:** Phí rất nhỏ hoặc gói quota trên luồng thanh toán x402 đi qua gateway và facilitator của AgentLeash.
- **KHÁCH:** Dev và startup AI có agent gọi API trả phí, cần trần ngân sách cứng mới dám cho agent chạy thật. Không giữ hộ tiền, không phát hành token.
- **Speaker note:** Đây là câu hỏi bắt buộc 3. Doanh thu đến từ phần mềm và hạ tầng, không đến từ việc giữ tiền của người dùng hay token.

## Trang 16 — Tuân thủ pháp luật Việt Nam (bố cục mẫu SERVICES nhân bản)
- **Tiêu đề:** TUÂN THỦ
- **PHÁP LÝ:** Crypto không phải phương tiện thanh toán ở Việt Nam. AgentLeash chỉ minh họa thanh toán máy với máy bằng USDC testnet, không trả lương, không thanh toán tiêu dùng.
- **GIỮ TIỀN:** Mỗi chủ một contract, chỉ chủ rút được. Không huy động vốn, không bán token, không hứa lợi nhuận, không tư vấn đầu tư.
- **DỮ LIỆU:** On-chain chỉ có địa chỉ ví, số tiền và trạng thái. Prompt, nội dung truy vấn và thông tin cá nhân không lên chuỗi.
- **Speaker note:** Ba cột lần lượt ứng với Luật 2 và 8, Luật 3 và 7, Luật 5.

## Trang 17 — Lộ trình sau 21/11 (bố cục mẫu SERVICES nhân bản)
- **Tiêu đề:** LỘ TRÌNH
- **REMOTE:** Chuyển MCP local sang Streamable HTTP trên cloud: OAuth gắn ví Privy, session key và dữ liệu riêng cho từng người dùng.
- **AN TOÀN:** Hỗ trợ POST và body, chặn SSRF dải IP nội bộ, sổ ánh xạ URL ↔ payTo, chấm chất lượng dữ liệu trả về.
- **ERC-8004:** Dùng registry ERC-8004 trên Fuji để xếp hạng độ tin cậy của API x402 và agent, rồi phát hành plugin cho IDE.
- **Speaker note:** Bản nộp hôm nay là MCP local một người dùng. Bước tiếp theo là để người dùng cài một chạm như các plugin Canva, Notion, Figma mà không cần Node hay file `.env`.

## Trang 18 — OUR TEAM (Nguyên tự làm)
- Thay 3 ảnh người mẫu và chữ mẫu bằng tên, vai trò, ảnh thật của thành viên.

## Trang 19 — Thử ngay (bố cục mẫu GET IN TOUCH: tiêu đề + 3 dòng)
- **Tiêu đề:** THỬ NGAY
- **3 dòng:** github.com/ZzIsSs/agentleash · Factory 0x3692…A864 · Fuji · Demo chạy local: localhost:3000
- **Speaker note:** Không có bản online. Giám khảo kiểm chứng qua repo, video và địa chỉ contract trên Snowtrace. Cài MCP cho Claude Code và Antigravity bằng `npm --prefix agent run setup:mcp`.

## Trang 20 — THANK YOU
- Giữ nguyên tiêu đề THANK YOU, chỉ đổi dòng nhãn nhỏ.

---

## Phụ lục — Q&A dự phòng: so với Safe (không chiếu)

> Không nhắc Safe trong lúc pitch. Chỉ dùng khi giám khảo hỏi. Nguồn: báo cáo khảo sát Safe của Nguyên (20/11/2026), ngày phát hành lấy từ GitHub Releases của `safe-global`.

**Câu gốc: "Sao không dùng Safe?" (trả lời trong 30 giây)**
> Safe rất tốt để giữ kho và kiểm soát giao dịch on-chain, và owner của AgentPolicy có thể chính là một Safe, vì owner là địa chỉ gọi `createPolicy`. Nhưng x402 trả tiền bằng chữ ký EIP-3009: facilitator gọi USDC, rồi USDC hỏi ví qua `isValidSignature` bằng `staticcall` chỉ đọc. Ở bước đó không ví nào ghi được state, nên không cộng dồn được hạn mức. AgentLeash trừ hạn mức trong `authorize()` từ trước, nên `isValidSignature` chỉ còn đọc kết quả.

**Câu hỏi nối tiếp:**

| Giám khảo hỏi | Trả lời ngắn |
|---|---|
| "Safe có Spending Limit (AllowanceModule) mà?" | Có hạn mức theo chu kỳ, nhưng không lọc người nhận. Module chuyển tiền bằng giao dịch on-chain (`execTransactionFromModule`), không cấp chữ ký ERC-1271 cho từng khoản x402. |
| "Zodiac Roles v2 có whitelist và phân tầng người nhận?" | Đúng, nhưng chỉ cho giao dịch on-chain. Chữ ký x402 không đi qua Roles: Fallback Handler mặc định của Safe chỉ chấp nhận chữ ký owner đủ ngưỡng hoặc message đã ghi on-chain. |
| "Safe7579 + SmartSessions cho session key ký ERC-1271?" | Đúng, nhưng chữ ký vẫn được kiểm trong `staticcall`, nên không có trần tích lũy. Agent lộ khóa có thể ký nhiều khoản nhỏ, mỗi khoản dưới trần một lượt. Cách này còn cần chữ ký lồng ERC-7739, nhiều client x402 chưa hỗ trợ. |
| "Safe v1.5.0 có Module Guard và ExtensibleFallbackHandler?" | v1.5.0 ra ngày 03/07/2025. Module Guard chỉ kiểm giao dịch on-chain đi qua module. Handler mới vẫn chạy trong `staticcall`. Kết luận không đổi. |
| "Vậy viết module Safe làm giống vậy được không?" | Về lý thuyết được: module tự trừ hạn mức rồi DELEGATECALL `SignMessageLib`. Nhưng phải tự viết, cấp quyền DELEGATECALL nhạy cảm và chưa có audit. AgentPolicy làm đúng việc đó, gọn hơn và có test. |
| "Mỗi khoản chi tốn một giao dịch `authorize`?" | Đánh đổi có chủ đích. Agent trả gas bằng ít AVAX, phí trên Avalanche thấp. Đổi lại, khoản nào cũng bị trừ hạn mức trước khi hợp lệ. |
| "Contract chưa audit, chỉ có 1 owner?" | forge 29/29, gồm invariant fuzz 128.000 lượt gọi và fork Fuji với Circle USDC thật. Owner có thể là multisig hoặc Safe nếu tạo policy từ ví đó. |
| "Fuji có Safe{Wallet} không?" | Hợp đồng Safe có trên Fuji, nhưng giao diện Safe{Wallet} và Transaction Service chỉ hỗ trợ C-Chain mainnet. Đây thêm một lý do để nhóm tự làm khung điều khiển. |

---

## Phụ lục — Nội dung form nộp bài

> Mỗi ô ≤ 800 ký tự. Ô *Live app* để trống vì không có bản online.

### 1. `What it does` (710 ký tự / ≤ 800)
> AgentLeash là ví chính sách chi tiêu non-custodial ("dây xích on-chain") kiêm cổng MCP cho AI agent trả tiền API qua HTTP x402 trên Avalanche Fuji. LLM (gemini-3.8-flash) chỉ đề xuất lệnh gọi công cụ và không bao giờ giữ khóa. RuleEngine off-chain kiểm tra danh mục, payTo, giá, tần suất gọi và vòng lặp; sau đó contract AgentPolicy của chủ ví duyệt từng khoản thanh toán qua ERC-1271 cho Circle USDC EIP-3009. Kể cả khi agent bị chiếm quyền, contract vẫn áp trần chi Trusted/Sandbox, whitelist người nhận và Kill Switch của chủ ví. Các agent lập trình như Claude Code hay Antigravity thử API x402 lạ qua 3 công cụ MCP, và chủ ví nâng API đó thành API quen chỉ bằng 1 cú bấm trên khung điều khiển Privy + viem.

### 2. `Anything else for the judges` (781 ký tự / ≤ 800)
> Khai báo mô phỏng (Luật 6): chu kỳ ngân sách rút còn 120 giây, API Thời tiết/Tỷ giá/Tin tức trả dữ liệu mock, cảnh agent bị chiếm mã là kịch bản giả lập (--bypass-rules). Bên A trong video là Claude Code thật gọi MCP. Thanh toán USDC qua ERC-1271 + EIP-3009 là thật trên Avalanche Fuji. Không có bản live app: mọi thứ chạy local (khung điều khiển :3000, facilitator :4022, API trả phí :4021/:4023/:4024). Kiểm chứng trên Snowtrace: Factory 0x369251fC256D8Ae3B25F66Fe1c4b3114A06BA864 (đã verify) và policy demo 0x62Ea5e422b3ef66174B6Dd6Aa855F1f036894177. Test: forge 29/29 (gồm invariant fuzz 128.000 lượt gọi và fork Fuji), agent vitest 49/49, web vitest 91/91. Cài MCP cho Claude Code và Antigravity bằng 1 lệnh: npm --prefix agent run setup:mcp. LLM không bao giờ giữ khóa riêng.
