import { createPublicClient, fallback, getAddress, http, type Address } from "viem";
import { avalancheFuji } from "viem/chains";

// Chỉ dùng Fuji C-Chain (43113). Địa chỉ dưới đây đều công khai; env chỉ để ghi đè khi đổi policy.
export const CHAIN = avalancheFuji;
export const EXPLORER = "https://testnet.snowtrace.io";

const envAddress = (value: string | undefined, fallback: Address): Address =>
  value && value.trim() ? getAddress(value.trim()) : fallback;

export const USDC_ADDRESS = envAddress(
  process.env.NEXT_PUBLIC_USDC_ADDRESS,
  "0x5425890298aed601595a70AB815c96711a31Bc65",
);

// Policy demo chu kỳ 120 giây, tạo 14/11 từ ví Privy của Nguyên qua factory 0x369251fC…A864 (docs/SPEC.md).
// Policy 13/11 (0x2acc…9671, chủ là ví deploy) chỉ còn giữ lịch sử, không dùng cho demo.
export const POLICY_ADDRESS = envAddress(
  process.env.NEXT_PUBLIC_AGENT_POLICY_ADDRESS,
  "0x62Ea5e422b3ef66174B6Dd6Aa855F1f036894177",
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

// ERC-8004 IdentityRegistry trên Avalanche Fuji (proxy EIP-1967, implementation 0x7274e874ca62410a93bd8bf61c69d8045e399c02).
export const ERC8004_IDENTITY_REGISTRY_ADDRESS = envAddress(
  process.env.NEXT_PUBLIC_ERC8004_REGISTRY_ADDRESS,
  "0x8004A818BFB912233c491871b3d84c89A494BD9e",
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

const DEFAULT_PUBLIC_FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";
const PUBLICNODE_FUJI_RPC = "https://avalanche-fuji-c-chain-rpc.publicnode.com";
const customFujiRpc = process.env.NEXT_PUBLIC_FUJI_RPC_URL?.trim();
const isCustomDedicatedRpc =
  !!customFujiRpc && customFujiRpc.replace(/\/+$/, "") !== DEFAULT_PUBLIC_FUJI_RPC;

const rpcUrls = [
  ...(isCustomDedicatedRpc ? [customFujiRpc] : []),
  PUBLICNODE_FUJI_RPC,
  DEFAULT_PUBLIC_FUJI_RPC,
];

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: fallback(
    rpcUrls.map((url) => http(url, { retryCount: 0 })),
    { rank: false },
  ),
  batch: { multicall: true },
});

export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`;
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const nftUrl = (contractAddress: string, tokenId: bigint | string | number) =>
  `${EXPLORER}/nft/${contractAddress}/${tokenId.toString()}`;
export const shortAddress = (address: string) =>
  address.length <= 10 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
