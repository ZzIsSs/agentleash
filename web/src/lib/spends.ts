import { decodeEventLog, getAddress, toEventSelector, type Address, type Hex } from "viem";
import { policyEventsAbi } from "./abi";

/** Một khoản chi đã được policy duyệt (event Authorized). */
export type Spend = {
  /** txHash:logIndex, dùng để khử trùng khi gộp dữ liệu Routescan và RPC. */
  key: string;
  txHash: Hex;
  blockNumber: bigint;
  logIndex: number;
  /** Giây Unix; null khi chưa lấy được thời gian của block. */
  timestamp: number | null;
  payTo: Address;
  amount: bigint;
  isSandbox: boolean;
  nonce: Hex;
  digest: Hex;
  /** true khi đã có event Released cùng nonce: khoản này không được thanh toán và hạn mức đã được hoàn. */
  released: boolean;
};

/** Log thô, đủ trường chung cho cả viem getLogs lẫn Routescan. */
export type RawLog = {
  topics: readonly Hex[];
  data: Hex;
  transactionHash: Hex | null;
  blockNumber: bigint | null;
  logIndex: number | null;
  timestamp?: number | null;
};

export const AUTHORIZED_TOPIC = toEventSelector(policyEventsAbi[0]);
export const RELEASED_TOPIC = toEventSelector(policyEventsAbi[1]);

type Decoded =
  | { kind: "authorized"; spend: Spend }
  | { kind: "released"; nonce: Hex }
  | null;

export function decodePolicyLog(log: RawLog): Decoded {
  const topic0 = log.topics[0]?.toLowerCase();
  if (topic0 !== AUTHORIZED_TOPIC && topic0 !== RELEASED_TOPIC) return null;
  if (!log.transactionHash || log.blockNumber === null || log.logIndex === null) return null;

  try {
    const decoded = decodeEventLog({
      abi: policyEventsAbi,
      data: log.data,
      topics: log.topics as [Hex, ...Hex[]],
    });
    if (decoded.eventName === "Released") {
      return { kind: "released", nonce: decoded.args.nonce };
    }
    const a = decoded.args;
    return {
      kind: "authorized",
      spend: {
        key: `${log.transactionHash.toLowerCase()}:${log.logIndex}`,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        timestamp: log.timestamp ?? null,
        payTo: getAddress(a.payTo),
        amount: a.amount,
        isSandbox: a.isSandbox,
        nonce: a.nonce,
        digest: a.digest,
        released: false,
      },
    };
  } catch {
    return null;
  }
}

/** Kết quả `module=logs&action=getLogs` của Routescan: mọi số là chuỗi hex, logIndex 0 có thể là "0x". */
export type RoutescanLog = {
  topics: Hex[];
  data: Hex;
  blockNumber: string;
  timeStamp: string;
  logIndex: string;
  transactionHash: Hex;
};

const hexNumber = (value: string | undefined): bigint | null => {
  if (value === undefined || value === null) return null;
  if (value === "0x" || value === "") return 0n;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

export function fromRoutescan(log: RoutescanLog): RawLog {
  const block = hexNumber(log.blockNumber);
  const index = hexNumber(log.logIndex);
  const time = hexNumber(log.timeStamp);
  return {
    topics: log.topics,
    data: log.data,
    transactionHash: log.transactionHash,
    blockNumber: block,
    logIndex: index === null ? null : Number(index),
    timestamp: time === null ? null : Number(time),
  };
}

/**
 * Gộp khoản chi mới vào danh sách cũ: khử trùng theo key, giữ timestamp đã biết,
 * đánh dấu khoản có nonce đã Released, xếp mới nhất lên trên.
 */
export function mergeSpends(previous: readonly Spend[], logs: readonly RawLog[]): Spend[] {
  const byKey = new Map(previous.map((s) => [s.key, s]));
  const released = new Set(previous.filter((s) => s.released).map((s) => s.nonce.toLowerCase()));

  for (const log of logs) {
    const d = decodePolicyLog(log);
    if (!d) continue;
    if (d.kind === "released") {
      released.add(d.nonce.toLowerCase());
      continue;
    }
    const old = byKey.get(d.spend.key);
    byKey.set(d.spend.key, { ...d.spend, timestamp: d.spend.timestamp ?? old?.timestamp ?? null });
  }

  return [...byKey.values()]
    .map((s) => (released.has(s.nonce.toLowerCase()) ? { ...s, released: true } : s))
    .sort((a, b) =>
      a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1,
    );
}

/**
 * Chia đoạn [from, to] thành các khoảng tối đa `size` block (RPC Fuji: 100), tối đa `maxChunks` khoảng.
 * Nếu bị bỏ xa hơn thế thì chỉ quét phần gần nhất; phần cũ hơn do Routescan lo.
 */
export function blockRanges(from: bigint, to: bigint, size = 100n, maxChunks = 5): Array<[bigint, bigint]> {
  if (to < from) return [];
  const span = size * BigInt(maxChunks);
  const start = to - from + 1n > span ? to - span + 1n : from;
  const ranges: Array<[bigint, bigint]> = [];
  for (let lo = start; lo <= to; lo += size) {
    const hi = lo + size - 1n > to ? to : lo + size - 1n;
    ranges.push([lo, hi]);
  }
  return ranges;
}

/** Hai API bán dữ liệu của demo (sellers/weather.mjs, sellers/rates.mjs). */
export const KNOWN_SELLERS: Record<string, string> = {
  "0x9d014376c3296db41770015af074cf4d14c075e1": "API Thời tiết",
  "0x8d299966b407e9f189c1920f5a7324f13a9a4110": "API Tỷ giá",
};

export const sellerName = (payTo: string): string | null => KNOWN_SELLERS[payTo.toLowerCase()] ?? null;

export const totalSpent = (spends: readonly Spend[]): bigint =>
  spends.reduce((sum, s) => (s.released ? sum : sum + s.amount), 0n);
