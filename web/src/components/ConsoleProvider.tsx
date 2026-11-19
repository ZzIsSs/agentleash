"use client";

import { usePrivy } from "@privy-io/react-auth";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getAddress, isAddress, type Address } from "viem";
import { erc8004RegistryAbi, factoryAbi, policyOwnerAbi } from "@/lib/abi";
import type { ParsedCaps } from "@/lib/caps";
import {
  DEMO_POLICY_PARAMS,
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  FACTORY_ADDRESS,
  POLICY_ADDRESS,
  publicClient,
} from "@/lib/chain";
import { buildAgentRegistrationPayload, encodeAgentRegistrationUri } from "@/lib/erc8004";
import { isBusy, type TxState } from "@/lib/ownerTx";
import { deriveOverview, type PolicyOverview, type PolicyRaw } from "@/lib/policy";
import { resolveActivePolicy } from "@/lib/policyCreate";
import {
  findRejectionApiAlias,
  normalizeSellerAlias,
  useSellerAliases,
} from "@/lib/sellerAliases";
import { sellerName, type Spend } from "@/lib/spends";
import type { Rejection } from "@/lib/rejections";
import { useDemoRunner, type DemoRunState, type DemoRunnerAvailability } from "@/lib/useDemoRunner";
import { useErc8004Identities, type AgentIdentityRecord } from "@/lib/useErc8004";
import { useOwnerAccount, useOwnerTx, useOwnerWallet, useWhitelist } from "@/lib/useOwner";
import { useChainBlock, useNow, usePolicy } from "@/lib/usePolicy";
import { useRejections } from "@/lib/useRejections";
import { useSpends } from "@/lib/useSpends";
import {
  collectWhitelistCandidates,
  executeSetWhitelist,
  type SetWhitelistWalletClient,
} from "@/lib/whitelistPromote";
import { deriveDemoMilestones } from "./DemoControlBar";
import type { PromoteWhitelistConfig } from "./PromoteWhitelistAction";

const PROMOTE_TX_LABEL = "Chuyển thành API quen";

export type ConfirmPauseAction = "pause" | "unpause" | null;

export type ConsoleContextValue = {
  ready: boolean;
  authenticated: boolean;
  login: () => void;
  logout: () => void;
  userEmail: string | null;
  userWallet: string | null;
  ownerAddress: Address | null;
  avax: bigint | null;
  policies: Address[];
  myPolicy: Address | null;
  policy: Address;
  setSelectedPolicy: (addr: Address | null) => void;
  raw: PolicyRaw | null;
  policyError: string | null;
  updatedAt: number | null;
  overview: PolicyOverview | null;
  spends: Spend[];
  spendsLoaded: boolean;
  spendsError: string | null;
  whitelistTargets: Address[];
  rejections: {
    items: Rejection[];
    total: number;
    available: boolean | null;
  };
  whitelist: Record<string, boolean> | null;
  aliases: Record<string, string>;
  saveAlias: (payTo: string, alias: string | null | undefined) => void;
  erc8004Identities: readonly AgentIdentityRecord[] | null;
  erc8004Error: string | null;
  demoRunner: {
    availability: DemoRunnerAvailability | null;
    runState: DemoRunState;
    runDemo: (bypassRules: boolean, policyAddress: Address) => Promise<void>;
    resetRunState: () => void;
  };
  demoMilestones: {
    hasSpends: boolean;
    hasWhitelistCapBlock: boolean;
    hasSandboxBlock: boolean;
  };
  txState: TxState;
  resetTx: () => void;
  busy: boolean;
  isOwner: boolean;
  ownerReady: boolean;
  confirmPause: ConfirmPauseAction;
  setConfirmPause: (action: ConfirmPauseAction) => void;
  promoteConfig: PromoteWhitelistConfig;
  sendPause: (action: "pause" | "unpause") => Promise<unknown>;
  sendWhitelist: (
    payTo: Address,
    allowed: boolean,
    label?: string,
    aliasOnSuccess?: string,
  ) => Promise<boolean>;
  promoteToTrusted: (payTo: Address, suggestedAlias?: string | null) => Promise<void>;
  sendSetCaps: (caps: ParsedCaps) => Promise<boolean>;
  sendCreate: (agent: Address, periodSeconds: bigint) => Promise<boolean>;
  sendRegisterErc8004: (agentName: string) => Promise<boolean>;
};

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

/** Provider giữ toàn bộ state & luồng polling Fuji liên tục giữa các route Next.js App Router. */
export function ConsoleProvider({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const owner = useOwnerWallet();
  const { blockNumber: chainBlock, refreshBlock } = useChainBlock(true);
  const account = useOwnerAccount(authenticated ? owner.address : null, chainBlock);
  const ownerPolicies = useMemo(() => account.policies ?? [], [account.policies]);
  const myPolicy = ownerPolicies.length > 0 ? ownerPolicies[ownerPolicies.length - 1] : null;
  const [selectedPolicy, setSelectedPolicy] = useState<Address | null>(null);

  const policy: Address = resolveActivePolicy(
    selectedPolicy,
    authenticated ? ownerPolicies : [],
    POLICY_ADDRESS,
  );

  const { raw, error: policyError, updatedAt, refresh } = usePolicy(true, policy, chainBlock);
  const flow = useSpends(true, policy, chainBlock);
  const rejections = useRejections(true);
  const [aliases, saveAlias] = useSellerAliases();

  const aliasAddresses = useMemo(
    () =>
      Object.keys(aliases)
        .filter((addr) => isAddress(addr, { strict: false }))
        .map((addr) => getAddress(addr)),
    [aliases],
  );

  const whitelistCandidates = useMemo(
    () => collectWhitelistCandidates(flow.spends, rejections.items, [...flow.whitelistTargets, ...aliasAddresses]),
    [flow.spends, rejections.items, flow.whitelistTargets, aliasAddresses],
  );

  const wl = useWhitelist(policy, whitelistCandidates, chainBlock);
  const erc8004 = useErc8004Identities(true, raw?.owner ?? owner.address);
  const now = useNow();

  const { refresh: refreshAccount } = account;
  const { refresh: refreshWhitelist } = wl;
  const { refresh: refreshSpends } = flow;
  const { refresh: refreshRejections } = rejections;
  const { refresh: refreshErc8004 } = erc8004;

  const onDemoFinished = useCallback(() => {
    void refreshBlock();
    void refresh();
    void refreshSpends();
    void refreshRejections();
  }, [refreshBlock, refresh, refreshSpends, refreshRejections]);

  const demoRunner = useDemoRunner(true, onDemoFinished);

  const onConfirmed = useCallback(() => {
    void refreshBlock();
    void refresh();
    void refreshAccount();
    void refreshWhitelist();
    void refreshSpends();
    void refreshErc8004();
  }, [refreshBlock, refresh, refreshAccount, refreshWhitelist, refreshSpends, refreshErc8004]);

  const tx = useOwnerTx(onConfirmed);
  const busy = isBusy(tx.state);
  const [confirmPause, setConfirmPause] = useState<ConfirmPauseAction>(null);
  const [promotingTarget, setPromotingTarget] = useState<Address | null>(null);

  const isOwner =
    authenticated && !!raw && !!owner.address && raw.owner.toLowerCase() === owner.address.toLowerCase();
  const ownerReady = authenticated && owner.ready && !!owner.address;

  const sendPause = (functionName: "pause" | "unpause") =>
    tx.run(functionName === "pause" ? "Khóa khẩn cấp" : "Mở khóa", async () => {
      const wallet = await owner.getWalletClient();
      const { request } = await publicClient.simulateContract({
        address: policy,
        abi: policyOwnerAbi,
        functionName,
        account: wallet.account.address,
      });
      return wallet.writeContract({ ...request, account: wallet.account, chain: wallet.chain });
    });

  const sendWhitelist = async (
    payTo: Address,
    allowed: boolean,
    label?: string,
    aliasOnSuccess?: string,
  ): Promise<boolean> => {
    const ok = await executeSetWhitelist({
      policy,
      targetAddress: payTo,
      allowed,
      label,
      runTx: tx.run,
      getWalletClient: async () => (await owner.getWalletClient()) as unknown as SetWhitelistWalletClient,
      simulateContract: (args) =>
        publicClient.simulateContract(args) as unknown as Promise<{ request: Record<string, unknown> }>,
    });
    if (ok && allowed && aliasOnSuccess) {
      saveAlias(payTo, aliasOnSuccess);
    }
    return ok;
  };

  const promoteToTrusted = async (payTo: Address, suggestedAlias?: string | null) => {
    setPromotingTarget(payTo);
    const ok = await sendWhitelist(payTo, true, PROMOTE_TX_LABEL);
    if (ok && !sellerName(payTo) && !aliases[payTo.toLowerCase()]) {
      const autoAlias =
        normalizeSellerAlias(suggestedAlias) ?? findRejectionApiAlias(payTo, rejections.items);
      if (autoAlias) {
        saveAlias(payTo, autoAlias);
      }
    }
  };

  const promoteConfig: PromoteWhitelistConfig = {
    whitelist: wl.whitelist,
    authenticated,
    isOwner,
    ownerReady,
    busy,
    txState: tx.state,
    // tx.state dùng chung cho mọi giao dịch của chủ ví: chỉ gắn vào dòng đang duyệt khi đúng là tx "Chuyển thành API quen",
    // để setCaps / Kill Switch chạy sau đó không hiện nhầm hash hay lỗi vào dòng này.
    promotingTarget: tx.state.phase !== "idle" && tx.state.label === PROMOTE_TX_LABEL ? promotingTarget : null,
    onPromote: (addr, suggested) => void promoteToTrusted(addr, suggested),
  };

  const sendSetCaps = async (caps: ParsedCaps): Promise<boolean> => {
    const receipt = await tx.run("Cập nhật hạn mức 2 tầng", async () => {
      const wallet = await owner.getWalletClient();
      const { request } = await publicClient.simulateContract({
        address: policy,
        abi: policyOwnerAbi,
        functionName: "setCaps",
        args: [caps.perTxCap, caps.dailyCap, caps.sandboxPerTxCap, caps.sandboxDailyCap],
        account: wallet.account.address,
      });
      return wallet.writeContract({ ...request, account: wallet.account, chain: wallet.chain });
    });
    return receipt !== null;
  };

  const sendCreate = async (agent: Address, periodSeconds: bigint): Promise<boolean> => {
    const receipt = await tx.run("Tạo policy mới qua Factory", async () => {
      const wallet = await owner.getWalletClient();
      const p = DEMO_POLICY_PARAMS;
      const { request } = await publicClient.simulateContract({
        address: FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: "createPolicy",
        args: [agent, p.perTxCap, p.dailyCap, p.sandboxPerTxCap, p.sandboxDailyCap, periodSeconds],
        account: wallet.account.address,
      });
      return wallet.writeContract({ ...request, account: wallet.account, chain: wallet.chain });
    });
    if (receipt) {
      setSelectedPolicy(null);
      return true;
    }
    return false;
  };

  const sendRegisterErc8004 = async (agentName: string): Promise<boolean> => {
    if (!raw) return false;
    const payload = buildAgentRegistrationPayload({
      name: agentName,
      agentAddress: raw.agent,
      policyAddress: policy,
    });
    const agentURI = encodeAgentRegistrationUri(payload);
    const receipt = await tx.run("Đăng ký danh tính ERC-8004", async () => {
      const wallet = await owner.getWalletClient();
      const { request } = await publicClient.simulateContract({
        address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
        abi: erc8004RegistryAbi,
        functionName: "register",
        args: [agentURI],
        account: wallet.account.address,
      });
      return wallet.writeContract({ ...request, account: wallet.account, chain: wallet.chain });
    });
    return receipt !== null;
  };

  const overview = raw ? deriveOverview(raw, now) : null;
  const demoMilestones = deriveDemoMilestones(rejections.items, flow.spends);

  const value: ConsoleContextValue = {
    ready,
    authenticated,
    login,
    logout,
    userEmail: user?.email?.address ?? null,
    userWallet: user?.wallet?.address ?? null,
    ownerAddress: authenticated ? owner.address : null,
    avax: account.avax,
    policies: authenticated ? ownerPolicies : [],
    myPolicy: authenticated ? myPolicy : null,
    policy,
    setSelectedPolicy,
    raw,
    policyError,
    updatedAt,
    overview,
    spends: flow.spends,
    spendsLoaded: flow.loaded,
    spendsError: flow.error,
    whitelistTargets: flow.whitelistTargets,
    rejections: {
      items: rejections.items,
      total: rejections.total,
      available: rejections.available,
    },
    whitelist: wl.whitelist,
    aliases,
    saveAlias,
    erc8004Identities: erc8004.identities,
    erc8004Error: erc8004.error,
    demoRunner: {
      availability: demoRunner.availability,
      runState: demoRunner.runState,
      runDemo: demoRunner.runDemo,
      resetRunState: demoRunner.resetRunState,
    },
    demoMilestones,
    txState: tx.state,
    resetTx: tx.reset,
    busy,
    isOwner,
    ownerReady,
    confirmPause,
    setConfirmPause,
    promoteConfig,
    sendPause,
    sendWhitelist,
    promoteToTrusted,
    sendSetCaps,
    sendCreate,
    sendRegisterErc8004,
  };

  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>;
}

export function useConsole(): ConsoleContextValue {
  const ctx = useContext(ConsoleContext);
  if (!ctx) {
    throw new Error("useConsole must be used inside ConsoleProvider.");
  }
  return ctx;
}
