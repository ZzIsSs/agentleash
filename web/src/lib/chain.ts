import { createPublicClient, getAddress, http, type Address } from "viem";
import { avalancheFuji } from "viem/chains";

// Chỉ dùng Fuji C-Chain (43113). Địa chỉ dưới đây đều công khai; env chỉ để ghi đè khi đổi policy.
export const CHAIN = avalancheFuji;
export const EXPLORER = "https://testnet.snowscan.xyz";

const envAddress = (value: string | undefined, fallback: Address): Address =>
  value && value.trim() ? getAddress(value.trim()) : fallback;

export const USDC_ADDRESS = envAddress(
  process.env.NEXT_PUBLIC_USDC_ADDRESS,
  "0x5425890298aed601595a70AB815c96711a31Bc65",
);

// Policy demo chu kỳ 120 giây, deploy 13/11 qua factory 0x369251fC…A864 (docs/SPEC.md).
export const POLICY_ADDRESS = envAddress(
  process.env.NEXT_PUBLIC_AGENT_POLICY_ADDRESS,
  "0x2acc0af39b9892529c052d7192ac03664f079671",
);

// Factory deploy GĐ 1 (verified). Chủ agent tạo policy riêng qua đây, owner = ví gửi giao dịch.
export const FACTORY_ADDRESS = envAddress(
  process.env.NEXT_PUBLIC_AGENT_POLICY_FACTORY_ADDRESS,
  "0x369251fC256D8Ae3B25F66Fe1c4b3114A06BA864",
);

// Ví agent của demo (agent/.env giữ khóa). Policy mới tạo từ web vẫn dùng ví này để agent khỏi đổi khóa.
export const DEMO_AGENT_ADDRESS = envAddress(
  process.env.NEXT_PUBLIC_AGENT_ADDRESS,
  "0x0F8de357042E53bF0E647066F0Bb1a446133ef9D",
);

/** Tham số policy demo (docs/SPEC.md): Trusted 0.002/lần, 0.003/chu kỳ; Sandbox 0.0005/lần, 0.001/chu kỳ; chu kỳ 120 giây. */
export const DEMO_POLICY_PARAMS = {
  perTxCap: 2000n,
  dailyCap: 3000n,
  sandboxPerTxCap: 500n,
  sandboxDailyCap: 1000n,
  period: 120n,
} as const;

// Routescan (API kiểu Etherscan, không cần key, cho phép CORS). RPC công khai Fuji chỉ cho getLogs 100 block/lần,
// nên lịch sử event lấy ở đây, còn event mới thì quét các block gần nhất bằng RPC.
export const ROUTESCAN_API = "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api";

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(process.env.NEXT_PUBLIC_FUJI_RPC_URL || undefined),
});

export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`;
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
