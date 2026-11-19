import { decodeEventLog, getAddress, isAddress, toEventSelector, zeroAddress, type Address, type Hex } from "viem";
import { policyEventsAbi } from "./abi";
import { shortAddress } from "./chain";

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
export const WHITELIST_CHANGED_TOPIC = toEventSelector(policyEventsAbi[2]);

type Decoded =
  | { kind: "authorized"; spend: Spend }
  | { kind: "released"; nonce: Hex }
  | { kind: "whitelist"; target: Address; allowed: boolean }
  | null;

export function decodePolicyLog(log: RawLog): Decoded {
  const topic0 = log.topics[0]?.toLowerCase();
  if (topic0 !== AUTHORIZED_TOPIC && topic0 !== RELEASED_TOPIC && topic0 !== WHITELIST_CHANGED_TOPIC) return null;
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
    if (decoded.eventName === "WhitelistChanged") {
      return {
        kind: "whitelist",
        target: getAddress(decoded.args.target),
        allowed: decoded.args.allowed,
      };
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
    if (d.kind !== "authorized") continue;
    const old = byKey.get(d.spend.key);
    byKey.set(d.spend.key, { ...d.spend, timestamp: d.spend.timestamp ?? old?.timestamp ?? null });
  }

  return [...byKey.values()]
    .map((s) => (released.has(s.nonce.toLowerCase()) ? { ...s, released: true } : s))
    .sort((a, b) =>
      a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1,
    );
}

/** Trích các địa chỉ từng có sự kiện WhitelistChanged để bảng [3] luôn hiển thị và gỡ được cả địa chỉ ngoài KNOWN_SELLERS. */
export function extractWhitelistTargets(previous: readonly Address[], logs: readonly RawLog[]): Address[] {
  const unique = new Map<string, Address>();
  for (const addr of previous) {
    const norm = getAddress(addr);
    unique.set(norm.toLowerCase(), norm);
  }
  for (const log of logs) {
    const d = decodePolicyLog(log);
    if (d?.kind === "whitelist") {
      unique.set(d.target.toLowerCase(), d.target);
    }
  }
  return [...unique.values()];
}

/**
 * Chọn block bắt đầu quét RPC ở lần tải đầu tiên:
 * nối tiếp ngay sau block cuối mà Routescan trả về (tối đa lùi 500 block theo giới hạn `blockRanges`).
 */
export function initialRpcScanFrom(
  latest: bigint,
  routescanLogs: readonly { blockNumber: bigint | null }[],
  size = 100n,
  maxChunks = 5,
): bigint {
  const span = size * BigInt(maxChunks);
  const floor = latest >= span ? latest - span + 1n : 0n;
  const maxRoutescanBlock = routescanLogs.reduce<bigint | null>(
    (max, log) => (log.blockNumber !== null && (max === null || log.blockNumber > max) ? log.blockNumber : max),
    null,
  );
  if (maxRoutescanBlock === null) return floor;
  const afterRoutescan = maxRoutescanBlock + 1n;
  return afterRoutescan > floor ? afterRoutescan : floor;
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

export const WEATHER_SELLER_ADDRESS = "0x9d014376c3296db41770015af074cf4d14c075e1";
export const RATES_SELLER_ADDRESS = "0x8d299966b407e9f189c1920f5a7324f13a9a4110";

/** Hai API bán dữ liệu của demo (sellers/weather.mjs, sellers/rates.mjs). */
export const KNOWN_SELLERS: Record<string, string> = {
  [WEATHER_SELLER_ADDRESS]: "API Thời tiết",
  [RATES_SELLER_ADDRESS]: "API Tỷ giá",
};

export const sellerName = (payTo: string): string | null => KNOWN_SELLERS[payTo.toLowerCase()] ?? null;

export const totalSpent = (spends: readonly Spend[]): bigint =>
  spends.reduce((sum, s) => (s.released ? sum : sum + s.amount), 0n);

export type FlowTier = "trusted" | "sandbox" | "mixed" | "idle";

export type FlowTargetId = "weather" | "rates" | "unknown" | `trusted:${string}`;

export type FlowNodeSummary = {
  id: FlowTargetId;
  label: string;
  payTo?: Address;
  amount: bigint;
  trustedAmount: bigint;
  sandboxAmount: bigint;
  count: number;
  tier: FlowTier;
  /** Tỷ trọng chi tiêu trên tổng đã chi (0..1). */
  share: number;
  /** Độ dày đường nối SVG (px): 1.5 khi chưa chi, 2.5..8.5 theo tỷ lệ USDC đã chi. */
  strokeWidth: number;
};

export type SpendFlowSummary = {
  totalAmount: bigint;
  totalCount: number;
  nodes: readonly FlowNodeSummary[];
};

export type SummarizeSpendFlowsOptions = {
  whitelist?: Record<string, boolean> | null;
  aliases?: Record<string, string> | null;
};

type FlowBucket = {
  label: string;
  payTo?: Address;
  amount: bigint;
  trustedAmount: bigint;
  sandboxAmount: bigint;
  count: number;
};

/**
 * Gom tổng USDC đã chi (loại khoản đã released) từ danh sách `spends` để vẽ sơ đồ Agent → Policy → API.
 * Luôn giữ Thời tiết, Tỷ giá và Địa chỉ lạ; các địa chỉ ngoài `KNOWN_SELLERS` nhưng đã whitelist (`whitelist[addr] === true`)
 * được tách thành node riêng màu xanh (`tier: "trusted"`) kèm tên alias nếu có.
 */
export function summarizeSpendFlows(
  spends: readonly Spend[],
  options?: SummarizeSpendFlowsOptions,
): SpendFlowSummary {
  const weatherBucket: FlowBucket = {
    label: "Thời tiết",
    amount: 0n,
    trustedAmount: 0n,
    sandboxAmount: 0n,
    count: 0,
  };
  const ratesBucket: FlowBucket = {
    label: "Tỷ giá",
    amount: 0n,
    trustedAmount: 0n,
    sandboxAmount: 0n,
    count: 0,
  };
  const unknownBucket: FlowBucket = {
    label: "Địa chỉ lạ",
    amount: 0n,
    trustedAmount: 0n,
    sandboxAmount: 0n,
    count: 0,
  };

  const aliasMap = new Map<string, string>();
  if (options?.aliases) {
    for (const [rawAddr, rawAlias] of Object.entries(options.aliases)) {
      const trimmed = typeof rawAlias === "string" ? rawAlias.trim().replace(/\s+/g, " ") : "";
      if (trimmed) aliasMap.set(rawAddr.trim().toLowerCase(), trimmed);
    }
  }

  const customBuckets = new Map<string, FlowBucket>();
  if (options?.whitelist) {
    for (const [rawAddr, allowed] of Object.entries(options.whitelist)) {
      if (!allowed) continue;
      const lowerRaw = rawAddr.trim().toLowerCase();
      if (!isAddress(lowerRaw, { strict: false })) continue;
      const checksum = getAddress(lowerRaw);
      if (checksum === zeroAddress) continue;
      const lower = checksum.toLowerCase();
      if (lower === WEATHER_SELLER_ADDRESS || lower === RATES_SELLER_ADDRESS) continue;
      if (customBuckets.has(lower)) continue;
      customBuckets.set(lower, {
        label: aliasMap.get(lower) ?? shortAddress(checksum),
        payTo: checksum,
        amount: 0n,
        trustedAmount: 0n,
        sandboxAmount: 0n,
        count: 0,
      });
    }
  }

  let totalAmount = 0n;
  let totalCount = 0;

  for (const s of spends) {
    if (s.released) continue;
    const addr = s.payTo.toLowerCase();
    const bucket =
      addr === WEATHER_SELLER_ADDRESS
        ? weatherBucket
        : addr === RATES_SELLER_ADDRESS
          ? ratesBucket
          : (customBuckets.get(addr) ?? unknownBucket);

    bucket.amount += s.amount;
    bucket.count += 1;
    if (s.isSandbox) bucket.sandboxAmount += s.amount;
    else bucket.trustedAmount += s.amount;
    totalAmount += s.amount;
    totalCount += 1;
  }

  const finalizeNode = (
    id: FlowTargetId,
    b: FlowBucket,
    forcedTier?: FlowTier,
  ): FlowNodeSummary => {
    const tier: FlowTier =
      forcedTier ??
      (b.amount === 0n
        ? "idle"
        : b.sandboxAmount === 0n
          ? "trusted"
          : b.trustedAmount === 0n
            ? "sandbox"
            : "mixed");
    const share = totalAmount === 0n || b.amount === 0n ? 0 : Number((b.amount * 10_000n) / totalAmount) / 10_000;
    const strokeWidth = b.amount === 0n ? 1.5 : Number((2.5 + share * 6).toFixed(2));
    return {
      id,
      label: b.label,
      ...(b.payTo ? { payTo: b.payTo } : {}),
      amount: b.amount,
      trustedAmount: b.trustedAmount,
      sandboxAmount: b.sandboxAmount,
      count: b.count,
      tier,
      share,
      strokeWidth,
    };
  };

  const customNodes = [...customBuckets.entries()]
    .map(([lower, b]) => finalizeNode(`trusted:${lower}`, b, "trusted"))
    .sort((a, b) => {
      if (a.amount !== b.amount) return a.amount > b.amount ? -1 : 1;
      const byName = a.label.localeCompare(b.label, "vi");
      return byName !== 0 ? byName : a.id.localeCompare(b.id);
    });

  return {
    totalAmount,
    totalCount,
    nodes: [
      finalizeNode("weather", weatherBucket),
      finalizeNode("rates", ratesBucket),
      ...customNodes,
      finalizeNode("unknown", unknownBucket),
    ],
  };
}
