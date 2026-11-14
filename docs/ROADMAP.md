# Lộ trình code AgentLeash

Kế hoạch chia giai đoạn cho phần kỹ thuật (Nguyên). Đặc tả đầy đủ ở [SPEC.md](SPEC.md); file này chỉ nói **làm gì, theo thứ tự nào, khi nào coi là xong**.

> **Từ 13/11:** lịch theo ngày đến lúc nộp (gồm cả slide, video, form, quyền repo cho giám khảo) nằm ở [KE_HOACH_VE_DICH.md](KE_HOACH_VE_DICH.md). Ngày ở các GĐ bên dưới đã được dời theo file đó.

- Lập ngày 09/11/2026. Hạn nộp 23:59 ngày 21/11/2026, mục tiêu nộp **trước trưa 21/11**.
- Quỹ giờ code ước 65–85 giờ.
- Mỗi giai đoạn có mốc **"Xong khi"** kiểm được bằng lệnh hoặc bằng mắt. Chưa đạt mốc thì chưa sang giai đoạn sau, trừ khi ghi rõ phương án B.

## Tổng quan

| GĐ | Ngày | Việc chính | Giờ ước | Mốc |
|---|---|---|---|---|
| 0 | 09–10/11 | Chạy thử trọn vòng x402 với contract làm người trả (ERC-1271) | 8–10 | **Cổng quyết định** facilitator, tối 10/11 |
| 1 | 11–13/11 | `AgentPolicy` hoàn chỉnh, factory, test, deploy và verify Fuji, CI | 14–18 | CI xanh, contract verified |
| 2 | 13–15/11 | Agent (LLM, rule engine, x402 client) và 2 API bán | 14–18 | Agent tự mua 3 lần, lần 4 bị chặn |
| 3 | 15–18/11 | Dashboard: Privy, hạn mức, dòng tiền, kill switch, màn bị từ chối | 18–22 | Chạy trọn kịch bản demo |
| 4 | 18–19/11 | Nên có và bonus, theo giờ còn lại | 4–8 | — |
| 5 | 19–21/11 | README, dữ liệu mẫu, deploy web, video, nộp | 6–8 | Nộp trước trưa 21/11 |

Tổng: 64–84 giờ.

## Ba điểm kỹ thuật rút ra khi đọc starter kit

1. **Cắm policy contract vào x402 mà không viết lại thư viện.** `ExactEvmScheme(signer)` (xem `x402-pay-per-request/src/pay.mjs`) chỉ cần một signer có `address` và `signTypedData`. Ta viết signer riêng:
   - `address` = địa chỉ `AgentPolicy`, nên `from` của khoản chi là contract.
   - `signTypedData(msg)` không ký gì cả. Nó gọi `authorize(to, value, validAfter, validBefore, nonce)` trên contract bằng ví agent, lấy đúng các trường trong `msg`, chờ giao dịch xong rồi trả chữ ký rỗng (`0x`).
   - Nonce do thư viện x402 tự sinh, ta không phải quản lý.
2. **Khung `authorize` trong SPEC thiếu `validAfter`.** Digest `TransferWithAuthorization` của EIP-3009 có cả `validAfter`, và x402 thường đặt giá trị khác 0. Contract phải nhận thêm tham số này, nếu không digest contract tự tính sẽ lệch với digest USDC kiểm tra.
3. **Facilitator tự host có khả năng nhận ERC-1271 sẵn.** `src/facilitator.mjs` dùng `verifyTypedData` của viem, hàm này gọi `isValidSignature` khi địa chỉ ký là contract. Nhưng `@x402/evm` có thể kiểm tra thêm (độ dài chữ ký, mã contract) trước đó, nên phải chạy thật mới biết.

## GĐ 0: Chạy thử trọn vòng (09–10/11)

**Mục tiêu:** chứng minh được một khoản x402 mà người trả là contract. Đây là giả định lớn nhất của cả dự án; sai thì phải đổi thiết kế sớm.

| Việc | File | Giờ |
|---|---|---|
| Chạy starter kit x402 nguyên bản trên Fuji: `npm run new-wallet`, lấy USDC ở faucet Circle, chạy `server` và `pay`, sau đó chạy `facilitator` tự host | (ngoài repo) | 2 |
| Contract tối giản: giữ USDC, `approve(digest)` do chủ gọi, `isValidSignature` chỉ nhận digest đã duyệt | `contracts/src/SpikePolicy.sol` | 1–2 |
| Script deploy lên Fuji, nạp 0.01 USDC vào contract | `contracts/script/DeploySpike.s.sol` | 1 |
| Signer tùy biến (điểm kỹ thuật 1), bản spike gọi `approve` thay cho `authorize` | `agent/src/policySigner.ts` | 2–3 |
| Thử lần lượt: facilitator tự host → PayAI → Ultraviolet. Ghi lại cái nào nhận, cái nào từ chối và lỗi gì | `docs/SPIKE.md` | 1–2 |

**Xong khi:** API bán trả 200, và Snowtrace hiện giao dịch `transferWithAuthorization` có `from` là địa chỉ contract.

**Tối 10/11 quyết facilitator**, rồi ghi vào SPEC mục "Chưa chốt" 1:

- Có facilitator nhận → dùng nó. Ưu tiên facilitator tự host khi demo để không phụ thuộc mạng ngoài.
- Không cái nào nhận → sửa facilitator tự host bỏ bước kiểm tra chặn, hoặc dùng x402-rs.
- Vẫn không được đến hết 11/11 → phương án cuối: contract tự chuyển USDC qua hàm `pay`, agent gửi mã giao dịch cho API. Đúng luật 4 nhưng lệch chuẩn x402.

## GĐ 1: Policy contract (11–13/11)

**Quyết định đã chốt:**
- **Chính sách chi tiêu phân tầng:** Trusted (whitelist) dùng `perTxCap` và `dailyCap`; ngoài whitelist dùng ngưỡng Sandbox thấp hơn (`sandboxPerTxCap`, `sandboxDailyCap`), vẫn tính chung vào `dailyCap`.
- **Chu kỳ hạn mức:** cấu hình qua constructor: `1 days` khi chạy thật; `120s` (`DEMO_PERIOD_SECONDS=120`) khi demo (đổi từ 30s ngày 13/11).
- **Hoàn hạn mức `release(nonce)`:** làm ngay trong GĐ 1.

| Việc | File | Giờ |
|---|---|---|
| `AgentPolicy` theo SPEC (hạn mức phân tầng Trusted/Sandbox, chu kỳ tùy chỉnh constructor, thêm `validAfter`). Event: `Authorized`, `Paused`, `Unpaused`, `CapsChanged`, `WhitelistChanged`, `Withdrawn`, `Released` (dashboard đọc lịch sử từ event) | `contracts/src/AgentPolicy.sol` | 5–6 |
| Factory: mỗi chủ một contract (luật 3), event `PolicyCreated(owner, policy)` | `contracts/src/AgentPolicyFactory.sol` | 1–2 |
| Test đủ danh sách bắt buộc trong SPEC: vượt trần mỗi lần, vượt trần chu kỳ (cả whitelist và sandbox), sai ví agent, sau `pause`, digest hết hạn, hạn mức hồi lại khi sang chu kỳ (`vm.warp`), `release(nonce)` | `contracts/test/AgentPolicy.t.sol` | 3–4 |
| Fuzz hoặc invariant: tổng đã duyệt trong một chu kỳ không vượt `dailyCap` và phần sandbox không vượt `sandboxDailyCap` | `contracts/test/AgentPolicy.invariant.t.sol` | 1–2 |
| Test fork Fuji: gọi `transferWithAuthorization` thật của USDC với `from` là policy | `contracts/test/AgentPolicy.fork.t.sol` | 1–2 |
| Script deploy factory và một policy mẫu, verify trên Snowtrace | `contracts/script/Deploy.s.sol` | 1 |
| CI: `forge test` (bỏ test fork nếu không có RPC) và `npm run build` cho web | `.github/workflows/ci.yml` | 1 |
| `release(nonce)` hoàn hạn mức khi `validBefore` đã qua và nonce chưa dùng trên USDC | `AgentPolicy.sol` | 1 |

**Xong khi:** CI xanh trên GitHub, factory và một policy đã verified trên Fuji, địa chỉ ghi vào README.

## GĐ 2: Agent và API bán (13–15/11)

**Quyết định đã chốt:**
- **LLM:** Dùng Gemini **`gemini-3.8-flash`** (`@google/genai`).
- **API bán:** 2 API bán dữ liệu **mock có cấu trúc** (Thời tiết & Tỷ giá).

| Việc | File | Giờ |
|---|---|---|
| 2 API bán dữ liệu mock có cấu trúc chép từ `server.mjs` của starter kit (ghi nguồn đầu file): thời tiết và tỷ giá, mỗi API 0.001 USDC và một `payTo` riêng | `sellers/` | 2–3 |
| Rule engine: chỉ gọi API trong danh mục, `payTo` khớp danh mục, giá khớp bảng giá, tối đa 5 lần mỗi phút mỗi API, không mua lại cùng truy vấn trong thời gian ngắn. Mỗi lần chặn trả lý do tiếng Việt | `agent/src/rules.ts` | 3 |
| Test rule engine (vitest), mỗi luật ít nhất một ca đạt và một ca bị chặn | `agent/test/rules.test.ts` | 2 |
| LLM tool calling (Gemini `gemini-3.8-flash` qua `@google/genai`). LLM chỉ trả đề xuất có cấu trúc `{ tool, api, query }`, không thấy khóa, không thấy số tiền | `agent/src/llm.ts` | 3 |
| Vòng chạy: LLM → rule engine → x402 client dùng `policySigner` (đổi `approve` sang `authorize`). Cờ `--bypass-rules` cho bước 5 của demo | `agent/src/run.ts` | 3–4 |
| Ghi các lần rule engine chặn ra chỗ dashboard đọc được (file JSON hoặc endpoint nhỏ), vì lần chặn ngoài chuỗi không có event | `agent/src/log.ts` | 1–2 |

**Xong khi:** giao nhiệm vụ "tổng hợp thời tiết và tỷ giá cho chuyến đi Đà Lạt", agent tự mua 3 lần liên tiếp không cần can thiệp, lần 4 bị contract revert vì vượt hạn mức.

## GĐ 3: Dashboard (15–18/11)

**Quyết định đã chốt:** Dùng **Privy (`@privy-io/react-auth`) + `viem` thuần, bỏ `wagmi`** (giống starter kit `privy-agent-wallet`).

| Việc | Nội dung | Giờ | Trạng thái |
|---|---|---|---|
| Đăng nhập | Privy bằng email (`@privy-io/react-auth` + viem), chép `providers.tsx` từ `privy-agent-wallet`. Tài trợ gas nếu Privy cho phép trên Fuji | 3 | 🟡 code xong 13/11, chờ nghiệm thu đăng nhập |
| Tổng quan | Đồng hồ hạn mức còn lại trong chu kỳ (Trusted & Sandbox), số dư USDC của contract, trạng thái agent (đang chạy hoặc đã khóa) | 3 | 🟡 code xong 13/11, số khớp on-chain |
| Dòng tiền | Danh sách khoản chi từ event `Authorized` kèm link Snowtrace; sơ đồ agent → các API, đường dày theo số tiền | 4–5 |  |
| Luật chi tiêu | Sửa hạn mức phân tầng, thêm hoặc bớt whitelist; mỗi thay đổi là một giao dịch do chủ ký | 2–3 |  |
| Kill switch | Nút đỏ to, luôn hiện, gọi `pause()` | 1 |  |
| Bị từ chối | Gộp revert trên chuỗi (vượt trần Sandbox, vượt hạn mức) và log của rule engine, lý do tiếng Việt | 2–3 |  |
| Trạng thái giao dịch | Ba bước rõ ràng: đang ký, đang chờ, xong (kèm link) | 1–2 |  |
| Cập nhật thời gian thực | Theo dõi event (`watchContractEvent` hoặc hỏi định kỳ vài giây một lần) | 1–2 |  |

Phần giao diện tĩnh có thể giao Giang theo [AGENTS.md](../AGENTS.md), chỗ cần dữ liệu đánh dấu `{/* TODO Nguyên: nối dữ liệu */}`.

**Xong khi:** chạy trọn 7 bước kịch bản demo trong SPEC trên một máy, không phải sửa tay giữa chừng.

## GĐ 4: Nên có và bonus (18–19/11)

Làm theo thứ tự, hết giờ thì dừng:

1. Nút "tạo agent" trên giao diện, gọi factory.
2. Công tắc chế độ demo "bỏ qua rule engine" trên giao diện.
3. Danh tính agent theo ERC-8004 (khoảng 3–5 giờ).

Không làm bản chạy trên L1 riêng.

## GĐ 5: Đóng gói (19–21/11)

- README: sơ đồ kiến trúc, địa chỉ contract, cách chạy trong 3 lệnh.
- Script nạp dữ liệu mẫu cho demo (`scripts/seed-demo`).
- Deploy web (ví dụ Vercel), ghi tài khoản test cho giám khảo.
- Quay video cùng Giang theo kịch bản trong SPEC, có câu khai chu kỳ 120 giây (`DEMO_PERIOD_SECONDS=120`) ngay đầu (luật 6).
- Nộp trước trưa 21/11, để nửa ngày còn lại dự phòng.

## Rủi ro và cách cắt

**Đường găng:** GĐ 0 trễ thì mọi thứ trễ theo. Hết 11/11 chưa qua GĐ 0 thì chuyển sang phương án hàm `pay`.

**Trễ thì bỏ theo thứ tự:**

1. ERC-8004
2. Sơ đồ dòng tiền (giữ danh sách khoản chi)
3. Nút tạo agent trên giao diện (deploy bằng script)

**Không bao giờ cắt:** test các đường tiền, kill switch, contract verified trên Snowtrace, khoảnh khắc "bị từ chối" trong demo.

## Theo dõi tiến độ

Giang đánh dấu ở đây hoặc trên trang Notion theo dõi tiến độ.

- [x] 10/11: GĐ 0 xong, đã chốt facilitator (Facilitator tự host & PayAI; loại Ultravioleta DAO) — xem [SPIKE.md](SPIKE.md)
- [x] 11/11: đã chốt hạn mức phân tầng (Trusted vs Sandbox)
- [x] 13/11: GĐ 1 xong: CI xanh, `AgentPolicy` & `AgentPolicyFactory` verified trên Fuji
- [x] 13/11 (dời từ 15/11): agent tự mua 3 lần, lần 4 bị chặn (`ExceedsDailyCap`, policy demo 120s, chạy bằng `demo:mock`)
- [x] 15/11: đã chốt thư viện web (Privy `@privy-io/react-auth` + `viem` thuần, bỏ `wagmi`)
- [ ] 16/11 (dời từ 18/11): chạy trọn kịch bản demo trên dashboard
- [ ] 18/11 (dời từ 19/11): xong phần nên có (hoặc đã quyết bỏ)
- [ ] 19/11: README, web deploy · 20/11: video
- [ ] 21/11 trước trưa: đã nộp
