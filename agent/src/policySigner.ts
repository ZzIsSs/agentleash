// Source inspired by x402-pay-per-request and adapted for AgentLeash ERC-1271 policy authorization
import {
  hashTypedData,
  createWalletClient,
  createPublicClient,
  http,
  publicActions,
  type Address,
  type Hex,
  type TypedDataDefinition,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";

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

export interface PolicySignerOptions {
  policyAddress: Address;
  agentPrivateKey: Hex;
  rpcUrl?: string;
}

export function createSpikePolicySigner(options: PolicySignerOptions) {
  const { policyAddress, agentPrivateKey } = options;
  const rpcUrl = options.rpcUrl || process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";

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
      // 1. Calculate the exact EIP-712 digest
      const digest = hashTypedData({
        domain: params.domain as TypedDataDefinition["domain"],
        types: params.types as TypedDataDefinition["types"],
        primaryType: params.primaryType,
        message: params.message,
      });

      console.log(`[PolicySigner] Calculated EIP-712 digest: ${digest}`);
      console.log(`[PolicySigner] Approving digest on SpikePolicy (${policyAddress}) using agent ${agentAccount.address}...`);

      // 2. Submit approve(digest) on-chain from the authorized agent
      const txHash = await client.writeContract({
        address: policyAddress,
        abi: spikePolicyAbi,
        functionName: "approve",
        args: [digest],
      });

      console.log(`[PolicySigner] Submitted approve tx: ${txHash}. Waiting for receipt...`);
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status !== "success") {
        throw new Error(`[PolicySigner] approve tx failed: ${txHash}`);
      }

      console.log(`[PolicySigner] Digest approved on-chain in block ${receipt.blockNumber}`);

      // 3. Return dummy/empty signature for ERC-1271 (USDC verifies with SpikePolicy.isValidSignature)
      return "0x";
    },
    async readContract(args: {
      address: Address;
      abi: readonly unknown[];
      functionName: string;
      args?: readonly unknown[];
    }) {
      return client.readContract(args as any);
    },
  };
}
