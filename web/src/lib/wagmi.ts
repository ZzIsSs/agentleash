import { http, createConfig } from "wagmi";
import { avalancheFuji } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// Chỉ dùng Fuji C-Chain (chainId 43113). Chưa chốt giữ wagmi hay chỉ dùng viem, xem docs/SPEC.md.
export const config = createConfig({
  chains: [avalancheFuji],
  connectors: [injected()],
  transports: {
    [avalancheFuji.id]: http(process.env.NEXT_PUBLIC_FUJI_RPC_URL),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
