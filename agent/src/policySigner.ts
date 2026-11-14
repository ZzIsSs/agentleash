// Source inspired by x402-pay-per-request and adapted for AgentLeash ERC-1271 policy authorization
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  isAddress,
  publicActions,
  type Address,
  type Hex,
  type TypedDataDefinition,
  hashTypedData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";

export const DEFAULT_FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";
export const DEFAULT_FUJI_USDC = "0x5425890298aed601595a70AB815c96711a31Bc65" as Address;

export const agentPolicyAbi = [
  {
    type: "function",
    name: "authorize",
    inputs: [
      { name: "payTo", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ name: "digest", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isValidSignature",
    inputs: [
      { name: "hash", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes4" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRemainingCaps",
    inputs: [],
    outputs: [
      { name: "remainingDaily", type: "uint256" },
      { name: "remainingSandboxDaily", type: "uint256" },
      { name: "currentPeriodStart", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "perTxCap",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "dailyCap",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "sandboxPerTxCap",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "sandboxDailyCap",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "whitelist",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "paused",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  { type: "error", name: "Unauthorized", inputs: [] },
  { type: "error", name: "PausedError", inputs: [] },
  { type: "error", name: "NotPausedError", inputs: [] },
  { type: "error", name: "ZeroAddress", inputs: [] },
  { type: "error", name: "ZeroAmount", inputs: [] },
  { type: "error", name: "InvalidCaps", inputs: [] },
  { type: "error", name: "InvalidPeriod", inputs: [] },
  { type: "error", name: "InvalidTimeBounds", inputs: [] },
  { type: "error", name: "AlreadyApproved", inputs: [] },
  { type: "error", name: "NotApproved", inputs: [] },
  { type: "error", name: "NotExpired", inputs: [] },
  { type: "error", name: "AlreadyUsedOnChain", inputs: [] },
  {
    type: "error",
    name: "ExceedsPerTxCap",
    inputs: [
      { name: "requested", type: "uint256" },
      { name: "cap", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ExceedsDailyCap",
    inputs: [
      { name: "requestedTotal", type: "uint256" },
      { name: "cap", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ExceedsSandboxPerTxCap",
    inputs: [
      { name: "requested", type: "uint256" },
      { name: "cap", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ExceedsSandboxDailyCap",
    inputs: [
      { name: "requestedTotal", type: "uint256" },
      { name: "cap", type: "uint256" },
    ],
  },
] as const;

export const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const spikePolicyAbi = [
  {
    type: "function",
    name: "approve",
    inputs: [{ name: "digest", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isValidSignature",
    inputs: [
      { name: "hash", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes4" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approved",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;

export interface PolicyAuthorizationEvent {
  txHash: Hex;
  payTo: Address;
  amount: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
  blockNumber: bigint;
}

export interface PolicySignerOptions {
  policyAddress: Address;
  agentPrivateKey: Hex;
  rpcUrl?: string;
  onAuthorized?: (event: PolicyAuthorizationEvent) => void;
  onRejected?: (error: PolicyOnChainRejectedError) => void;
}

export interface PolicyRevertDetail {
  errorName: string;
  reason: string;
}

export class PolicyOnChainRejectedError extends Error {
  readonly errorName: string;
  readonly reason: string;

  constructor(detail: PolicyRevertDetail, cause?: unknown) {
    super(`[OnChainPolicy:${detail.errorName}] ${detail.reason}`, { cause });
    this.name = "PolicyOnChainRejectedError";
    this.errorName = detail.errorName;
    this.reason = detail.reason;
  }
}

function mapPolicyErrorNameToVietnamese(
  errorName: string,
  args?: readonly unknown[],
): PolicyRevertDetail {
  const fmt = (val: unknown) => {
    try {
      return `${formatUnits(BigInt(val as string | number | bigint), 6)} USDC`;
    } catch {
      return String(val);
    }
  };

  switch (errorName) {
    case "ExceedsDailyCap": {
      const detail =
        args && args.length >= 2
          ? ` (tổng yêu cầu ${fmt(args[0])} > trần chu kỳ ${fmt(args[1])})`
          : "";
      return {
        errorName,
        reason: `Vượt hạn mức chi tiêu trong chu kỳ (dailyCap)${detail}`,
      };
    }
    case "ExceedsPerTxCap": {
      const detail =
        args && args.length >= 2
          ? ` (yêu cầu ${fmt(args[0])} > trần mỗi giao dịch ${fmt(args[1])})`
          : "";
      return {
        errorName,
        reason: `Vượt hạn mức mỗi giao dịch cho địa chỉ Trusted (perTxCap)${detail}`,
      };
    }
    case "ExceedsSandboxPerTxCap": {
      const detail =
        args && args.length >= 2
          ? ` (yêu cầu ${fmt(args[0])} > trần Sandbox ${fmt(args[1])})`
          : "";
      return {
        errorName,
        reason: `Vượt trần Sandbox mỗi giao dịch cho địa chỉ ngoài whitelist (sandboxPerTxCap)${detail}`,
      };
    }
    case "ExceedsSandboxDailyCap": {
      const detail =
        args && args.length >= 2
          ? ` (tổng Sandbox ${fmt(args[0])} > trần chu kỳ Sandbox ${fmt(args[1])})`
          : "";
      return {
        errorName,
        reason: `Vượt tổng trần Sandbox trong chu kỳ (sandboxDailyCap)${detail}`,
      };
    }
    case "PausedError":
      return {
        errorName,
        reason: "Agent đang bị khóa khẩn cấp bởi Kill Switch (paused = true)",
      };
    case "Unauthorized":
      return {
        errorName,
        reason: "Ví Agent không được ủy quyền trên hợp đồng AgentPolicy",
      };
    case "InvalidTimeBounds":
      return {
        errorName,
        reason: "Khoảng thời gian hiệu lực (validAfter/validBefore) của ủy quyền không hợp lệ",
      };
    case "AlreadyApproved":
      return {
        errorName,
        reason: "Ủy quyền với digest/nonce này đã được duyệt trước đó",
      };
    default:
      return {
        errorName,
        reason: `Hợp đồng AgentPolicy từ chối giao dịch (${errorName})`,
      };
  }
}

/**
 * Decodes a viem/contract revert error from AgentPolicy into a clear Vietnamese explanation.
 */
export function formatPolicyRevertReason(err: unknown): PolicyRevertDetail {
  if (err instanceof PolicyOnChainRejectedError) {
    return { errorName: err.errorName, reason: err.reason };
  }

  if (err instanceof BaseError) {
    const revertErr = err.walk(
      (e) => e instanceof ContractFunctionRevertedError,
    );
    if (revertErr instanceof ContractFunctionRevertedError && revertErr.data) {
      return mapPolicyErrorNameToVietnamese(
        revertErr.data.errorName,
        revertErr.data.args,
      );
    }
  }

  const rawMsg = String((err as { shortMessage?: string; message?: string })?.shortMessage || (err as { message?: string })?.message || err);
  const knownErrors = [
    "ExceedsDailyCap",
    "ExceedsPerTxCap",
    "ExceedsSandboxPerTxCap",
    "ExceedsSandboxDailyCap",
    "PausedError",
    "Unauthorized",
    "InvalidTimeBounds",
    "AlreadyApproved",
  ];
  for (const name of knownErrors) {
    if (rawMsg.includes(name)) {
      return mapPolicyErrorNameToVietnamese(name);
    }
  }

  return {
    errorName: "ContractRevert",
    reason: `Giao dịch bị từ chối trên chuỗi: ${rawMsg}`,
  };
}

export function extractEip3009AuthParams(message: Record<string, unknown>): {
  payTo: Address;
  amount: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
} {
  const to = String(message.to || "");
  if (!isAddress(to)) {
    throw new Error(`[PolicySigner] Invalid EIP-3009 'to' address: ${to}`);
  }

  const rawValue = message.value;
  const rawValidAfter = message.validAfter ?? 0;
  const rawValidBefore = message.validBefore;
  const rawNonce = String(message.nonce || "");

  if (rawValue === undefined || rawValidBefore === undefined) {
    throw new Error("[PolicySigner] Missing value or validBefore in EIP-3009 typed message.");
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(rawNonce)) {
    throw new Error(`[PolicySigner] Invalid bytes32 nonce: ${rawNonce}`);
  }

  return {
    payTo: to as Address,
    amount: BigInt(rawValue as string | number | bigint),
    validAfter: BigInt(rawValidAfter as string | number | bigint),
    validBefore: BigInt(rawValidBefore as string | number | bigint),
    nonce: rawNonce as Hex,
  };
}

/**
 * Creates an x402-compatible EVM signer backed by the official AgentPolicy smart contract.
 * signTypedData calls AgentPolicy.authorize(...) on-chain and returns "0x" for ERC-1271.
 */
export function createAgentPolicySigner(options: PolicySignerOptions) {
  const { policyAddress, agentPrivateKey, onAuthorized, onRejected } = options;
  const rpcUrl = options.rpcUrl || process.env.FUJI_RPC_URL || DEFAULT_FUJI_RPC;

  const agentAccount = privateKeyToAccount(agentPrivateKey);
  const client = createWalletClient({
    account: agentAccount,
    chain: avalancheFuji,
    transport: http(rpcUrl),
  }).extend(publicActions);

  return {
    address: policyAddress,
    agentAddress: agentAccount.address,
    async signTypedData(params: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }): Promise<Hex> {
      const { payTo, amount, validAfter, validBefore, nonce } =
        extractEip3009AuthParams(params.message);

      console.log(
        `[PolicySigner] Requesting AgentPolicy.authorize(${payTo}, ${formatUnits(amount, 6)} USDC) from agent ${agentAccount.address}...`,
      );

      let txHash: Hex;
      try {
        txHash = await client.writeContract({
          address: policyAddress,
          abi: agentPolicyAbi,
          functionName: "authorize",
          args: [payTo, amount, validAfter, validBefore, nonce],
        });
      } catch (err) {
        const detail = formatPolicyRevertReason(err);
        const rejected = new PolicyOnChainRejectedError(detail, err);
        onRejected?.(rejected);
        throw rejected;
      }

      console.log(`[PolicySigner] Submitted authorize tx: ${txHash}. Waiting for receipt...`);
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status !== "success") {
        const rejected = new PolicyOnChainRejectedError({
          errorName: "TransactionReverted",
          reason: `Giao dịch authorize thất bại trên chuỗi (${txHash})`,
        });
        onRejected?.(rejected);
        throw rejected;
      }

      console.log(
        `[PolicySigner] Authorized on-chain in block ${receipt.blockNumber} (tx: ${txHash})`,
      );

      onAuthorized?.({
        txHash,
        payTo,
        amount,
        validAfter,
        validBefore,
        nonce,
        blockNumber: receipt.blockNumber,
      });

      // Return empty signature for ERC-1271 (USDC verifies via AgentPolicy.isValidSignature)
      return "0x";
    },
    async readContract(args: {
      address: Address;
      abi: readonly unknown[];
      functionName: string;
      args?: readonly unknown[];
    }) {
      return client.readContract(args as never);
    },
  };
}

export interface AgentPolicyStatus {
  policyAddress: Address;
  usdcBalanceUnits: bigint;
  perTxCapUnits: bigint;
  dailyCapUnits: bigint;
  sandboxPerTxCapUnits: bigint;
  sandboxDailyCapUnits: bigint;
  remainingDailyUnits: bigint;
  remainingSandboxDailyUnits: bigint;
  currentPeriodStart: bigint;
  paused: boolean;
}

export async function readPolicyStatus(
  policyAddress: Address,
  usdcAddress: Address = DEFAULT_FUJI_USDC,
  rpcUrl: string = process.env.FUJI_RPC_URL || DEFAULT_FUJI_RPC,
): Promise<AgentPolicyStatus> {
  const client = createPublicClient({
    chain: avalancheFuji,
    transport: http(rpcUrl),
  });

  const [
    usdcBalanceUnits,
    perTxCapUnits,
    dailyCapUnits,
    sandboxPerTxCapUnits,
    sandboxDailyCapUnits,
    remainingTuple,
    paused,
  ] = await Promise.all([
    client.readContract({
      address: usdcAddress,
      abi: erc20BalanceAbi,
      functionName: "balanceOf",
      args: [policyAddress],
    }),
    client.readContract({
      address: policyAddress,
      abi: agentPolicyAbi,
      functionName: "perTxCap",
    }),
    client.readContract({
      address: policyAddress,
      abi: agentPolicyAbi,
      functionName: "dailyCap",
    }),
    client.readContract({
      address: policyAddress,
      abi: agentPolicyAbi,
      functionName: "sandboxPerTxCap",
    }),
    client.readContract({
      address: policyAddress,
      abi: agentPolicyAbi,
      functionName: "sandboxDailyCap",
    }),
    client.readContract({
      address: policyAddress,
      abi: agentPolicyAbi,
      functionName: "getRemainingCaps",
    }),
    client.readContract({
      address: policyAddress,
      abi: agentPolicyAbi,
      functionName: "paused",
    }),
  ]);

  return {
    policyAddress,
    usdcBalanceUnits,
    perTxCapUnits,
    dailyCapUnits,
    sandboxPerTxCapUnits,
    sandboxDailyCapUnits,
    remainingDailyUnits: remainingTuple[0],
    remainingSandboxDailyUnits: remainingTuple[1],
    currentPeriodStart: remainingTuple[2],
    paused,
  };
}

/**
 * Legacy Phase 0 SpikePolicy signer kept for spikePay.ts compatibility.
 */
export function createSpikePolicySigner(options: PolicySignerOptions) {
  const { policyAddress, agentPrivateKey } = options;
  const rpcUrl = options.rpcUrl || process.env.FUJI_RPC_URL || DEFAULT_FUJI_RPC;

  const agentAccount = privateKeyToAccount(agentPrivateKey);
  const client = createWalletClient({
    account: agentAccount,
    chain: avalancheFuji,
    transport: http(rpcUrl),
  }).extend(publicActions);

  return {
    address: policyAddress,
    async signTypedData(params: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }): Promise<Hex> {
      const digest = hashTypedData({
        domain: params.domain as TypedDataDefinition["domain"],
        types: params.types as TypedDataDefinition["types"],
        primaryType: params.primaryType,
        message: params.message,
      });

      const txHash = await client.writeContract({
        address: policyAddress,
        abi: spikePolicyAbi,
        functionName: "approve",
        args: [digest],
      });

      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") {
        throw new Error(`[SpikePolicySigner] approve tx failed: ${txHash}`);
      }

      return "0x";
    },
    async readContract(args: {
      address: Address;
      abi: readonly unknown[];
      functionName: string;
      args?: readonly unknown[];
    }) {
      return client.readContract(args as never);
    },
  };
}
