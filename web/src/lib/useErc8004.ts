"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import { erc8004RegistryAbi } from "./abi";
import { ERC8004_IDENTITY_REGISTRY_ADDRESS, ROUTESCAN_API, publicClient } from "./chain";
import {
  REGISTERED_TOPIC,
  decodeAgentRegistrationUri,
  parseRegisteredLogs,
  type DecodedAgentUri,
} from "./erc8004";

export type AgentIdentityRecord = {
  agentId: bigint;
  owner: Address;
  agentWallet: Address | null;
  decoded: DecodedAgentUri;
  txHash: Hex | null;
};

type RoutescanLog = {
  topics?: string[];
  transactionHash?: string;
  blockNumber?: string;
};

/** Đọc danh sách hộ chiếu ERC-8004 trên Fuji do `owner` sở hữu qua Routescan + verify on-chain bằng `ownerOf`/`tokenURI`. */
export function useErc8004Identities(enabled: boolean, owner: Address | null) {
  const [identities, setIdentities] = useState<AgentIdentityRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !owner) {
      setIdentities(null);
      return;
    }

    try {
      const balance = (await publicClient.readContract({
        address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
        abi: erc8004RegistryAbi,
        functionName: "balanceOf",
        args: [owner],
      })) as bigint;

      if (balance === 0n) {
        setIdentities([]);
        setError(null);
        return;
      }

      const paddedOwner = `0x000000000000000000000000${owner.slice(2).toLowerCase()}`;
      const url = `${ROUTESCAN_API}?module=logs&action=getLogs&address=${ERC8004_IDENTITY_REGISTRY_ADDRESS}&topic0=${REGISTERED_TOPIC}&topic0_2_opr=and&topic2=${paddedOwner}&fromBlock=58000000&toBlock=latest`;

      let logs: RoutescanLog[] = [];
      const res = await fetch(url);
      if (res.ok) {
        const body = (await res.json()) as { status?: string; result?: RoutescanLog[] | string };
        if (Array.isArray(body.result)) {
          logs = body.result;
        }
      }

      // Fallback RPC vài chục block gần nhất nếu Routescan chưa kịp index NFT vừa đăng ký.
      const head = await publicClient.getBlockNumber();
      const recentLogs = await publicClient.getLogs({
        address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
        event: {
          type: "event",
          name: "Registered",
          inputs: [
            { name: "agentId", type: "uint256", indexed: true },
            { name: "agentURI", type: "string", indexed: false },
            { name: "owner", type: "address", indexed: true },
          ],
        },
        args: { owner },
        fromBlock: head > 90n ? head - 90n : 0n,
        toBlock: head,
      });

      const merged = parseRegisteredLogs(
        [
          ...logs.map((l) => ({
            topics: l.topics ?? [],
            transactionHash: l.transactionHash,
            blockNumber: l.blockNumber,
          })),
          ...recentLogs.map((l) => ({
            topics: l.topics,
            transactionHash: l.transactionHash,
            blockNumber: l.blockNumber,
          })),
        ],
        owner,
      );

      const resolved = await Promise.all(
        merged.slice(0, 6).map(async (item): Promise<AgentIdentityRecord | null> => {
          try {
            const [currentOwner, uri, wallet] = await Promise.all([
              publicClient.readContract({
                address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
                abi: erc8004RegistryAbi,
                functionName: "ownerOf",
                args: [item.agentId],
              }) as Promise<Address>,
              publicClient.readContract({
                address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
                abi: erc8004RegistryAbi,
                functionName: "tokenURI",
                args: [item.agentId],
              }) as Promise<string>,
              publicClient
                .readContract({
                  address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
                  abi: erc8004RegistryAbi,
                  functionName: "getAgentWallet",
                  args: [item.agentId],
                })
                .catch(() => null) as Promise<Address | null>,
            ]);

            if (currentOwner.toLowerCase() !== owner.toLowerCase()) return null;
            return {
              agentId: item.agentId,
              owner: currentOwner,
              agentWallet: wallet && wallet !== "0x0000000000000000000000000000000000000000" ? wallet : null,
              decoded: decodeAgentRegistrationUri(uri),
              txHash: item.txHash !== "0x" ? item.txHash : null,
            };
          } catch {
            return null;
          }
        }),
      );

      setIdentities(resolved.filter((r): r is AgentIdentityRecord => r !== null));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được danh tính ERC-8004.");
    }
  }, [enabled, owner]);

  useEffect(() => {
    setIdentities(null);
    setError(null);
    if (!enabled || !owner) return;
    void refresh();
  }, [enabled, owner, refresh]);

  return { identities, error, refresh };
}
