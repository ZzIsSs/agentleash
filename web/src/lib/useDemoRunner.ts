"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import type { DemoRunResult } from "./demoRun";

export type DemoRunnerAvailability = {
  available: boolean;
  running: boolean;
  services: {
    weather: boolean;
    facilitator: boolean;
    rates: boolean;
  };
  reason?: string;
};

export type DemoRunState =
  | { phase: "idle" }
  | { phase: "running"; bypassRules: boolean }
  | { phase: "done"; bypassRules: boolean; summary: DemoRunResult }
  | { phase: "error"; bypassRules: boolean; message: string; summary?: DemoRunResult };

/** Điều phối kiểm tra máy local và kích hoạt thử agent (--mock-llm hoặc --bypass-rules) từ UI. */
export function useDemoRunner(enabled: boolean, onFinished?: () => void) {
  const [availability, setAvailability] = useState<DemoRunnerAvailability | null>(null);
  const [runState, setRunState] = useState<DemoRunState>({ phase: "idle" });

  const checkAvailability = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch("/api/demo-run", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as DemoRunnerAvailability;
      setAvailability(body);
    } catch {
      // Giữ trạng thái cũ nếu dev server vừa khởi động lại.
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void checkAvailability();
  }, [enabled, checkAvailability]);

  const runDemo = useCallback(
    async (bypassRules: boolean, policyAddress: Address) => {
      setRunState({ phase: "running", bypassRules });
      try {
        const res = await fetch("/api/demo-run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bypassRules, policyAddress }),
        });
        const body = (await res.json()) as {
          ok?: boolean;
          error?: string;
          summary?: DemoRunResult;
        };
        if (!res.ok || !body.ok || !body.summary) {
          setRunState({
            phase: "error",
            bypassRules,
            message: body.error ?? `Lỗi HTTP ${res.status}`,
            summary: body.summary,
          });
        } else {
          setRunState({ phase: "done", bypassRules, summary: body.summary });
        }
      } catch (err) {
        setRunState({
          phase: "error",
          bypassRules,
          message: err instanceof Error ? err.message : "Không gọi được API chạy demo.",
        });
      } finally {
        void checkAvailability();
        onFinished?.();
      }
    },
    [checkAvailability, onFinished],
  );

  const resetRunState = useCallback(() => {
    setRunState((prev) => (prev.phase === "running" ? prev : { phase: "idle" }));
  }, []);

  return { availability, runState, checkAvailability, runDemo, resetRunState };
}
