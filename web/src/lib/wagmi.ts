import { http, createConfig } from "wagmi";
import { avalancheFuji } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// Tuần 1 chỉ dùng Fuji C-Chain (chainId 43113). L1 permissioned thêm ở tuần 2.
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
