"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { USDC_ADDRESS, publicClient } from "./chain";
import { readPolicy, type PolicyRaw } from "./policy";

const POLL_MS = 3_000;

/** Đọc AgentPolicy định kỳ 3 giây (GĐ 3c sẽ thêm watchContractEvent). Đổi `policy` thì xóa số cũ. */
export function usePolicy(enabled: boolean, policy: Address | null) {
  const [raw, setRaw] = useState<PolicyRaw | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const current = useRef(policy);
  useEffect(() => {
    current.current = policy;
  }, [policy]);

  const refresh = useCallback(async () => {
    if (!policy) return;
    try {
      const next = await readPolicy(publicClient, policy, USDC_ADDRESS);
      if (current.current !== policy) return; // kết quả của policy cũ về muộn
      setRaw(next);
      setUpdatedAt(Date.now());
      setError(null);
    } catch (e) {
      // Giữ số cũ trên màn hình, chỉ báo lỗi kết nối.
      setError(e instanceof Error ? e.message.split("\n")[0] : String(e));
    }
  }, [policy]);

  useEffect(() => {
    setRaw(null);
    setUpdatedAt(null);
  }, [policy]);

  useEffect(() => {
    if (!enabled || !policy) return;
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [enabled, policy, refresh]);

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
