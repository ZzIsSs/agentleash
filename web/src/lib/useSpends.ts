"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { ROUTESCAN_API, publicClient } from "./chain";
import { blockRanges, fromRoutescan, mergeSpends, type RawLog, type RoutescanLog, type Spend } from "./spends";

const POLL_MS = 3_000;
/** Cứ ~30 giây hỏi lại Routescan một lần, phòng khi RPC bỏ sót. */
const ROUTESCAN_EVERY = 10;

async function fetchRoutescan(policy: Address): Promise<RawLog[]> {
  const url = `${ROUTESCAN_API}?module=logs&action=getLogs&address=${policy}&fromBlock=0&toBlock=latest`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Routescan HTTP ${res.status}`);
  const json = (await res.json()) as { status: string; message: string; result: RoutescanLog[] | string };
  if (!Array.isArray(json.result)) {
    if (/no records/i.test(json.message)) return [];
    throw new Error(`Routescan: ${json.message}`);
  }
  return json.result.map(fromRoutescan);
}

/** Quét các block mới bằng RPC (tối đa 100 block mỗi lần gọi), kèm thời gian block cho log mới. */
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

/** Danh sách khoản chi (event Authorized) của policy, mới nhất lên trên, tự cập nhật 3 giây một lần. */
export function useSpends(enabled: boolean, policy: Address | null) {
  const [spends, setSpends] = useState<Spend[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSpends([]);
    setLoaded(false);
    setError(null);
    if (!enabled || !policy) return;

    let cancelled = false;
    let cursor: bigint | null = null;
    let tick = 0;
    let running = false;

    const step = async () => {
      if (running) return;
      running = true;
      try {
        const latest = await publicClient.getBlockNumber();
        const logs: RawLog[] = [];
        if (cursor === null || tick % ROUTESCAN_EVERY === 0) {
          logs.push(...(await fetchRoutescan(policy)));
        }
        // Lần đầu quét lại 100 block gần nhất, vì Routescan có thể chậm vài block so với chuỗi.
        const from: bigint = cursor === null ? (latest > 99n ? latest - 99n : 0n) : cursor + 1n;
        logs.push(...(await fetchRecent(policy, from, latest)));
        if (cancelled) return;
        cursor = latest;
        setSpends((prev) => mergeSpends(prev, logs));
        setLoaded(true);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message.split("\n")[0] : String(e));
      } finally {
        tick += 1;
        running = false;
      }
    };

    void step();
    const id = setInterval(() => void step(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, policy]);

  return { spends, loaded, error };
}
