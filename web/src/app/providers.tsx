"use client";

// Chép từ starter kit ../privy-agent-wallet/src/app/providers.tsx, chỉ giữ Fuji.
import { PrivyProvider } from "@privy-io/react-auth";
import { avalancheFuji } from "viem/chains";
import { APP_ID_STATE, PRIVY_APP_ID } from "@/lib/app-id";

export function Providers({ children }: { children: React.ReactNode }) {
  // Thiếu app ID hợp lệ thì không nạp Privy; page.tsx hiện hướng dẫn cấu hình.
  if (APP_ID_STATE !== "ok") return <>{children}</>;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email"],
        defaultChain: avalancheFuji,
        supportedChains: [avalancheFuji],
        appearance: { theme: "dark", accentColor: "#22d3ee" },
        embeddedWallets: { ethereum: { createOnLogin: "all-users" } },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
