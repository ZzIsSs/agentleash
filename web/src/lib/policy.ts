import { erc20Abi, formatUnits, type Address, type PublicClient } from "viem";

/** Các hàm view của AgentPolicy mà dashboard cần (contracts/src/AgentPolicy.sol). */
export const agentPolicyAbi = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "agent", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "period", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "perTxCap", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "dailyCap", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "sandboxPerTxCap", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "sandboxDailyCap", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "getRemainingCaps",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "remainingDaily", type: "uint256" },
      { name: "remainingSandboxDaily", type: "uint256" },
      { name: "currentPeriodStart", type: "uint256" },
    ],
  },
] as const;

export const USDC_DECIMALS = 6;

/** Số liệu thô đọc từ chain, chưa xử lý. */
export type PolicyRaw = {
  owner: Address;
  agent: Address;
  paused: boolean;
  period: bigint;
  perTxCap: bigint;
  dailyCap: bigint;
  sandboxPerTxCap: bigint;
  sandboxDailyCap: bigint;
  remainingDaily: bigint;
  remainingSandboxDaily: bigint;
  currentPeriodStart: bigint;
  balance: bigint;
  blockNumber: bigint;
};

export async function readPolicy(client: PublicClient, policy: Address, usdc: Address): Promise<PolicyRaw> {
  // Ghim cùng một block để mọi số trên màn hình nhất quán với nhau.
  const blockNumber = await client.getBlockNumber();
  const read = <F extends (typeof agentPolicyAbi)[number]["name"]>(functionName: F) =>
    client.readContract({ address: policy, abi: agentPolicyAbi, functionName, blockNumber });

  const [owner, agent, paused, period, perTxCap, dailyCap, sandboxPerTxCap, sandboxDailyCap, remaining, balance] =
    await Promise.all([
      read("owner"),
      read("agent"),
      read("paused"),
      read("period"),
      read("perTxCap"),
      read("dailyCap"),
      read("sandboxPerTxCap"),
      read("sandboxDailyCap"),
      read("getRemainingCaps"),
      client.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [policy], blockNumber }),
    ]);

  const [remainingDaily, remainingSandboxDaily, currentPeriodStart] = remaining as readonly [bigint, bigint, bigint];
  return {
    owner: owner as Address,
    agent: agent as Address,
    paused: paused as boolean,
    period: period as bigint,
    perTxCap: perTxCap as bigint,
    dailyCap: dailyCap as bigint,
    sandboxPerTxCap: sandboxPerTxCap as bigint,
    sandboxDailyCap: sandboxDailyCap as bigint,
    remainingDaily,
    remainingSandboxDaily,
    currentPeriodStart,
    balance,
    blockNumber,
  };
}

export type Meter = {
  cap: bigint;
  spent: bigint;
  /** Số còn được chi thật sự, đã tính ràng buộc chéo giữa hai tầng. */
  remaining: bigint;
  /** Phần đã chi trên trần, 0..1, để vẽ thanh. */
  usedRatio: number;
};

export type PolicyOverview = {
  status: "active" | "paused";
  trusted: Meter;
  sandbox: Meter;
  perTxCap: bigint;
  sandboxPerTxCap: bigint;
  /** Số tiền agent có thể chi ngay: không vượt hạn mức còn lại và không vượt số dư USDC. */
  spendableNow: bigint;
  balance: bigint;
  periodSeconds: number;
  /** Giây còn lại tới khi chu kỳ hồi hạn mức. */
  secondsToReset: number;
};

const min = (a: bigint, b: bigint) => (a < b ? a : b);
const ratio = (part: bigint, whole: bigint) => (whole === 0n ? 0 : Number((part * 10_000n) / whole) / 10_000);

/**
 * Ghép số thô thành số hiển thị. Theo AgentPolicy:
 * - dailyCap là trần chung cho cả hai tầng, sandboxDailyCap là trần riêng cho địa chỉ ngoài whitelist.
 * - Một khoản Sandbox bị chặn bởi cả hai, nên phần Sandbox còn lại = min(sandbox còn lại, chung còn lại).
 */
export function deriveOverview(raw: PolicyRaw, nowSeconds: number): PolicyOverview {
  const trustedSpent = raw.dailyCap - raw.remainingDaily;
  const sandboxSpent = raw.sandboxDailyCap - raw.remainingSandboxDaily;
  const sandboxRemaining = min(raw.remainingSandboxDaily, raw.remainingDaily);

  const periodEnd = Number(raw.currentPeriodStart + raw.period);
  const secondsToReset = Math.max(0, Math.min(Number(raw.period), periodEnd - Math.floor(nowSeconds)));

  return {
    status: raw.paused ? "paused" : "active",
    trusted: {
      cap: raw.dailyCap,
      spent: trustedSpent,
      remaining: raw.remainingDaily,
      usedRatio: ratio(trustedSpent, raw.dailyCap),
    },
    sandbox: {
      cap: raw.sandboxDailyCap,
      spent: sandboxSpent,
      remaining: sandboxRemaining,
      usedRatio: ratio(raw.sandboxDailyCap - sandboxRemaining, raw.sandboxDailyCap),
    },
    perTxCap: raw.perTxCap,
    sandboxPerTxCap: raw.sandboxPerTxCap,
    spendableNow: raw.paused ? 0n : min(raw.remainingDaily, raw.balance),
    balance: raw.balance,
    periodSeconds: Number(raw.period),
    secondsToReset,
  };
}

/** 2000n -> "0.002", 10000n -> "0.01", 0n -> "0". */
export const formatUsdc = (units: bigint) => formatUnits(units, USDC_DECIMALS);

/** 84 -> "01:24". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** 120 -> "120 giây", 86400 -> "1 ngày". */
export function formatPeriod(seconds: number): string {
  if (seconds % 86_400 === 0) return `${seconds / 86_400} ngày`;
  if (seconds % 3_600 === 0) return `${seconds / 3_600} giờ`;
  return `${seconds} giây`;
}
