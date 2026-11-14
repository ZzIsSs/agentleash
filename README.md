# AgentLeash

Ví cho AI agent có "dây xích" on-chain, dự thi **Team1 Vietnam UniHack 2026** trên Avalanche (track AI Agents / x402, hạn nộp 23:59 ngày 21/11/2026).

**Một câu:** AI agent tự trả tiền API qua x402, nhưng tiền nằm trong policy contract của chủ agent. Agent chỉ được xin chi, contract mới quyết chi theo hạn mức, whitelist và nút tắt khẩn cấp.

Kể cả khi agent bị chiếm, thiệt hại tối đa chỉ là phần hạn mức còn lại trong chu kỳ, và tiền chỉ chảy tới địa chỉ trong whitelist. LLM không bao giờ giữ khóa hay tự chuyển tiền. Chi tiết ở [docs/SPEC.md](docs/SPEC.md).

---

## Trạng thái triển khai trên Avalanche Fuji (Chain ID 43113)

| Mục | Địa chỉ On-Chain | Trạng thái Snowscan / Routescan |
|---|---|---|
| **AgentPolicyFactory** | [`0x369251fC256D8Ae3B25F66Fe1c4b3114A06BA864`](https://testnet.snowscan.xyz/address/0x369251fc256d8ae3b25f66fe1c4b3114a06ba864) | ✅ **Verified** |
| **AgentPolicy (Demo, chu kỳ 120s)** | [`0x2acc0af39b9892529c052d7192ac03664f079671`](https://testnet.snowscan.xyz/address/0x2acc0af39b9892529c052d7192ac03664f079671) | Tạo qua Factory đã verified; whitelist 2 API, hạn mức theo kịch bản demo, nạp 0.01 USDC |
| AgentPolicy (mẫu cũ, chu kỳ 30s) | [`0x7D49667A308161DD4810E6DDBEE5CBd67F4328AC`](https://testnet.snowscan.xyz/address/0x7d49667a308161dd4810e6ddbee5cbd67f4328ac) | ✅ Verified, không dùng cho demo nữa |
| **USDC Testnet (`FiatTokenV2_2`)** | [`0x5425890298aed601595a70AB815c96711a31Bc65`](https://testnet.snowscan.xyz/address/0x5425890298aed601595a70AB815c96711a31Bc65) | Circle Official (Hỗ trợ ERC-1271 & EIP-3009) |
| **SpikePolicy (Spike GĐ 0)** | [`0x38706AFC0f92b6908389ebF377aab688a2BDe951`](https://testnet.snowscan.xyz/address/0x38706AFC0f92b6908389ebF377aab688a2BDe951) | ✅ Đã kiểm chứng trọn vòng x402 |
| **Ví Deployer / Owner mẫu** | `0xd30CcDd472372f92f9DeDFaafDeD9615136b75CB` | Đã nạp gas Fuji AVAX |
| **Ví Agent mẫu** | `0x0F8de357042E53bF0E647066F0Bb1a446133ef9D` | Chỉ giữ gas gọi `authorize`, không giữ USDC |
| **Facilitator tương thích** | `http://localhost:4022` (Chính thức, tự host)<br>`https://facilitator.payai.network` (Dự phòng công khai) | Đã kiểm chứng 200 OK |

---

## Cấu trúc dự án

| Thư mục | Nội dung | Trạng thái |
|---|---|---|
| `contracts/` | `AgentPolicy.sol` & `AgentPolicyFactory.sol` (Solidity, Foundry): ERC-1271, EIP-3009 on-chain digest, hạn mức phân tầng (Trusted/Sandbox), kill switch, `release(nonce)` | ✅ **Hoàn thành GĐ 1** (29 tests pass 100%, verified Fuji) |
| `agent/` | LLM Gemini `gemini-3.8-flash` tool calling, rule engine và x402 client (`policySigner.ts`) | Đang làm (GĐ 2) |
| `sellers/` | 2 API bán dữ liệu mock có cấu trúc thu phí qua x402 (Thời tiết & Tỷ giá) | Đang làm (GĐ 2) |
| `web/` | Dashboard Next.js: Privy (`@privy-io/react-auth`) + `viem` thuần, đồng hồ hạn mức, dòng tiền, kill switch | Khung Next.js (GĐ 3) |
| `docs/` | Đặc tả [`SPEC.md`](docs/SPEC.md), lộ trình [`ROADMAP.md`](docs/ROADMAP.md), báo cáo spike [`SPIKE.md`](docs/SPIKE.md), nhật ký phiên [`sessions/`](docs/sessions/) | Cập nhật theo từng phiên |

---

## Chạy thử bộ kiểm thử Smart Contract (Foundry)

```bash
cd contracts

# Build contracts
forge build

# Chạy toàn bộ 29 tests (bao gồm Unit tests, Invariant fuzz 128k calls, và Fuji Fork tests)
forge test -vvv

# Chạy riêng Invariant Test chứng minh không bao giờ vượt dailyCap
forge test --match-contract AgentPolicyInvariantTest

# Chạy riêng Fork Test trên Avalanche Fuji với Circle USDC thật
forge test --match-contract AgentPolicyForkTest -vvv
```

### Triển khai contract mới lên Avalanche Fuji

```bash
cd contracts
forge script script/Deploy.s.sol:Deploy --rpc-url https://api.avax-test.network/ext/bc/C/rpc --broadcast
```

---

## Đội ngũ dự án

- **Nguyên** (CNTT): phụ trách kỹ thuật (smart contract, agent, web, hạ tầng x402)
- **Giang** (Quản lý công nghiệp): kịch bản demo, thiết kế sản phẩm, pitch deck

Quy tắc cho AI agent trên máy thành viên khác: [AGENTS.md](AGENTS.md).
