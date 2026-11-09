# Đặc tả MVP: AgentLeash

Nguồn quyết định (nằm ngoài repo, trên máy Nguyên): `UniHack_avalanche/reports/2026-11-08-y-tuong-1-agentleash.md`, nhất là mục "Thiết kế đã sửa sau phản biện", và `UniHack_avalanche/reports/2026-11-09-bao-cao-phan-tich-2-starter-kit-btc.md`. File này tóm đủ để làm việc. Thấy chỗ nào lệch với báo cáo thì báo Nguyên.

## Một câu

AI agent tự trả tiền API qua x402, nhưng tiền nằm trong một policy contract của chủ agent. Agent chỉ được *xin* chi, contract mới *quyết* chi theo hạn mức, whitelist và nút tắt khẩn cấp. Chủ agent xem dòng tiền theo thời gian thực.

- **Track:** AI Agents / x402 (ghép đề 12 và đề 17).
- **Mạng:** Avalanche Fuji C-Chain (chainId 43113), USDC test. Không cần L1.
- **Hạn nộp:** 23:59 ngày 21/11/2026.

## Phạm vi

| Mức | Gồm |
|---|---|
| **Bắt buộc** | Policy contract và test, deploy và verify trên Fuji; vòng x402 qua ERC-1271 chạy thật; agent có rule engine; dashboard có đồng hồ hạn mức, danh sách khoản chi, kill switch; 2 API bán mẫu |
| **Nên có** | Factory "tạo agent" ngay trên giao diện; sơ đồ dòng tiền; chế độ demo "bỏ qua rule engine"; hàm `release` hoàn hạn mức |
| **Bonus nếu dư giờ** | Danh tính agent theo ERC-8004 (khoảng 3–5 giờ); bản thứ hai chạy trên L1 riêng (chỉ khi có VPS chạy node đến 30/11) |

Ước tính 65–85 giờ code, trên quỹ chung khoảng 90–100 giờ.

## Lịch (đề xuất, Nguyên chưa chốt)

| Ngày | Việc | Mốc kiểm tra |
|---|---|---|
| 09–10/11 | Chạy thử trọn vòng: contract duyệt, facilitator nhận, API trả 200 | **Tối 10/11 quyết** facilitator (xem mục "Chưa chốt") |
| 11–13/11 | Policy contract hoàn chỉnh, test và fuzz, deploy và verify Fuji | `forge test` xanh trên CI |
| 13–15/11 | Agent: LLM tool calling, rule engine, x402 client; dựng 2 API bán | Agent tự mua 3 lần không cần can thiệp |
| 15–18/11 | Dashboard: Privy, event theo thời gian thực, kill switch, màn bị từ chối | Chạy trọn kịch bản demo |
| 18–19/11 | Factory, chế độ demo, ERC-8004 nếu kịp | — |
| 19–21/11 | README, sơ đồ kiến trúc, script nạp dữ liệu mẫu, quay video, dự phòng | Nộp trước hạn ít nhất nửa ngày |

## Vai

| Vai | Là ai | Làm gì |
|---|---|---|
| **Chủ agent** | Dev hoặc doanh nghiệp chạy agent | Nạp USDC vào contract, đặt hạn mức và whitelist, bấm kill switch, rút tiền |
| **Agent** | Chương trình LLM có tool calling | Tự mua dữ liệu trong phạm vi được phép. Ví của agent chỉ gọi được `authorize` và chỉ giữ ít AVAX trả gas |
| **Bên bán API** | API thu phí qua x402 | Nhận USDC ngay khi giao dữ liệu |
| **Bên kiểm tra** | Kế toán, kiểm toán, giám khảo | Đọc luật chi tiêu và lịch sử chi trên Snowtrace |

## Kiến trúc

| Thư mục | Nội dung |
|---|---|
| `contracts/` | `AgentPolicy` (mỗi chủ agent một contract) và factory tạo contract |
| `agent/` | LLM, rule engine và x402 client (TypeScript) |
| `sellers/` | 2–3 API mẫu thu phí qua x402 |
| `web/` | Dashboard Next.js: đăng nhập Privy, đồng hồ hạn mức, dòng tiền, kill switch |

Starter kit của ban tổ chức (`x402-pay-per-request`, `privy-agent-wallet`) **không nằm trong repo**. Cần code mẫu thì chỉ chép đúng phần dùng tới vào thư mục tương ứng, và ghi nguồn ở đầu file.

## Luồng một khoản chi

```mermaid
sequenceDiagram
    participant L as LLM
    participant R as Rule engine
    participant P as Policy contract
    participant S as API bán dữ liệu
    participant F as Facilitator
    participant U as USDC (Fuji)
    L->>R: Đề xuất: mua dữ liệu thời tiết từ API S
    R->>S: GET /weather
    S-->>R: 402 + giá 0.001 USDC, payTo
    R->>R: Kiểm tra giá, payTo, tần suất
    R->>P: authorize(payTo, amount, validBefore, nonce)
    P->>P: Kiểm tra pause, hạn mức, whitelist; ghi digest đã duyệt
    R->>S: GET /weather + thanh toán x402 (from = P)
    S->>F: verify + settle
    F->>U: transferWithAuthorization(from = P, ...)
    U->>P: isValidSignature(digest) theo ERC-1271
    P-->>U: Hợp lệ (nếu digest đã duyệt và chưa pause)
    U-->>S: Chuyển 0.001 USDC
    S-->>R: 200 + dữ liệu
```

1. **LLM đề xuất**, ví dụ "mua dữ liệu thời tiết Đà Lạt". LLM không có khóa, không thấy số tiền, không gọi contract.
2. **Rule engine gọi API** và nhận mã 402 kèm giá và `payTo`.
3. **Rule engine kiểm tra ngoài chuỗi:** giá khớp bảng giá, `payTo` đúng của API đó, tần suất gọi trong giới hạn. Sai thì dừng, không tốn gas.
4. **Rule engine gọi `authorize`** trên policy contract bằng ví agent.
5. **Contract kiểm tra trên chuỗi:** chưa pause, `payTo` trong whitelist, không vượt hạn mức mỗi lần và hạn mức còn lại của chu kỳ. Đạt thì contract tự tính digest EIP-712, ghi là đã duyệt và trừ hạn mức.
6. **Agent gửi lại yêu cầu** kèm thanh toán x402, người trả (`from`) là địa chỉ policy contract.
7. **Facilitator gọi USDC.** USDC thấy người trả là contract nên hỏi `isValidSignature`, và contract chỉ chấp nhận đúng digest đã duyệt.
8. **USDC chuyển tiền** sang bên bán, API trả dữ liệu, dashboard hiện khoản chi kèm link Snowtrace.

Agent bị chiếm và bỏ qua rule engine thì vẫn phải qua bước 5. Đây là lớp chặn cuối.

**Vì sao USDC phải nằm trong contract:** x402 kiểu "exact" dùng chữ ký EIP-3009, facilitator gọi thẳng vào USDC. Nếu USDC nằm trong ví EOA của agent thì khoản chi đi vòng qua policy contract và vi phạm luật 4. Vì vậy contract tự giữ USDC và đứng làm người trả theo ERC-1271.

## Policy contract

Khung giao diện (chưa phải code cuối):

```solidity
contract AgentPolicy {
    address public owner;          // chủ agent: EOA hoặc Safe
    address public agent;          // ví agent, chỉ được gọi authorize
    IFiatToken public immutable usdc;

    uint256 public perTxCap;       // trần mỗi khoản, 6 số thập phân
    uint256 public dailyCap;       // trần mỗi chu kỳ
    uint256 public period;         // 1 days khi chạy thật; ngắn hơn khi demo
    uint256 public spentInPeriod;
    uint256 public periodStart;

    mapping(address => bool) public whitelist;
    mapping(bytes32 => uint256) public approvedUntil;  // digest => validBefore
    bool public paused;

    function authorize(address payTo, uint256 amount, uint256 validBefore, bytes32 nonce)
        external onlyAgent whenNotPaused returns (bytes32 digest);
    function isValidSignature(bytes32 hash, bytes calldata) external view returns (bytes4);

    // Chỉ chủ agent
    function pause() external;
    function unpause() external;
    function setWhitelist(address payTo, bool allowed) external;
    function setCaps(uint256 perTx, uint256 daily) external;
    function withdraw(uint256 amount) external;   // rút USDC về ví chủ
}
```

Năm quyết định thiết kế:

1. **Contract tự tính digest** từ tham số khoản chi, bằng `DOMAIN_SEPARATOR` và typehash `TransferWithAuthorization` của USDC. Không nhận digest do agent đưa vào, vì agent có thể xin duyệt một digest trả cho địa chỉ ngoài whitelist.
2. **Trừ hạn mức ngay khi duyệt**, không chờ tiền chuyển xong. Hàm `release(nonce)` (nên có): khi `validBefore` đã qua mà USDC báo nonce chưa dùng (`authorizationState`), hoàn lại hạn mức.
3. **Kill switch chặn cả khoản đã duyệt.** Khi `paused = true`, `isValidSignature` trả thất bại, nên khoản đã duyệt mà facilitator chưa gửi lên chuỗi cũng bị chặn.
4. **Mỗi chủ agent một contract**, tạo qua factory. Chỉ chủ rút được tiền, không có quỹ chung (luật 3).
5. **Chu kỳ hạn mức cấu hình được:** 1 ngày khi chạy thật, khoảng 2 phút khi demo. Đây là giả lập thời gian nên phải khai đầu pitch (luật 6).

**Test Foundry bắt buộc** (ban tổ chức ghi "tests are mandatory on the money paths"):

- Vượt `perTxCap`, vượt `dailyCap`, người nhận ngoài whitelist: `authorize` revert.
- Gọi `authorize` từ ví không phải agent: revert.
- Sau `pause()`: `authorize` revert, và `isValidSignature` từ chối cả digest đã duyệt trước đó.
- Digest hết hạn (`validBefore` đã qua): bị từ chối.
- Hạn mức hồi lại khi sang chu kỳ mới (`vm.warp`).
- Fuzz: với mọi chuỗi `authorize` ngẫu nhiên, tổng đã duyệt trong một chu kỳ không vượt `dailyCap`.
- Test tích hợp trên fork Fuji: gọi `transferWithAuthorization` thật của USDC với `from` là policy contract.

## Rule engine

LLM chỉ trả về đề xuất có cấu trúc, ví dụ `{ "tool": "buy_data", "api": "weather", "query": "Da Lat" }`. Rule engine (TypeScript, viết tay, có test) quyết có chi hay không:

- Chỉ gọi API trong danh mục đã đăng ký, mỗi API gắn một `payTo` cố định.
- Giá trong phản hồi 402 phải khớp bảng giá, lệch là dừng.
- Giới hạn tần suất, ví dụ tối đa 5 lần mỗi phút cho mỗi API.
- Không mua lại cùng một truy vấn trong khoảng thời gian ngắn.

Rule engine chặn sớm và rẻ. Policy contract là lớp cuối, không ai vượt được, kể cả khi rule engine bị chiếm.

## Dashboard

| Màn hình | Nội dung |
|---|---|
| **Tổng quan** | "Đồng hồ xăng" hạn mức còn lại trong chu kỳ, số dư USDC của contract, trạng thái agent (đang chạy hoặc đã khóa) |
| **Dòng tiền** | Sơ đồ agent → các API, mỗi đường dày theo số tiền. Danh sách khoản chi theo event của contract, mỗi dòng có link Snowtrace |
| **Luật chi tiêu** | Sửa hạn mức, thêm hoặc bớt whitelist. Mỗi thay đổi là một giao dịch do chủ ký |
| **Kill switch** | Nút đỏ, to, luôn hiện. Bấm là gọi `pause()` |
| **Bị từ chối** | Các lần rule engine hoặc contract chặn, kèm lý do tiếng Việt ("vượt hạn mức ngày", "người nhận không có trong whitelist") |

Đăng nhập email qua Privy, giám khảo không cần cài ví. Mỗi giao dịch có 3 trạng thái rõ: đang ký, đang chờ, xong (kèm link Snowtrace).

## Kịch bản demo khoảng 2 phút

1. **Mở đầu (luật 6):** "Trong demo, chu kỳ hạn mức đặt 2 phút thay vì 1 ngày."
2. **Thiết lập:** chủ đăng nhập email, tạo agent với hạn mức 0.003 USDC mỗi chu kỳ, whitelist hai API dữ liệu.
3. **Agent làm việc:** nhiệm vụ "tổng hợp thời tiết và tỷ giá cho chuyến đi Đà Lạt". Agent mua dữ liệu 3 lần, đồng hồ hạ dần, mỗi khoản có link Snowtrace.
4. **Bị chặn lần 1:** lần mua thứ 4 vượt hạn mức, contract revert, dashboard báo đỏ.
5. **Bị chặn lần 2 (agent bị chiếm):** bật chế độ "bỏ qua rule engine", cho agent gọi thẳng contract để trả cho địa chỉ lạ. Contract vẫn từ chối.
6. **Kill switch:** chủ bấm nút đỏ, mọi khoản chi tiếp theo bị chặn, kể cả khoản đã duyệt trước đó.
7. **Kết:** mở Snowtrace, contract đã verify và lịch sử chi khớp dashboard.

## Địa chỉ và tham số đã biết

| Mục | Giá trị |
|---|---|
| Fuji C-Chain | chainId 43113, RPC `https://api.avax-test.network/ext/bc/C/rpc` |
| USDC Fuji (`FiatTokenV2_2`, hỗ trợ ERC-1271) | `0x5425890298aed601595a70AB815c96711a31Bc65` |
| ERC-8004 Identity Registry trên Fuji | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Facilitator công khai (theo starter kit x402) | `https://facilitator.ultravioletadao.xyz`, `https://facilitator.payai.network` |

## Chưa chốt

1. **Facilitator có nhận chữ ký ERC-1271 không.** Thử trong 09–10/11. Nếu không nhận thì tự host (starter kit x402 có sẵn facilitator chạy được, hoặc dùng x402-rs). Phương án cuối là contract tự chuyển USDC qua hàm `pay` rồi agent gửi mã giao dịch cho API. Cách này vẫn đúng luật 4 nhưng lệch chuẩn x402 nên mất điểm Q.
2. **Whitelist cứng hay hạn mức phân tầng.** Phân tầng nghĩa là API lạ vẫn trả được nhưng với trần rất thấp (ví dụ 0.001 USDC mỗi lần, 0.05 USDC mỗi ngày). Nếu chọn phân tầng thì bước 5 của demo phải đổi: khoản trả cho địa chỉ lạ bị chặn vì vượt trần sandbox, không phải vì ngoài whitelist.
3. **Thư viện web.** `web/` đang dùng Next.js 15 + wagmi + viem; starter kit Privy dùng Next.js 16 + viem, không có wagmi. Quyết khi bắt đầu làm dashboard: giữ wagmi (qua `@privy-io/wagmi`) hay chỉ dùng viem.
4. **Câu hỏi giám khảo về Safe:** kiểm tra allowance module của Safe có làm được whitelist người nhận và ký x402 qua ERC-1271 không, trước khi khẳng định AgentLeash khác Safe.

## Luật cuộc thi cần nhớ khi code và pitch

- **Luật 3:** non-custodial, không gom quỹ. Mỗi chủ một contract, chỉ chủ rút.
- **Luật 4:** LLM không bao giờ là bên quyết chuyển tiền; agent phải có policy contract với hạn mức, whitelist, kill switch.
- **Luật 5:** trên chuỗi chỉ có địa chỉ, số tiền và trạng thái. Nội dung truy vấn của agent không lên chuỗi.
- **Luật 6:** dữ liệu hay thời gian giả lập (chu kỳ 2 phút) phải khai ngay đầu pitch.
- **Luật 2 và 8:** crypto không phải phương tiện thanh toán ở Việt Nam. Chỉ dùng USDC test cho dịch vụ máy với máy, không trả lương, không thu tiền thật của người dùng, không tư vấn tài chính.
- **Luật 9**, ba câu phải trả lời được:
  - *Vì sao on-chain:* luật chi tiêu phải nằm ở nơi agent không sửa được và mọi bên kiểm tra được.
  - *Vì sao Avalanche:* có facilitator x402 chạy sẵn trên Fuji và C-Chain, USDC Fuji hỗ trợ ERC-1271, phí đủ thấp để khoản 0.001 USDC có ý nghĩa. Nói thật là x402 cũng có trên chuỗi khác.
  - *Tiền đến từ đâu:* phí SaaS theo số agent được quản lý, hoặc phí nhỏ trên mỗi giao dịch x402 đi qua policy.
