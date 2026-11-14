// ABI cho phần ghi, event và custom error của AgentPolicy / AgentPolicyFactory (contracts/src/).
// Phần view dùng cho màn Tổng quan nằm ở policy.ts (agentPolicyAbi).

export const policyErrorsAbi = [
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
  { type: "error", name: "TransferFailed", inputs: [] },
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

export const policyEventsAbi = [
  {
    type: "event",
    name: "Authorized",
    inputs: [
      { name: "digest", type: "bytes32", indexed: true },
      { name: "payTo", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "validAfter", type: "uint256", indexed: false },
      { name: "validBefore", type: "uint256", indexed: false },
      { name: "nonce", type: "bytes32", indexed: false },
      { name: "isSandbox", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Released",
    inputs: [
      { name: "nonce", type: "bytes32", indexed: true },
      { name: "payTo", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "digest", type: "bytes32", indexed: true },
    ],
  },
] as const;

/** Các lệnh chủ ký trên policy (onlyOwner). */
export const policyOwnerAbi = [
  { type: "function", name: "pause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "unpause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "setWhitelist",
    stateMutability: "nonpayable",
    inputs: [
      { name: "payTo", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "whitelist",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  ...policyErrorsAbi,
] as const;

export const factoryAbi = [
  {
    type: "function",
    name: "createPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "perTxCap", type: "uint256" },
      { name: "dailyCap", type: "uint256" },
      { name: "sandboxPerTxCap", type: "uint256" },
      { name: "sandboxDailyCap", type: "uint256" },
      { name: "period", type: "uint256" },
    ],
    outputs: [{ name: "policyAddress", type: "address" }],
  },
  {
    type: "function",
    name: "getPoliciesByOwner",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "address[]" }],
  },
  { type: "error", name: "ZeroAddress", inputs: [] },
  ...policyErrorsAbi.filter((e) => e.name === "InvalidCaps" || e.name === "InvalidPeriod"),
] as const;
