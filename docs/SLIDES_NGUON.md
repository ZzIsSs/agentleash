# Nguồn thông tin trên slide và việc cần kiểm trước khi chỉnh

> Tổng hợp ngày 20/11/2026 cho bộ Canva 20 trang (https://canva.link/jaccx7sy0wk2lam). Nội dung chữ từng trang nằm ở [SLIDES.md](SLIDES.md). File này trả lời câu hỏi "con số hay câu này lấy từ đâu, đã kiểm chưa", để khi sửa slide biết chỗ nào sửa thoải mái, chỗ nào phải đối chiếu lại nguồn.
>
> Quy ước trạng thái:
> - **Đã kiểm:** đọc trực tiếp từ code, từ chuỗi Fuji hoặc từ GitHub trong phiên 20/11.
> - **Theo tài liệu:** chép từ README, SPEC hoặc nhật ký phiên, chưa chạy lại để xác nhận.
> - **Lập luận:** nhận định hoặc kế hoạch, không có số đo đi kèm. Giám khảo hỏi thì trả lời bằng lý lẽ, không bằng dữ liệu.

---

## 1. Nguồn theo loại thông tin

| Thông tin trên slide | Nguồn | Trạng thái |
|---|---|---|
| Hạn mức Trusted 0.002 / 0.003 USDC, Sandbox 0.0005 / 0.001 USDC, chu kỳ 120 giây, chưa khóa, số dư 0.03 USDC | Đọc từ policy demo `0x62Ea5e422b3ef66174B6Dd6Aa855F1f036894177` trên Fuji bằng `cast call` (lệnh ở mục 4) | Đã kiểm |
| Thứ tự kiểm tra trong `authorize()`: chưa khóa → whitelist → Trusted (`perTxCap`, `dailyCap`) hoặc Sandbox (`sandboxPerTxCap`, `sandboxDailyCap`, rồi `dailyCap` chung) | [AgentPolicy.sol:199-240](../contracts/src/AgentPolicy.sol#L199-L240) | Đã kiểm |
| Tên lỗi `ExceedsPerTxCap`, `ExceedsDailyCap`, `ExceedsSandboxPerTxCap`, `ExceedsSandboxDailyCap`, `PausedError` | [AgentPolicy.sol:79-95](../contracts/src/AgentPolicy.sol#L79-L95) | Đã kiểm |
| `isValidSignature` trả `0x1626ba7e` chỉ khi chưa khóa và digest còn hạn; Kill Switch vô hiệu cả khoản đã duyệt chưa settle | [AgentPolicy.sol:288-294](../contracts/src/AgentPolicy.sol#L288-L294) | Đã kiểm |
| RuleEngine tối đa 5 lần/phút, chống mua trùng 60 giây, chặn vòng lặp | [rules.ts:107-111](../agent/src/rules.ts#L107-L111) | Đã kiểm |
| Mã chặn `UNREGISTERED_API`, `INVALID_PAY_TO`, `PRICE_MISMATCH`, `RATE_LIMIT_EXCEEDED`, `LOOP_DETECTED` | [rules.ts:179-277](../agent/src/rules.ts#L179-L277) | Đã kiểm |
| 3 tool MCP `test_unknown_api`, `call_trusted_api`, `get_policy_status` | [README.md:106-114](../README.md#L106-L114), [mcp.ts](../agent/src/mcp.ts) | Đã kiểm |
| Lọc URL (`UNSAFE_URL`: chỉ http/https, chặn metadata cloud) | [mcp.ts:139-167](../agent/src/mcp.ts#L139-L167) | Đã kiểm |
| Gợi ý trả về kèm link khung điều khiển khi bị chặn | [mcp.ts:215-230](../agent/src/mcp.ts#L215-L230) | Đã kiểm |
| MCP chỉ giữ khóa agent, không giữ khóa owner | [README.md:131](../README.md#L131) | Theo tài liệu |
| LLM là `gemini-3.8-flash` | [llm.ts:3](../agent/src/llm.ts#L3) | Đã kiểm |
| API Tin tức cổng 4024, giá 0.001 USDC | [news.mjs](../sellers/news.mjs) | Đã kiểm |
| Cổng 4021 Thời tiết, 4023 Tỷ giá, 4022 facilitator, 3000 khung điều khiển | [README.md:72-90](../README.md#L72-L90), [.env.example](../.env.example) | Theo tài liệu |
| Tên 5 trang khung điều khiển | [ConsoleShell.tsx:31-35](../web/src/components/ConsoleShell.tsx#L31-L35) | Đã kiểm |
| Địa chỉ Factory (đã verify), policy demo, USDC `FiatTokenV2_2`, ERC-8004 registry | [README.md:59-70](../README.md#L59-L70) | Theo tài liệu (policy demo đã đọc được trên chuỗi) |
| Facilitator tự host 4022, PayAI dự phòng, không dùng Ultravioleta | [SPEC.md:200-207](SPEC.md#L200) | Theo tài liệu |
| Câu khai báo mô phỏng (Luật 6) | [README.md:7](../README.md#L7) | Theo tài liệu |
| `forge test` 29/29, agent vitest 49/49, web vitest 91/91, `next build` sạch | [Nhật ký 20/11](sessions/2026-11-20-0051-nguyen.md) | Theo tài liệu, chưa chạy lại |
| Invariant fuzz 128.000 lượt gọi (256 runs), fork Fuji với Circle USDC thật | [Nhật ký 13/11:32](sessions/2026-11-13-0740-nguyen.md#L32), [README.md:148](../README.md#L148) | Theo tài liệu, chưa chạy lại |
| Che email ở header khi trình chiếu | [Nhật ký 20/11](sessions/2026-11-20-0051-nguyen.md) | Theo tài liệu |
| Không có bản online, demo chạy local, ô Live app để trống | [CLAUDE.md](../CLAUDE.md) | Theo tài liệu |
| Repo `ZzIsSs/agentleash` đang công khai | `gh repo view` ngày 20/11 | Đã kiểm |
| Mô hình Bên A – Bên B | [CLAUDE.md](../CLAUDE.md), [README.md:11-36](../README.md#L11-L36) | Theo tài liệu |
| Luật 2, 3, 4, 5, 6, 8 và ba câu trả lời Luật 9 | [SPEC.md:209-219](SPEC.md#L209) | Theo tài liệu |
| So sánh với Safe `AllowanceModule` | [SPEC.md:205-207](SPEC.md#L205) | Theo tài liệu (ghi là đã kiểm trước đó, phiên này chưa đọc lại mã Safe) |
| Lộ trình sau 21/11 (Remote MCP, POST/body, SSRF, sổ URL ↔ payTo, ERC-8004) | [SPEC.md:223-246](SPEC.md#L223) | Lập luận (kế hoạch) |
| Ba điểm gãy (prompt injection, vòng lặp, không có nút ngắt) | SLIDES.md bản 17/11, [README.md:13](../README.md#L13) | Lập luận |
| Mô hình kinh doanh (SaaS theo đội, phí hạ tầng, khách hàng đầu tiên) | [SPEC.md:219](SPEC.md#L219), SLIDES.md bản 17/11 | Lập luận (kế hoạch) |
| "Phí gas thấp, finality nhanh", "x402 cũng chạy trên EVM khác" | [SPEC.md:218](SPEC.md#L218) | Lập luận, không có số đo |

---

## 2. Nguồn theo từng trang

| Trang | Nội dung chính | Nguồn |
|---|---|---|
| 1 Bìa | Tagline, câu khai báo mô phỏng | README dòng 7 |
| 2 Mục lục | Danh sách mục | Tự lập theo thứ tự trang. Mục lục chưa tách riêng 3 trang sơ đồ (6–8), vẫn gộp trong "03 Kiến trúc" |
| 3 Vấn đề | x402, 0.001 USDC mỗi lượt, ba điểm gãy | README, SLIDES.md bản 17/11 |
| 4 Giải pháp | RuleEngine 5 lần/phút, 60 giây; AgentPolicy hai tầng; Kill Switch | `rules.ts`, `AgentPolicy.sol` |
| 5 Kiến trúc | Luồng thanh toán, ERC-1271, Privy + Factory, `release(nonce)` | `AgentPolicy.sol`, SPEC "Luồng một khoản chi" |
| 6 Thanh toán x402 (sơ đồ) | 10 bước, 6 thành phần | `AgentPolicy.sol` (`authorize`, `isValidSignature`), SPEC "Luồng một khoản chi". Ảnh dựng từ [flows/1-thanh-toan-x402.html](slides/flows/1-thanh-toan-x402.html) |
| 7 Hai tầng chặn (sơ đồ) | Thứ tự kiểm tra, mã lỗi, hạn mức | `AgentPolicy.sol:199-240`, `rules.ts`, hạn mức đọc trên Fuji. Ảnh dựng từ [flows/2-hai-tang-chan.html](slides/flows/2-hai-tang-chan.html) |
| 8 MCP Bên A – Bên B (sơ đồ) | Thử API lạ, bị chặn, chủ ví duyệt, gọi lại | `mcp.ts`, README mục MCP, `news.mjs`. Ảnh dựng từ [flows/3-mcp-ben-a-b.html](slides/flows/3-mcp-ben-a-b.html) |
| 9 Vì sao on-chain? | Chỉ owner sửa luật, thiệt hại có trần, kiểm toán công khai | SPEC Luật 9; số 128.000 từ nhật ký 13/11 |
| 10 So với Safe | AllowanceModule không có whitelist người nhận, không gắn ERC-1271 theo từng khoản | SPEC mục "Chưa chốt" ý 4 |
| 11 Vì sao Avalanche? | USDC ERC-1271 + EIP-3009, facilitator, phí thấp, nói thật về EVM khác | SPEC Luật 9, README bảng địa chỉ |
| 12 Chạy thật | Số test, địa chỉ Factory, policy demo | Nhật ký 20/11 và 13/11, README |
| 13 Demo | Lần thứ 4 `ExceedsDailyCap`, bypass `ExceedsSandboxPerTxCap`, `PausedError` | SPEC "Kịch bản demo", SLIDES.md bản 17/11 |
| 14 MCP | 3 tool, 1-click Chuyển thành API quen | README mục MCP, `mcp.ts` |
| 15 Tiền từ đâu? | SaaS, phí hạ tầng, khách hàng đầu tiên | SPEC Luật 9, SLIDES.md bản 17/11 |
| 16 Tuân thủ | Luật 2, 3, 5, 7, 8 | SPEC mục Luật |
| 17 Lộ trình | Remote MCP, an toàn hơn, ERC-8004 | SPEC mục Định hướng, CLAUDE.md |
| 18 OUR TEAM | Nguyên tự làm | — |
| 19 Thử ngay | Link repo, Factory, demo local | README, `gh repo view` |
| 20 Thank you | — | — |

---

## 3. Việc cần kiểm hoặc chỉnh trước khi nộp

- [ ] **Chạy lại test** để chắc con số 29/29, 49/49, 91/91 và 128.000 trên trang 12 còn đúng (lệnh ở mục 4). Có thay đổi thì sửa trang 12, trang 9, phụ lục form nộp trong SLIDES.md.
- [ ] **Chạy thử 3 khoảnh khắc demo** (trang 13) và luồng API Tin tức (trang 8). Phiên 20/11 mới đối chiếu logic chứ chưa chạy:
  - 3 lần × 0.001 USDC = 0.003 USDC, đúng bằng `dailyCap`, nên lần thứ 4 phải ra `ExceedsDailyCap`.
  - Bypass trả 0.001 USDC cho địa chỉ lạ, lớn hơn `sandboxPerTxCap` 0.0005, nên phải ra `ExceedsSandboxPerTxCap`.
  - API Tin tức 0.001 USDC cũng lớn hơn 0.0005, nên bị chặn lần đầu.
- [ ] **Hạn mức và số dư** đọc ngày 20/11. Nếu đổi `setCaps` hoặc nạp thêm USDC trước khi quay video, sửa trang 7 (ảnh sơ đồ), trang 4 và trang 13 cho khớp.
- [ ] **So sánh với Safe** (trang 10): nếu muốn chắc khi bị hỏi sâu, đọc lại `AllowanceModule.sol` của `safe-global/safe-modules`.
- [ ] **Các câu lập luận** (phí gas thấp, mô hình kinh doanh, lộ trình): giữ cách nói "dự kiến", "hướng tới", tránh câu khiến giám khảo hiểu là đã có số liệu hoặc doanh thu.
- [ ] **Mục lục (trang 2):** cân nhắc thêm dòng cho 3 trang sơ đồ nếu muốn khớp đúng từng trang.
- [ ] **Trang 18 OUR TEAM:** chưa làm, đang còn ảnh người mẫu.
- [ ] **Link Canva:** bật "Anyone with the link → Can view", dán link chỉ xem vào form, mở thử bằng tab ẩn danh.

---

## 4. Lệnh kiểm lại

Đọc hạn mức và số dư policy demo trên Fuji:

```bash
R=https://api.avax-test.network/ext/bc/C/rpc
P=0x62Ea5e422b3ef66174B6Dd6Aa855F1f036894177
for f in "perTxCap()(uint256)" "dailyCap()(uint256)" "sandboxPerTxCap()(uint256)" "sandboxDailyCap()(uint256)" "period()(uint256)" "paused()(bool)"; do
  echo -n "$f = "; cast call $P "$f" --rpc-url $R
done
cast call 0x5425890298aed601595a70AB815c96711a31Bc65 "balanceOf(address)(uint256)" $P --rpc-url $R
```

Kết quả ngày 20/11: `2000`, `3000`, `500`, `1000`, `120`, `false`, số dư `30000` (USDC có 6 chữ số thập phân, nên 2000 = 0.002 USDC).

Chạy lại test (theo [README.md:145-157](../README.md#L145-L157)):

```bash
cd contracts && forge test -vvv
cd web && npm test && npx tsc --noEmit && npm run lint
cd agent && npm test && npm run typecheck
```

---

## 5. Cách sửa slide

- **Chữ trên trang thường:** sửa thẳng trên Canva rồi cập nhật [SLIDES.md](SLIDES.md) cho khớp. Font Gentium Plus, ô nội dung cỡ 24.
- **Trang sơ đồ 6–8:** ảnh PNG dựng từ HTML, không sửa chữ được trên Canva.
  1. Sửa file `.html` trong [slides/flows/](slides/flows/).
  2. Chạy `bash docs/slides/flows/render.sh` để xuất lại PNG.
  3. Tải PNG lên Canva, chọn ảnh cũ trên trang, bấm **Replace** rồi chọn ảnh mới. Replace giữ đúng khung; chèn ảnh mới từ Uploads thì Canva có thể tự cắt mất một phần.
