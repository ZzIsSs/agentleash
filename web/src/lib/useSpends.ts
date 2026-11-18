"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { ROUTESCAN_API, publicClient } from "./chain";
import {
  blockRanges,
  extractWhitelistTargets,
  fromRoutescan,
  initialRpcScanFrom,
  mergeSpends,
  type RawLog,
  type RoutescanLog,
  type Spend,
} from "./spends";

const POLL_MS = 3_000;
/** Cứ ~10 lần block mới hỏi lại Routescan một lần, phòng khi RPC bỏ sót. */
const ROUTESCAN_EVERY = 10;

async function fetchRoutescan(policy: Address, toBlock: bigint): Promise<RawLog[]> {
  // Ghim `toBlock` theo block hiện tại để tránh Cloudflare trả cache cũ của `toBlock=latest`.
  const url = `${ROUTESCAN_API}?module=logs&action=getLogs&address=${policy}&fromBlock=0&toBlock=${toBlock.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Routescan HTTP ${res.status}`);
  const json = (await res.json()) as { status: string; message: string; result: RoutescanLog[] | string };
  if (!Array.isArray(json.result)) {
    if (/no records/i.test(json.message)) return [];
    throw new Error(`Routescan: ${json.message}`);
  }
  return json.result.map(fromRoutescan);
}

/** Quét các block mới bằng RPC (tối đa 100 block mỗi lần gọi, tối đa 500 block), kèm thời gian block cho log mới. */
async function fetchRecent(policy: Address, from: bigint, to: bigint): Promise<RawLog[]> {
  const logs: RawLog[] = [];
  for (const [fromBlock, toBlock] of blockRanges(from, to)) {
    const chunk = await publicClient.getLogs({ address: policy, fromBlock, toBlock });
    logs.push(
      ...chunk.map((l) => ({
        topics: l.topics,
        data: l.data,
        transactionHash: l.transactionHash,
        blockNumber: l.blockNumber,
        logIndex: l.logIndex,
        timestamp: null,
      })),
    );
  }
  const blocks = [...new Set(logs.map((l) => l.blockNumber).filter((b): b is bigint => b !== null))];
  const times = new Map(
    await Promise.all(
      blocks.map(async (b) => [b, Number((await publicClient.getBlock({ blockNumber: b })).timestamp)] as const),
    ),
  );
  return logs.map((l) => ({ ...l, timestamp: l.blockNumber === null ? null : (times.get(l.blockNumber) ?? null) }));
}

/** Danh sách khoản chi (event Authorized) + địa chỉ WhitelistChanged của policy, tự cập nhật khi có block mới. */
export function useSpends(enabled: boolean, policy: Address | null, chainBlock?: bigint | null) {
  const [spends, setSpends] = useState<Spend[]>([]);
  const [whitelistTargets, setWhitelistTargets] = useState<Address[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stepRef = useRef<((targetBlock?: bigint) => Promise<void>) | null>(null);
  const hasSharedBlock = chainBlock !== undefined;

  useEffect(() => {
    setSpends([]);
    setWhitelistTargets([]);
    setLoaded(false);
    setError(null);
    stepRef.current = null;
    if (!enabled || !policy) return;

    let cancelled = false;
    let cursor: bigint | null = null;
    let tick = 0;
    let running = false;

    const step = async (targetBlock?: bigint) => {
      if (running) return;
      if (typeof document !== "undefined" && document.hidden && targetBlock === undefined) return;
      running = true;
      try {
        const latest = targetBlock ?? (await publicClient.getBlockNumber());
        if (cursor !== null && latest <= cursor) {
          return;
        }
        const logs: RawLog[] = [];
        let routescanLogs: RawLog[] = [];
        if (cursor === null || tick % ROUTESCAN_EVERY === 0) {
          try {
            routescanLogs = await fetchRoutescan(policy, latest);
            logs.push(...routescanLogs);
          } catch (e) {
            if (cursor === null) throw e;
          }
        }
        const from =
          cursor === null ? initialRpcScanFrom(latest, routescanLogs) : cursor + 1n;
        if (from <= latest) {
          logs.push(...(await fetchRecent(policy, from, latest)));
        }
        if (cancelled) return;
        cursor = latest;
        if (logs.length > 0) {
          setSpends((prev) => mergeSpends(prev, logs));
          setWhitelistTargets((prev) => extractWhitelistTargets(prev, logs));
        }
        setLoaded(true);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message.split("\n")[0] : String(e));
      } finally {
        tick += 1;
        running = false;
      }
    };

    stepRef.current = step;
    if (!hasSharedBlock) {
      void step();
      const id = setInterval(() => void step(), POLL_MS);
      return () => {
        cancelled = true;
        stepRef.current = null;
        clearInterval(id);
      };
    }

    return () => {
      cancelled = true;
      stepRef.current = null;
    };
  }, [enabled, policy, hasSharedBlock]);

  useEffect(() => {
    if (!enabled || !policy || chainBlock === undefined || chainBlock === null) return;
    void stepRef.current?.(chainBlock);
  }, [enabled, policy, chainBlock]);

  const refresh = useCallback(() => {
    void stepRef.current?.();
  }, []);

  return { spends, whitelistTargets, loaded, error, refresh };
}
