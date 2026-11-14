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

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(process.env.NEXT_PUBLIC_FUJI_RPC_URL || undefined),
});

export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`;
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
