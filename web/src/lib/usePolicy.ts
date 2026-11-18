"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { USDC_ADDRESS, publicClient } from "./chain";
import { readPolicy, type PolicyRaw } from "./policy";

const POLL_MS = 3_000;

/** Theo dõi số block mới nhất mỗi 3 giây trên 1 endpoint chung; tự tạm dừng khi tab đang ẩn. */
export function useChainBlock(enabled: boolean, intervalMs = POLL_MS) {
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);
  const runningRef = useRef(false);

  const refreshBlock = useCallback(async () => {
    if (!enabled || runningRef.current) return;
    if (typeof document !== "undefined" && document.hidden) return;
    runningRef.current = true;
    try {
      const latest = await publicClient.getBlockNumber();
      setBlockNumber((prev) => (prev === latest ? prev : latest));
    } catch {
      // Giữ block cũ; chu kỳ sau thử lại.
    } finally {
      runningRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setBlockNumber(null);
      return;
    }
    void refreshBlock();
    const id = setInterval(() => void refreshBlock(), intervalMs);
    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        void refreshBlock();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
      clearInterval(id);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, [enabled, intervalMs, refreshBlock]);

  return { blockNumber, refreshBlock };
}

/** Đọc AgentPolicy mỗi khi có block mới (hoặc gọi refresh thủ công). Đổi `policy` thì xóa số cũ. */
export function usePolicy(enabled: boolean, policy: Address | null, chainBlock?: bigint | null) {
  const [raw, setRaw] = useState<PolicyRaw | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const current = useRef(policy);
  useEffect(() => {
    current.current = policy;
  }, [policy]);

  const fetchAt = useCallback(
    async (targetBlock?: bigint | null) => {
      if (!policy) return;
      try {
        const next = await readPolicy(publicClient, policy, USDC_ADDRESS, targetBlock);
        if (current.current !== policy) return; // kết quả của policy cũ về muộn
        setRaw(next);
        setUpdatedAt(Date.now());
        setError(null);
      } catch (e) {
        // Giữ số cũ trên màn hình, chỉ báo lỗi kết nối.
        setError(e instanceof Error ? e.message.split("\n")[0] : String(e));
      }
    },
    [policy],
  );

  const refresh = useCallback(() => fetchAt(null), [fetchAt]);

  useEffect(() => {
    setRaw(null);
    setUpdatedAt(null);
  }, [policy]);

  useEffect(() => {
    if (!enabled || !policy) return;
    if (chainBlock === undefined) {
      void fetchAt(null);
      const id = setInterval(() => {
        if (typeof document === "undefined" || !document.hidden) {
          void fetchAt(null);
        }
      }, POLL_MS);
      return () => clearInterval(id);
    }
    if (chainBlock !== null) {
      void fetchAt(chainBlock);
    }
  }, [enabled, policy, chainBlock, fetchAt]);

  return { raw, error, updatedAt, refresh };
}

/** Đồng hồ giây để đếm ngược chu kỳ mà không phải gọi RPC. */
export function useNow(intervalMs = 1_000) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
