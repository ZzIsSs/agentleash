# Quay video demo — AgentLeash (UniHack 2026)

Lập ngày 20/11/2026. Ghi chú để Nguyên và các phiên Claude sau làm tiếp phần video. Lịch tổng nằm ở [DEADLINE_BEN_A_B.md](DEADLINE_BEN_A_B.md), luật dễ bị trừ điểm ở [ghichu.md](ghichu.md).

## 1. Yêu cầu bắt buộc của BTC

Nguồn: `../doc/07-yeu-cau-nop-bai.md`, `../doc/03-the-le-dieu-kien.md` (tổng hợp từ team1vn.xyz).

- [ ] Dài **2–3 phút** (mục tiêu 2:30–2:50, không lố 3:00).
- [ ] Ô **Video** trên form là bắt buộc, link bắt đầu bằng `https://`.
- [ ] Ai có link cũng xem được khi chưa đăng nhập (YouTube **Unlisted** hoặc Drive công khai). Giám khảo không mở được link là **bị loại**.
- [ ] **Luật 6:** khai giả lập ngay đầu video (trong 15 giây đầu, kèm chữ trên màn hình từ giây 0):
  - chu kỳ hạn mức rút còn **120 giây** (`DEMO_PERIOD_SECONDS=120`) thay cho 1 ngày;
  - 3 API Thời tiết / Tỷ giá / Tin tức trả dữ liệu mock;
  - cảnh agent bị chiếm mã là kịch bản giả lập (`--bypass-rules`, ví nhận `0x1111…`); Bên A là Claude Code thật gọi MCP; x402, USDC và `AgentPolicy` chạy thật trên Fuji. *(Sửa 21/11: video không dùng `--mock-llm`.)*
- BTC không quy định ngôn ngữ và nền tảng video.

## 2. Nên có (ảnh hưởng điểm Presentation + UI/UX & Demo = 20đ)

- 3 cảnh đắt giá: (1) x402 thành công + mở tx trên **Snowtrace Fuji**; (2) `--bypass-rules` → contract vẫn chặn (`ExceedsPerTxCap` / `ExceedsSandboxPerTxCap`); (3) **Kill Switch** (`pause`).
- Nhắc ngắn Luật 8 (crypto không phải tiền pháp định ở VN, AgentLeash chỉ là guardrail kỹ thuật, non-custodial) và Luật 9 (why on-chain, why Avalanche, tiền từ đâu) nếu còn thời lượng.

## 3. Kịch bản (chốt 20/11: bản Nguyên + bổ sung cảnh từ [KICH_BAN_VIDEO_GIANG.md](KICH_BAN_VIDEO_GIANG.md), ước tính ~2:40)

Bố cục: VS Code (Claude Code = Bên A) bên trái ~40%, Chrome Dashboard `localhost:3000` bên phải ~60%. Thời lượng tính sau khi dựng (đã cắt khoảng chờ ký Privy / xác nhận tx).

| Thời gian | Cảnh | Màn hình phải hiện |
|---|---|---|
| 0:00–0:07 | **Hook:** "Nếu AI agent của bạn bị prompt injection và cố trả tiền cho một API lạ, chuyện gì xảy ra?" + cảnh revert (cắt từ take C). | Chữ khai Luật 6 ở góc màn hình từ giây 0 |
| 0:07–0:17 | Đọc câu khai Luật 6 (bản rút gọn của mục 1). | Chữ khai Luật 6 |
| 0:17–0:27 | **Take L (đăng nhập, thêm 21/11):** trang `/` đang "Chỉ xem" (nút Khóa khẩn cấp mờ) → bấm **Đăng nhập bằng email** → popup Privy nhập email → nhập OTP (cắt khoảng chờ mã) → header hiện email đã che + **Đăng xuất**, thanh bước "1 Đăng nhập" được tick. Lời gợi ý: chủ ví đăng nhập bằng email, Privy tạo ví nhúng, không cài extension hay giữ seed phrase; khóa chủ ví tách khỏi khóa agent. | Header đổi từ "Chỉ xem" sang email đã che |
| 0:27–0:37 | `/mcp`: rê chuột theo sơ đồ Bên A (Claude Code) → AgentLeash → seller x402. | Sơ đồ Bên A – Bên B |
| 0:37–0:57 | **Take A:** Bên A gọi `call_trusted_api` weather → thành công → `/flows` → mở tx trên Snowtrace. | `/flows` sơ đồ chuyển động 0,001 USDC; tx Snowtrace |
| 0:57–1:12 | **Take B (1):** Bên A gọi `test_unknown_api` với `news` (4024) → bị chặn → chuyển sang `/audit`, quay cận dòng bị từ chối. | `ExceedsSandboxPerTxCap` trong mục Bị từ chối |
| 1:12–1:27 | **Take B (2):** bấm **Chuyển thành API quen** trên `/audit` → popup Privy → ký `setWhitelist`. | Popup Privy, trạng thái ký xong |
| 1:27–1:35 | **Take B (3):** Bên A gọi lại `news` bằng `call_trusted_api` → thành công. | Dữ liệu `news` + link Snowtrace |
| 1:35–1:50 | **Take C:** terminal riêng chạy `npm --prefix agent run demo:bypass` (tắt hẳn rule engine) → contract vẫn chặn. | `ExceedsSandboxPerTxCap` trên terminal |
| 1:50–2:10 | **Take D:** bấm **KHÓA KHẨN CẤP** trên Header → xác nhận → ký Privy → Header "Đang khóa" → Bên A gọi tiếp → `PausedError`. | Header "Đang khóa"; lỗi `PausedError` |
| 2:10–2:40 | **Take E (rút từ 40 xuống 30 giây để bù take L):** trang `/` → Snowtrace Factory `0x3692…A864` đã verify → khung chữ tóm tắt 3 câu hỏi Luật 9 + Luật 8. | Factory verified; khung tóm tắt |

Ghi chú khi quay:

- **Take L:** trước khi bấm quay phải **Đăng xuất** (Privy giữ phiên đăng nhập). Popup Privy hiện email lúc gõ và ở màn "mã đã gửi tới …" → khi dựng làm mờ vùng email (ffmpeg `boxblur` theo khung hình). Xem OTP trên điện thoại, không mở Gmail trên màn hình đang quay. Quay lại take L thì Đăng xuất rồi lấy OTP mới.

- Bỏ cảnh `ExceedsDailyCap` (chốt 20/11) cho kịp thời lượng; Sandbox (take B) và bypass (take C) đã chứng minh contract chặn.
- Tx bị từ chối **không lên chuỗi** (revert ở bước ước tính gas) nên không có link Snowtrace; chỉ mở Snowtrace cho tx thành công, tx bị chặn thì xem lý do trên `/audit`.
- Không whitelist `0x1111…` của `demo:bypass` (địa chỉ "hacker"); API được chuyển thành API quen là `news`.
- Take A + B tiêu 0,002 USDC, nằm trong trần Trusted 0,003/chu kỳ. Quay lại take nào thì chờ ≥120 giây cho chu kỳ reset.
- Quay lại take B: gỡ `news` khỏi whitelist trước. Sau take D: bấm **Mở khóa** trước khi quay lại.
- Nếu vẫn lố 2:50: rút đoạn kết còn ~35s, để khung chữ gánh bớt ý.

## 4. Phân vai Claude / Nguyên

**Toàn bộ việc quay do Claude thực hiện** (chốt 20/11); Nguyên chỉ hỗ trợ các việc bên dưới.

**Claude làm:** bật dịch vụ, build web, seed; kiểm tra trước khi quay; quay màn hình bằng ffmpeg (đã có: ffmpeg 9.0.2 cài qua winget); chạy CLI ở cửa sổ terminal riêng cho lên hình; đóng vai **Bên A** gọi MCP ngay trong khung Claude Code của VS Code; viết lời thoại theo giây; dựng (cắt khoảng chờ, ghép, chữ Luật 6, phụ đề, ghép giọng).

**Nguyên làm:** đăng nhập Privy bằng OTP **ngay trên hình** (take L, email chủ ví `0x80a8…d58A`); duyệt các giao dịch cần ký (whitelist, Kill Switch); bấm nút trên Dashboard nếu muốn cảnh tự nhiên; duyệt bản dựng; upload YouTube Unlisted; mở link ở tab ẩn danh.

**Khuê và Giang làm (chốt 21/11):** **thu giọng đọc** theo [LOI_THOAI_VIDEO.md](LOI_THOAI_VIDEO.md) (máy chỉ có giọng TTS tiếng Anh, không có tiếng Việt). Giang đọc phần mở đầu và phần kết, Khuê đọc phần demo; hai người có thể đổi cho nhau.

## 5. MCP `agentleash` (Bên A = Claude Code)

- Đã cắm sẵn vào Claude Code, 3 tool: `get_policy_status` (chỉ đọc), `test_unknown_api`, `call_trusted_api`.
- Kiểm tra 20/11: `get_policy_status` OK. Policy `0x62Ea5e422b3ef66174B6Dd6Aa855F1f036894177`, `paused=false`, số dư **0,03 USDC**, Trusted 0,002/lần · 0,003/chu kỳ, Sandbox 0,0005/lần · 0,001/chu kỳ. Catalog: weather `4021`, rates `4023`.
- `test_unknown_api` và `call_trusted_api` **tiêu USDC thật** (0,001/lần) và ghi audit log → chỉ gọi lúc quay, sau khi reset log. 0,03 USDC ≈ 30 lượt; quay lại nhiều lần thì nạp thêm trước.

## 6. Cách quay (chốt 21/11, thay cách cũ)

- **Không để khung chat Claude/VS Code lên hình** (lộ hậu trường). VS Code luôn thu nhỏ khi ghi; chỉ các cửa sổ cố ý cho giám khảo xem mới nằm trên màn hình.
- **Bên A = phiên Claude Code mới, sạch** trong Windows Terminal (thư mục trống `~\ben-a`, `--strict-mcp-config` chỉ nạp MCP `agentleash`, `--setting-sources "project,local"`, `--disable-slash-commands`, `--allowedTools` 3 tool AgentLeash, `--model sonnet`). Màn hình chỉ có câu lệnh demo và kết quả MCP; banner chỉ hiện `Sonnet 5.5 · Claude Pro`, không lộ email.
- **Terminal sạch** (PowerShell mới, `Clear-Host`) cho `demo:bypass`.
- Bố cục chia đôi có chủ đích: Bên A/terminal bên trái 546 px, Chrome bên phải 820 px; cảnh chỉ có Dashboard thì khi dựng cắt riêng vùng Chrome (`crop=820:720:546:0`).
- Ghi bằng `ffmpeg -f gdigrab` vùng 1366×720 (bỏ taskbar), container `.mkv` để dừng bằng `taskkill /F` không hỏng file.
- **Explorer: Snowscan testnet đã chết** (`testnet.snowscan.xyz` không còn bản ghi DNS, kiểm 21/11 qua 1.1.1.1 và 8.8.8.8). Code và README đã đổi sang `https://testnet.snowtrace.io` (Factory vẫn hiện *Contract Source Code Verified (Exact Match)*). Nhãn chữ "Snowscan" trên giao diện chưa đổi.
- Trang `/mcp` không có sơ đồ Bên A → AgentLeash → seller; đoạn 0:27–0:37 khi dựng chèn `docs/slides/flows/3-mcp-ben-a-b.png`.

**Bản ghi thô** (ngoài repo, `../video_raw/`): `takeL_login.mkv` (dùng vùng Chrome, làm mờ email trong popup Privy), `takeA_trusted.mkv`, `takeB1_unknown.mkv`, `takeB2_whitelist.mkv`, `takeB3_trusted_news.mkv`, `takeC_bypass.mkv`, `takeD_killswitch.mkv` (gồm cả PausedError), `takeE_ending.mkv` + `takeE2_snowtrace_verified.mkv`. Bản `takeA_v1_snowscan_chet.mkv` bỏ.

## 7. Checklist trước khi quay

- [ ] Bật Facilitator `4022`, seller `4021`/`4023` (lệnh ở [README.md](../README.md) mục chạy local) và seller API lạ `news` `4024` (`npm --prefix sellers run start:news`) cho take B.
- [ ] `news` chưa nằm trong whitelist; xem popup Privy có lộ email không.
- [ ] Web bản production: `npm --prefix web run build && npm --prefix web run start` (không chạy `build` chồng lên `next dev`, sẽ lỗi 500).
- [ ] `node --env-file=.env scripts/seed-demo.mjs --reset-logs` để mục **Bị từ chối** trống.
- [ ] 5 trang `/`, `/flows`, `/policies`, `/audit`, `/mcp` trả 200, console sạch.
- [ ] Đủ USDC trong policy; Kill Switch đang tắt.
- [ ] Dashboard đang **đăng xuất** (header hiện "Chỉ xem") để quay take L.
- [ ] Không lộ `.env`, private key, email (header đã che email) trên màn hình; tắt thông báo hệ thống.

## 8. Các bước tiếp theo

1. [x] Claude: chuẩn bị môi trường (mục 7).
2. [x] Quay đủ cảnh (21/11, theo cách mới ở mục 6): L, M, A, B1, B2, B3, C, D, E, E2.
3. [x] Làm sạch từng take (21/11): `../video_raw/clean/` có 11 clip (L, M, A, B1, B2, B3, C, D1, D2, E, E2; tổng ~208 s). Đã cắt mọi đoạn VS Code (kiểm tự động: 0 khung còn sót), cắt đoạn đứng yên dài, tua ×3 đoạn Bên A "Processing…" (×2 đoạn chờ ký ở B2), làm mờ email ở take L (ô nhập, gợi ý của Chrome, dòng "Please check…"). L và D1 chỉ giữ vùng Chrome 820×720; mốc cắt nằm trong `../video_raw/tools/build_clean.mjs`, dựng lại bằng `node tools/build_clean.mjs` trong `video_raw/`.
4. [x] Bản ghép thử chưa có giọng (21/11): `../video_raw/draft_240/ban_nhap_2m40_chua_co_giong.mp4`, 2:39, 1920×1080. Cắt theo bảng ở mục 9; từng cảnh nằm trong `draft_240/segs/`; thẻ chữ (Luật 6, sơ đồ MCP, tóm tắt Luật 9 + 8, dải "MÔ PHỎNG" ở hook) là HTML trong `draft_240/cards/`, xuất PNG bằng Chrome headless. Dựng lại: `node tools/build_draft.mjs` trong `video_raw/`.
   - **Đã sửa (21/11):** câu khai Luật 6 cũ ghi "video dùng LLM giả lập (`--mock-llm`)" trong khi video thật dùng Claude Code thật làm Bên A và cảnh `demo:bypass` không gọi LLM. Đã đổi theo video thật ở `README.md`, `SLIDES.md` (dòng khai báo, speaker note, ô form), mục 1 file này và `ghichu.md`; Canva Nguyên đã tự đổi.
5. [x] Lời thoại 12 đoạn: [LOI_THOAI_VIDEO.md](LOI_THOAI_VIDEO.md) (21/11).
6. [ ] Khuê và Giang thu giọng → Claude chỉnh độ dài cảnh theo giọng → ghép tiếng → Nguyên duyệt bản cuối.

## 9. Quy trình dựng (chốt 21/11)

**Đầu ra:** MP4 1920×1080, 30 fps, H.264 (CRF 18–20) + AAC 192 kbps, `-movflags +faststart`, dài 2:30–2:50 (tuyệt đối dưới 3:00). Tất cả bản ghi thô ở `../video_raw/`.

**Khung hình chuẩn (dùng chung mọi cảnh):**
- *Cảnh chia đôi* (A, B1, B3, C, D2): bản ghi 1366×720 → `scale=1920:1012`, `pad=1920:1080:0:0`, dải tối 68 px phía dưới dành cho phụ đề.
- *Cảnh chỉ Chrome* (L, B2, D1): `crop=820:720:546:0` → `scale=1230:1080`, đặt giữa nền tối `#0B1220` (màu nền Dashboard), hai bên trống 345 px có thể ghi nhãn ("Chủ ví · Dashboard").
- *Clip đã ghi riêng vùng Chrome* (M, E, E2, 820×720): xử lý như cảnh chỉ Chrome, bỏ bước crop.

**Bảng ghép (khớp mục 3, ~2:40):**

| Thời gian | Nguồn | Cách xử lý |
|---|---|---|
| 0:00–0:07 | `AgentLeash_Hook_Logo_7s.mp4` (Nguyên gửi 21/11, dựng bằng AI, 1280×720 24 fps, có tiếng nền) | Hook; phóng lên 1080p, đổi 30 fps; dải "MÔ PHỎNG · cảnh mở đầu dựng bằng AI" có nền tối từ giây 0; khi ghép giọng thì hạ tiếng nền xuống dưới giọng đọc |
| 0:07–0:17 | Thẻ chữ Luật 6 | PNG khai báo giả lập (120 s, mock data, mock LLM; x402 + AgentPolicy thật trên Fuji) |
| 0:17–0:27 | `takeL_login` | Chỉ Chrome; **làm mờ email** trong popup Privy (ô nhập + dòng "Please check…"); cắt khoảng chờ OTP |
| 0:27–0:37 | `takeM_mcp_tools` + `docs/slides/flows/3-mcp-ben-a-b.png` | Sơ đồ 4–5 s rồi 3 thẻ tool |
| 0:37–0:57 | `takeA_trusted` | Chia đôi; tua nhanh đoạn "Processing…"; kết ở trang tx Snowtrace "Success" |
| 0:57–1:12 | `takeB1_unknown` | Chia đôi; giữ lâu dòng `ExceedsSandboxPerTxCap` |
| 1:12–1:27 | `takeB2_whitelist` + 4 s đầu `takeB3_trusted_news` | Chỉ Chrome; bỏ đoạn VS Code; kết ở "Đã thành API quen" |
| 1:27–1:35 | `takeB3_trusted_news` | Chia đôi; kết ở nhánh `news` trên `/flows` |
| 1:35–1:50 | `takeC_bypass` | Chia đôi; tua nhanh phần in trạng thái đầu phiên |
| 1:50–2:10 | `takeD_killswitch` | D1 chỉ Chrome (xác nhận → Privy → "Đã khóa"), bỏ đoạn VS Code; D2 chia đôi (`PausedError`) |
| 2:10–2:40 | `takeE_ending` + `takeE2_snowtrace_verified` + thẻ tóm tắt | Tổng quan "Đang hoạt động" → "Verified (Exact Match)" → thẻ Luật 9 (why on-chain / Avalanche / tiền từ đâu) + Luật 8 |

**Các bước:**

1. **[Claude] Viết lời thoại theo đoạn** ([LOI_THOAI_VIDEO.md](LOI_THOAI_VIDEO.md)), khớp bảng ghép, đánh số `seg01…seg12`, kèm số giây mục tiêu cho mỗi đoạn.
2. **[Khuê, Giang] Thu giọng** từng đoạn thành file riêng (`seg01_giang.m4a`…), phòng yên tĩnh, để 1 giây lặng đầu và cuối; đọc lại đoạn nào vấp.
3. **[Claude] Chọn điểm cắt** cho từng cảnh: xem lại bản ghi (ảnh ghép khung hình), ghi `in/out` theo giây; độ dài cảnh lấy theo độ dài giọng đọc thật của đoạn đó.
4. **[Claude] Làm thẻ chữ** (Luật 6, tiêu đề MCP, tóm tắt Luật 9 + 8, phụ đề nếu cần) bằng HTML → PNG qua Chrome headless (cùng cách `docs/slides/flows/render.sh`), font có dấu tiếng Việt.
5. **[Claude] Cắt và chuẩn hóa từng đoạn** bằng ffmpeg: `-ss/-to`, crop/scale/pad theo khung chuẩn, `boxblur` vùng email ở take L (kèm `enable='between(t,a,b)'`), `setpts` để tua nhanh đoạn chờ, `-r 30`, xuất `segNN.mp4`.
6. **[Claude] Chồng chữ**: thẻ Luật 6 từ giây 0 đến hết 0:17; nhãn cảnh ngắn ("Bên A · Claude Code", "Chủ ví · Dashboard"); thẻ tóm tắt cuối.
7. **[Claude] Ghép hình** bằng concat demuxer theo thứ tự bảng ghép.
8. **[Claude] Ghép tiếng**: nối giọng theo đúng mốc từng đoạn (`adelay`/`concat`), chuẩn hóa âm lượng (`loudnorm` ~ −16 LUFS); nhạc nền nếu có thì để rất nhỏ.
9. **[Claude] Xuất bản nháp** và tự kiểm: tổng thời lượng, Luật 6 trong 15 giây đầu, chữ đọc được ở 1080p, không lộ email/khóa/`.env`/đường dẫn hậu trường, tiếng không lệch hình.
10. **[Nguyên] Duyệt bản nháp**, ghi các mốc cần sửa (giây + nội dung) → Claude sửa → xuất bản cuối.
11. **[Nguyên] Upload YouTube Unlisted** (mô tả: repo, địa chỉ Factory/Policy trên Snowtrace), mở link ở tab ẩn danh, dán link `https://` vào ô Video trên form.
