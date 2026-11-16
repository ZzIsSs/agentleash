import { getAddress, isAddress, type Address, type Hex } from "viem";
import { CHAIN, FACTORY_ADDRESS } from "./chain";

export const ERC8004_REGISTRATION_TYPE = "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";

/** Topic0 của event Registered(uint256 indexed agentId, string agentURI, address indexed owner). */
export const REGISTERED_TOPIC = "0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a" as const;

export type AgentRegistrationService = {
  name: string;
  endpoint: string;
};

export type AgentRegistrationPayload = {
  type: typeof ERC8004_REGISTRATION_TYPE;
  name: string;
  description: string;
  services: AgentRegistrationService[];
  supportedTrust: string[];
  x_agentleash: {
    policyAddress: Address;
    agentAddress: Address;
    factoryAddress: Address;
  };
};

export type DecodedAgentUri = {
  name: string | null;
  description: string | null;
  agentWallet: string | null;
  policyAddress: string | null;
  supportedTrust: string[];
  rawUri: string;
};

export type RegisteredIdentityLog = {
  agentId: bigint;
  owner: Address;
  txHash: Hex;
  blockNumber: bigint;
};

function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/** Tạo payload JSON chuẩn ERC-8004 registration-v1 (không chứa email/PII theo Luật 5). */
export function buildAgentRegistrationPayload(params: {
  name: string;
  description?: string;
  agentAddress: Address;
  policyAddress: Address;
  chainId?: number;
}): AgentRegistrationPayload {
  const chainId = params.chainId ?? CHAIN.id;
  const agent = getAddress(params.agentAddress);
  const policy = getAddress(params.policyAddress);
  return {
    type: ERC8004_REGISTRATION_TYPE,
    name: params.name.trim() || "AgentLeash Pay Agent",
    description:
      params.description?.trim() ||
      "AI Agent chi tiêu x402 có policy guardrails (hạn mức 2 tầng, whitelist, kill switch) trên Avalanche Fuji.",
    services: [
      { name: "agentWallet", endpoint: `eip155:${chainId}:${agent}` },
      { name: "x402-policy", endpoint: `eip155:${chainId}:${policy}` },
    ],
    supportedTrust: ["policy-guardrail", "eip-3009", "erc-1271"],
    x_agentleash: {
      policyAddress: policy,
      agentAddress: agent,
      factoryAddress: FACTORY_ADDRESS,
    },
  };
}

/** Mã hóa payload thành data URI base64 hợp lệ cho ERC-8004 register(string agentURI). */
export function encodeAgentRegistrationUri(payload: AgentRegistrationPayload): string {
  return `data:application/json;base64,${encodeBase64Utf8(JSON.stringify(payload))}`;
}

/** Giải mã tokenURI / agentURI từ ERC-8004 IdentityRegistry về dữ liệu an toàn cho UI. */
export function decodeAgentRegistrationUri(uri: string): DecodedAgentUri {
  const trimmed = uri.trim();
  const base: DecodedAgentUri = {
    name: null,
    description: null,
    agentWallet: null,
    policyAddress: null,
    supportedTrust: [],
    rawUri: trimmed,
  };

  let rawJson: string | null = null;
  if (trimmed.startsWith("data:application/json;base64,")) {
    try {
      rawJson = decodeBase64Utf8(trimmed.slice("data:application/json;base64,".length));
    } catch {
      return base;
    }
  } else if (trimmed.startsWith("data:application/json,")) {
    try {
      rawJson = decodeURIComponent(trimmed.slice("data:application/json,".length));
    } catch {
      return base;
    }
  }

  if (!rawJson) return base;

  try {
    const doc = JSON.parse(rawJson) as Record<string, unknown>;
    const services = Array.isArray(doc.services) ? (doc.services as Array<Record<string, unknown>>) : [];
    const walletSvc = services.find((s) => s?.name === "agentWallet" && typeof s.endpoint === "string");
    const extra = (doc.x_agentleash && typeof doc.x_agentleash === "object"
      ? doc.x_agentleash
      : null) as Record<string, unknown> | null;
    const rawPolicy = extra?.policyAddress;
    return {
      name: typeof doc.name === "string" ? doc.name : null,
      description: typeof doc.description === "string" ? doc.description : null,
      agentWallet: typeof walletSvc?.endpoint === "string" ? walletSvc.endpoint : null,
      policyAddress: typeof rawPolicy === "string" && isAddress(rawPolicy) ? getAddress(rawPolicy) : null,
      supportedTrust: Array.isArray(doc.supportedTrust)
        ? doc.supportedTrust.filter((x): x is string => typeof x === "string")
        : [],
      rawUri: trimmed,
    };
  } catch {
    return base;
  }
}

export type RawLogItem = {
  topics: readonly string[];
  transactionHash?: string;
  blockNumber?: string | bigint;
};

/** Lọc event Registered(uint256 indexed agentId, string agentURI, address indexed owner), giữ bản mới nhất mỗi agentId. */
export function parseRegisteredLogs(
  logs: readonly RawLogItem[],
  filterOwner?: Address,
): RegisteredIdentityLog[] {
  const targetOwner = filterOwner ? getAddress(filterOwner).toLowerCase() : null;
  const byId = new Map<string, RegisteredIdentityLog>();

  for (const log of logs) {
    if (!log.topics || log.topics.length < 3) continue;
    if (log.topics[0]?.toLowerCase() !== REGISTERED_TOPIC) continue;
    const topicOwnerHex = `0x${log.topics[2].slice(-40)}`;
    if (!isAddress(topicOwnerHex, { strict: false })) continue;
    const owner = getAddress(topicOwnerHex);
    if (targetOwner && owner.toLowerCase() !== targetOwner) continue;

    try {
      const agentId = BigInt(log.topics[1]);
      const blockNumber =
        typeof log.blockNumber === "bigint"
          ? log.blockNumber
          : log.blockNumber
            ? BigInt(log.blockNumber)
            : 0n;
      const txHash = (log.transactionHash ?? "0x") as Hex;
      byId.set(agentId.toString(), { agentId, owner, txHash, blockNumber });
    } catch {
      continue;
    }
  }

  return [...byId.values()].sort((a, b) => (a.agentId > b.agentId ? -1 : a.agentId < b.agentId ? 1 : 0));
}
