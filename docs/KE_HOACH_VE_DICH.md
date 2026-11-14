# Kế hoạch về đích AgentLeash (13/11 → 21/11/2026)

Lập ngày 13/11/2026 cho Nguyên. File này gom **mọi việc còn lại** đến lúc nộp bài: code, slide, video, form và quyền truy cập cho giám khảo. Chi tiết kỹ thuật từng giai đoạn vẫn nằm ở [ROADMAP.md](ROADMAP.md) và [PHASE2_PLAN.md](PHASE2_PLAN.md); file này chỉ nói **ngày nào làm gì và thế nào là xong**.

- Hạn nộp: **23:59 T7 21/11/2026** trên team1vn.xyz. Mục tiêu nộp **trước 12:00 ngày 21/11**.
- Quỹ giờ: 6–8 giờ/ngày, khoảng 55–65 giờ tính đến hạn nộp.
- Người làm: Nguyên.

## Hiện trạng (sáng 13/11)

| Hạng mục | Trạng thái |
|---|---|
| GĐ 0, GĐ 1 | ✅ Contract verified trên Fuji, 29 test Foundry pass, có CI |
| GĐ 2 | 🟡 Code xong, 16/16 test vitest pass, demo `--bypass-rules` pass. **Chưa commit** (đang nằm ở working tree của nhánh `docs-huong-dan-figma`). Kiểm chứng 3 còn kẹt 2 blocker bên dưới |
| GĐ 3 web | ⬜ Mới có khung Next.js; `src/lib/wagmi.ts` còn sót, trong khi đã chốt bỏ wagmi |
| PR #2 (tài liệu Figma) | 🟡 Đang OPEN |
| Quyền repo cho giám khảo | 🔴 Repo private, **chưa mời `tuantqse90`**. Giám khảo không mở được thì đội bị loại |
| Slide, video, form nộp | ⬜ Chưa bắt đầu |

**Blocker GĐ 2:**

1. ✅ *Đã gỡ 13/11: deploy policy demo 120s `0x2acc0af39b9892529c052d7192ac03664f079671`.* **Chu kỳ 30 giây ngắn hơn tốc độ Fuji.** 4 giao dịch x402 chạy liền mất khoảng 40 giây, nên lần 4 rơi sang chu kỳ mới và không bị revert `ExceedsDailyCap`.
2. ✅ *Đã gỡ 13/11: key mới trong project riêng + `npm run demo:mock`.* **Hết quota Gemini.** `GEMINI_API_KEY` free tier báo 429 (20 lượt/ngày).

## Quyết định cần Nguyên chốt

| # | Câu hỏi | Đề xuất | Vì sao |
|---|---|---|---|
| 1 | Gỡ blocker 1 bằng cách nào | Deploy policy demo mới qua factory với `period = 120s`, đổi câu khai đầu video và SPEC thành "chu kỳ 120 giây" | Contract đã nhận chu kỳ ở constructor nên không phải sửa code. Gửi `authorize` song song thì phải sửa nonce queue, tốn giờ và dễ lỗi |
| 2 | Key Gemini | Đã tạo key mới trong project AI Studio riêng `AgentLeash` (13/11). Tập demo bằng `npm run demo:mock` (LLM giả lập, không cần key, x402 + contract vẫn thật); chỉ lần quay thật mới dùng Gemini | Demo không được chết vì quota giữa lúc quay video. Nếu dùng mock trong video thì phải khai rõ (luật 6) |
| 3 | Bố cục dashboard | **Bản A: 1 trang** ([FIGMA_UI_2_BAN_SO_SANH.md](FIGMA_UI_2_BAN_SO_SANH.md)) | Video 2–3 phút cần mọi thứ trên một màn hình, không phải chuyển tab |

## Lịch theo ngày

| Ngày | Việc (giờ ước) | Xong khi |
|---|---|---|
| **T6 13/11** | 1. Dọn git: merge PR #2, tạo nhánh `gd2-agent-sellers`, commit phần GĐ 2, mở PR (0.5h)<br>2. Gỡ blocker 1 theo quyết định 1: deploy policy demo `period=120s`, whitelist 2 seller, `setCaps(2000, 3000, 500, 1000)`, nạp USDC; cập nhật `DEMO_PERIOD_SECONDS`, SPEC, README (1.5h)<br>3. Gỡ blocker 2 theo quyết định 2 (0.5h)<br>4. Chạy Kiểm chứng 3, tick ROADMAP, ghi session log (1h)<br>5. **Mời `tuantqse90` làm collaborator** (5 phút) | `agent/logs/audit.json` có 3 lần 200 OK và lần 4 revert `ExceedsDailyCap`; lời mời đã gửi |
| **T7 14/11** | GĐ 3a (7–8h): gỡ wagmi, chép `providers.tsx` từ starter kit `privy-agent-wallet`, đăng nhập email bằng Privy, đọc contract bằng viem. Màn Tổng quan: đồng hồ hạn mức Trusted/Sandbox, số dư USDC, trạng thái agent. Dark Mode, Bản A | Đăng nhập được, đồng hồ hiện số khớp on-chain |
| **CN 15/11** | GĐ 3b (7–8h): Dòng tiền (danh sách event `Authorized` kèm link Snowscan), Kill switch gọi `pause()`, màn Bị từ chối (gộp revert on-chain và `audit.json` qua một API route nhỏ), 3 trạng thái giao dịch (đang ký, đang chờ, xong) | Bấm pause trên web xong, agent chạy tiếp thì bị chặn |
| **T2 16/11** | GĐ 3c (7–8h): Luật chi tiêu (`setCaps`, `setWhitelist`), cập nhật realtime (`watchContractEvent` hoặc hỏi định kỳ 3 giây), chạy agent từ CLI song song với dashboard. **Chạy trọn 7 bước demo trong [SPEC.md](SPEC.md)** | 7 bước chạy liền một mạch, không phải sửa tay |
| **T3 17/11** | Dư giờ hoặc phương án B của GĐ 3 (4h). Bắt đầu slide (3h): dàn ý 10–12 trang, đủ 3 câu bắt buộc và phần luật Việt Nam. **20:00 Workshop 3** (đăng ký Luma trước) | Demo ổn định; có slide nháp |
| **T4 18/11** | GĐ 4 (6–8h), làm theo thứ tự, hết giờ thì dừng: nút tạo agent qua factory → công tắc "bỏ qua rule engine" trên UI → danh tính ERC-8004 (registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`) | Mỗi mục làm xong có PR riêng, hoặc ghi rõ "đã bỏ" ở ROADMAP |
| **T5 19/11** | GĐ 5a (6–7h): README (sơ đồ kiến trúc, địa chỉ contract, chạy bằng 3 lệnh), `scripts/seed-demo`, deploy web lên Vercel (đọc dữ liệu on-chain thật), hoàn thiện slide. **20:00 Office Hours 1**: mang demo tới hỏi mentor | Mở link Vercel bằng tab ẩn danh thấy dữ liệu thật |
| **T6 20/11** | Tập kịch bản, quay và dựng video 2–3 phút, câu khai chu kỳ giả lập và dữ liệu mock ở **giây đầu** (luật 6), up YouTube unlisted (5–6h). Soạn nháp form nộp (1h). **20:00 Office Hours 2**: xin góp ý video và slide | Video, slide, form nháp đều đã lưu |
| **T7 21/11** | Sáng: chạy checklist bên dưới, mở mọi link ở tab ẩn danh, bấm **Submit** trước 12:00. Chiều: dự phòng | Trang Profile hiện trạng thái đã nộp |
| 23–30/11 | Nếu vào Top 10 (công bố 23/11): đăng ký Final Demo Day trên Luma, tập pitch trực tiếp, chuẩn bị câu hỏi giám khảo, nhất là "khác gì Safe allowance module" (SPEC mục "Chưa chốt" 4). Demo Day 09:00 T2 30/11 | — |

**Mốc chặn:** nếu tối 16/11 chưa chạy trọn 7 bước demo, ngày 17/11 chỉ làm demo và bỏ hẳn GĐ 4.

### Trễ thì cắt theo thứ tự

1. ERC-8004
2. Sơ đồ dòng tiền (giữ danh sách khoản chi)
3. Nút tạo agent trên giao diện (deploy bằng script)
4. Realtime (thay bằng nút làm mới)

**Không bao giờ cắt:** test các đường tiền, kill switch, contract verified, khoảnh khắc "bị từ chối" trong demo, quyền xem repo cho giám khảo.

## Checklist nộp bài

Rút từ [doc/07](../../doc/07-yeu-cau-nop-bai.md) và [doc/06](../../doc/06-tieu-chi-cham-diem.md) (thư mục `doc/` nằm ngoài repo). Cột "Ngày" cho biết việc được làm trong lịch ở trên.

| Mục | Ngày |
|---|---|
| `tuantqse90` đã **chấp nhận** lời mời collaborator (hoặc repo để public) | Mời 13/11, kiểm lại 19/11 |
| README nêu cách chạy, kiến trúc, địa chỉ contract và mạng | 19/11 |
| Test cho các đường tiền (Foundry đã có) | ✅ |
| Link Snowscan cho trường "Contract address" | ✅ (factory `0x369251fC…A864`) |
| Slide Google Slides hoặc Canva, "Anyone with the link can view" | 17/11 → 19/11 |
| Slide trả lời đủ 3 câu: vì sao on-chain, vì sao Avalanche, tiền từ đâu | 17/11 |
| Slide nêu giới hạn luật Việt Nam: crypto không phải tiền pháp định, không nhận tiền thật từ người dùng, non-custodial | 17/11 |
| Slide nhấn Avalanche Integration (25 điểm): ERC-1271 + EIP-3009 trên USDC Fuji, x402, facilitator tự host, ERC-8004 nếu kịp | 19/11 |
| Khai dữ liệu mock và chu kỳ giả lập ngay đầu pitch và video | 20/11 |
| Video 2–3 phút, xem được khi chưa đăng nhập | 20/11 |
| Live app (không bắt buộc): link Vercel kèm tài khoản test | 19/11 |
| "What it does" ≤ 800 ký tự: vấn đề, cho ai, cái gì chạy được hôm nay | 20/11 |
| "Anything else" ≤ 800 ký tự: cách chạy agent local, rule engine + policy contract + LLM không giữ khóa | 20/11 |
| Mở mọi link bằng tab ẩn danh rồi mới bấm **Submit** | 21/11 |

## Theo dõi

Tick ở đây khi xong mốc của từng ngày.

- [x] 13/11: GĐ 2 nghiệm thu (3 lần mua + lần 4 bị chặn `ExceedsDailyCap`, policy `0x2acc…9671`)
- [ ] 13/11: mời `tuantqse90`; commit + PR GĐ 2; merge PR #2
- [ ] 14/11: đăng nhập Privy + màn Tổng quan
- [ ] 15/11: dòng tiền, kill switch, màn bị từ chối
- [ ] 16/11: chạy trọn 7 bước demo
- [ ] 17/11: slide nháp, dự Workshop 3
- [ ] 18/11: GĐ 4 xong hoặc đã ghi "bỏ"
- [ ] 19/11: README, web deploy, slide xong, Office Hours 1
- [ ] 20/11: video, form nháp, Office Hours 2
- [ ] 21/11 trước 12:00: đã Submit
