"use client";

import { useWallets } from "@privy-io/react-auth";
import { useCallback, useEffect, useReducer, useState } from "react";
import { createWalletClient, custom, getAddress, type Address, type Hex, type WalletClient } from "viem";
import { factoryAbi, policyOwnerAbi } from "./abi";
import { CHAIN, FACTORY_ADDRESS, publicClient } from "./chain";
import { describeTxError, txReducer } from "./ownerTx";
import { KNOWN_SELLERS } from "./spends";

/** Ví nhúng Privy của người đang đăng nhập; ví này là chủ (owner) các policy họ tạo qua factory. */
export function useOwnerWallet() {
  const { wallets, ready } = useWallets();
  const wallet = wallets.find((w) => w.walletClientType === "privy") ?? null;
  const address = wallet ? getAddress(wallet.address) : null;

  const getWalletClient = useCallback(async (): Promise<WalletClient & { account: { address: Address } }> => {
    if (!wallet || !address) throw new Error("Chưa có ví Privy.");
    await wallet.switchChain(CHAIN.id);
    const provider = await wallet.getEthereumProvider();
    return createWalletClient({ account: address, chain: CHAIN, transport: custom(provider) }) as WalletClient & {
      account: { address: Address };
    };
  }, [wallet, address]);

  return { ready, address, getWalletClient };
}

/** Policy mà ví này đã tạo qua factory (mới nhất ở cuối) và số dư AVAX để trả gas. */
export function useOwnerAccount(owner: Address | null) {
  const [policies, setPolicies] = useState<Address[] | null>(null);
  const [avax, setAvax] = useState<bigint | null>(null);

  const refresh = useCallback(async () => {
    if (!owner) return;
    try {
      const [list, balance] = await Promise.all([
        publicClient.readContract({
          address: FACTORY_ADDRESS,
          abi: factoryAbi,
          functionName: "getPoliciesByOwner",
          args: [owner],
        }),
        publicClient.getBalance({ address: owner }),
      ]);
      setPolicies([...list]);
      setAvax(balance);
    } catch {
      // Giữ số cũ; lần hỏi sau thử lại.
    }
  }, [owner]);

  useEffect(() => {
    setPolicies(null);
    setAvax(null);
    if (!owner) return;
    void refresh();
    const id = setInterval(() => void refresh(), 6_000);
    return () => clearInterval(id);
  }, [owner, refresh]);

  return { policies, avax, refresh };
}

/** Trạng thái whitelist của 2 API demo trên policy đang xem. */
export function useWhitelist(policy: Address | null) {
  const [state, setState] = useState<Record<string, boolean> | null>(null);

  const refresh = useCallback(async () => {
    if (!policy) return;
    try {
      const sellers = Object.keys(KNOWN_SELLERS).map((a) => getAddress(a));
      const flags = await Promise.all(
        sellers.map((s) =>
          publicClient.readContract({ address: policy, abi: policyOwnerAbi, functionName: "whitelist", args: [s] }),
        ),
      );
      setState(Object.fromEntries(sellers.map((s, i) => [s.toLowerCase(), flags[i]])));
    } catch {
      // Giữ số cũ.
    }
  }, [policy]);

  useEffect(() => {
    setState(null);
    if (!policy) return;
    void refresh();
    const id = setInterval(() => void refresh(), 6_000);
    return () => clearInterval(id);
  }, [policy, refresh]);

  return { whitelist: state, refresh };
}

/**
 * Chạy một lệnh chủ ký và theo dõi 3 bước. `send` nên mô phỏng (simulateContract) trước rồi mới ký,
 * để lỗi như Unauthorized hiện ngay mà không tốn gas.
 */
export function useOwnerTx(onConfirmed?: () => void) {
  const [state, dispatch] = useReducer(txReducer, { phase: "idle" });

  const run = useCallback(
    async (label: string, send: () => Promise<Hex>) => {
      dispatch({ type: "start", label });
      try {
        const hash = await send();
        dispatch({ type: "sent", hash });
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
        if (receipt.status !== "success") {
          dispatch({ type: "failed", message: "Giao dịch bị revert trên chuỗi. Mở Snowscan để xem." });
          return null;
        }
        dispatch({ type: "confirmed" });
        onConfirmed?.();
        return receipt;
      } catch (e) {
        console.error(`[AgentLeash] ${label} thất bại`, e);
        dispatch({ type: "failed", message: describeTxError(e) });
        return null;
      }
    },
    [onConfirmed],
  );

  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  return { state, run, reset };
}
