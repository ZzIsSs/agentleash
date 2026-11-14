"use client";

import { useCallback, useEffect, useState } from "react";
import { POLICY_ADDRESS, USDC_ADDRESS, publicClient } from "./chain";
import { readPolicy, type PolicyRaw } from "./policy";

const POLL_MS = 3_000;

/** Đọc AgentPolicy định kỳ 3 giây (GĐ 3c sẽ thêm watchContractEvent). */
export function usePolicy(enabled: boolean) {
  const [raw, setRaw] = useState<PolicyRaw | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await readPolicy(publicClient, POLICY_ADDRESS, USDC_ADDRESS);
      setRaw(next);
      setUpdatedAt(Date.now());
      setError(null);
    } catch (e) {
      // Giữ số cũ trên màn hình, chỉ báo lỗi kết nối.
      setError(e instanceof Error ? e.message.split("\n")[0] : String(e));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [enabled, refresh]);

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
