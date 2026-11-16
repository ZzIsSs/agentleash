"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useState } from "react";
import type { Address } from "viem";
import { erc8004RegistryAbi, factoryAbi, policyOwnerAbi } from "@/lib/abi";
import type { ParsedCaps } from "@/lib/caps";
import {
  DEMO_POLICY_PARAMS,
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  FACTORY_ADDRESS,
  POLICY_ADDRESS,
  addressUrl,
  publicClient,
  shortAddress,
} from "@/lib/chain";
import { buildAgentRegistrationPayload, encodeAgentRegistrationUri } from "@/lib/erc8004";
import { isBusy } from "@/lib/ownerTx";
import {
  deriveOverview,
  formatCountdown,
  formatPeriod,
  formatUsdc,
  type Meter,
  type PolicyOverview,
  type PolicyRaw,
} from "@/lib/policy";
import { resolveActivePolicy } from "@/lib/policyCreate";
import { useDemoRunner } from "@/lib/useDemoRunner";
import { useErc8004Identities, type AgentIdentityRecord } from "@/lib/useErc8004";
import { useOwnerAccount, useOwnerTx, useOwnerWallet, useWhitelist } from "@/lib/useOwner";
import { useNow, usePolicy } from "@/lib/usePolicy";
import { useRejections } from "@/lib/useRejections";
import { useSpends } from "@/lib/useSpends";
import { RejectionsCard, SpendsCard } from "./ActivityCards";
import { ConfirmDialog, KillSwitch, SetupCard, TxBanner } from "./OwnerPanels";

export function Dashboard() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const owner = useOwnerWallet();
  const account = useOwnerAccount(authenticated ? owner.address : null);
  const ownerPolicies = account.policies ?? [];
  const myPolicy = ownerPolicies.length > 0 ? ownerPolicies[ownerPolicies.length - 1] : null;
  const [selectedPolicy, setSelectedPolicy] = useState<Address | null>(null);
  const policy: Address = resolveActivePolicy(selectedPolicy, ownerPolicies, POLICY_ADDRESS);

  const { raw, error, updatedAt, refresh } = usePolicy(authenticated, policy);
  const wl = useWhitelist(authenticated ? policy : null);
  const flow = useSpends(authenticated, policy);
  const rejections = useRejections(authenticated);
  const erc8004 = useErc8004Identities(authenticated, raw?.owner ?? owner.address);
  const now = useNow();

  const { refresh: refreshAccount } = account;
  const { refresh: refreshWhitelist } = wl;
  const { refresh: refreshSpends } = flow;
  const { refresh: refreshRejections } = rejections;
  const { refresh: refreshErc8004 } = erc8004;

  const onDemoFinished = useCallback(() => {
    void refresh();
    void refreshSpends();
    void refreshRejections();
  }, [refresh, refreshSpends, refreshRejections]);

  const demoRunner = useDemoRunner(authenticated, onDemoFinished);

  const onConfirmed = useCallback(() => {
    void refresh();
    void refreshAccount();
    void refreshWhitelist();
    void refreshErc8004();
  }, [refresh, refreshAccount, refreshWhitelist, refreshErc8004]);
  const tx = useOwnerTx(onConfirmed);
  const busy = isBusy(tx.state);
  const [confirm, setConfirm] = useState<"pause" | "unpause" | null>(null);

  const isOwner = !!raw && !!owner.address && raw.owner.toLowerCase() === owner.address.toLowerCase();

  // Mỗi lệnh chủ ký đều mô phỏng trước: lỗi như Unauthorized hiện ngay, không mở cửa sổ ký, không tốn gas.
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

  const sendWhitelist = (payTo: Address, allowed: boolean) =>
    tx.run(allowed ? "Thêm vào whitelist" : "Gỡ khỏi whitelist", async () => {
      const wallet = await owner.getWalletClient();
      const { request } = await publicClient.simulateContract({
        address: policy,
        abi: policyOwnerAbi,
        functionName: "setWhitelist",
        args: [payTo, allowed],
        account: wallet.account.address,
      });
      return wallet.writeContract({ ...request, account: wallet.account, chain: wallet.chain });
    });

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
      // Bỏ ghim policy cũ để tự chuyển sang policy mới nhất vừa tạo qua Factory.
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

  if (!ready) {
    return <Centered>Đang tải Privy…</Centered>;
  }

  if (!authenticated) {
    return (
      <Centered>
        <div className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-border bg-card p-8 text-center">
          <Logo />
          <p className="text-muted">
            Ví cho AI agent có dây xích on-chain: hạn mức hai tầng, whitelist và nút khóa khẩn cấp trên Avalanche
            Fuji.
          </p>
          <button
            onClick={login}
            className="rounded-lg bg-flow px-4 py-3 font-semibold text-background transition hover:opacity-90"
          >
            Đăng nhập bằng email
          </button>
        </div>
      </Centered>
    );
  }

  const overview = raw ? deriveOverview(raw, now) : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-4 p-4 md:p-6">
      <Header
        email={user?.email?.address ?? null}
        wallet={user?.wallet?.address ?? null}
        policy={policy}
        overview={overview}
        onLogout={logout}
        killSwitch={<KillSwitch raw={raw} isOwner={isOwner} busy={busy} onRequest={setConfirm} />}
      />

      <TxBanner state={tx.state} onClose={tx.reset} />
      {confirm && (
        <ConfirmDialog
          action={confirm}
          policy={policy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const action = confirm;
            setConfirm(null);
            void sendPause(action);
          }}
        />
      )}

      {error && (
        <div className="rounded-lg border border-danger/50 bg-danger/10 px-4 py-2 text-sm text-danger">
          Không đọc được dữ liệu on-chain, đang thử lại: {error}
        </div>
      )}

      <main className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <OverviewCard
          overview={overview}
          raw={raw}
          updatedAt={updatedAt}
          identities={erc8004.identities}
        />
        <SpendsCard spends={flow.spends} loaded={flow.loaded} error={flow.error} />
        <SetupCard
          policy={policy}
          defaultPolicy={POLICY_ADDRESS}
          owner={owner.address}
          avax={account.avax}
          policies={ownerPolicies}
          myPolicy={myPolicy}
          raw={raw}
          isOwner={isOwner}
          whitelist={wl.whitelist}
          identities={erc8004.identities}
          erc8004Error={erc8004.error}
          busy={busy}
          onSelectPolicy={setSelectedPolicy}
          onCreate={sendCreate}
          onToggle={(payTo, allowed) => void sendWhitelist(payTo, allowed)}
          onSetCaps={sendSetCaps}
          onRegisterErc8004={sendRegisterErc8004}
        />
        <RejectionsCard
          policy={policy}
          items={rejections.items}
          available={rejections.available}
          demoAvailability={demoRunner.availability}
          demoRunState={demoRunner.runState}
          onRunDemo={(bypassRules) => void demoRunner.runDemo(bypassRules, policy)}
        />
      </main>
    </div>
  );
}

function Header({
  email,
  wallet,
  policy,
  overview,
  onLogout,
  killSwitch,
}: {
  email: string | null;
  wallet: string | null;
  policy: Address;
  overview: PolicyOverview | null;
  onLogout: () => void;
  killSwitch: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        <Logo />
        {overview && (
          <span className="rounded-full border border-sandbox/50 bg-sandbox/10 px-3 py-1 text-xs font-medium text-sandbox">
            DEMO: chu kỳ {formatPeriod(overview.periodSeconds)} (thực tế: 1 ngày)
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-md bg-background px-2 py-1 text-muted">Fuji Testnet</span>
        <a
          href={addressUrl(policy)}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-flow hover:underline"
          title="Mở policy trên Snowscan"
        >
          {shortAddress(policy)}
        </a>
        {overview && <span className="font-mono">{formatUsdc(overview.balance)} USDC</span>}
        <span className="text-muted" title={wallet ?? undefined}>
          {email ?? (wallet ? shortAddress(wallet) : "")}
        </span>
        <button onClick={onLogout} className="rounded-md border border-border px-3 py-1 text-muted hover:text-foreground">
          Đăng xuất
        </button>
        {killSwitch}
      </div>
    </header>
  );
}

function OverviewCard({
  overview,
  raw,
  updatedAt,
  identities,
}: {
  overview: PolicyOverview | null;
  raw: PolicyRaw | null;
  updatedAt: number | null;
  identities: readonly AgentIdentityRecord[] | null;
}) {
  const latestIdentity = identities && identities.length > 0 ? identities[0] : null;
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          <span className="text-muted">[1]</span> Tổng quan
        </h2>
        {overview && <StatusBadge status={overview.status} />}
      </div>

      {!overview || !raw ? (
        <p className="text-muted">Đang đọc policy trên Fuji…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Số dư policy" value={`${formatUsdc(overview.balance)}`} unit="USDC" />
            <Stat label="Agent chi được ngay" value={`${formatUsdc(overview.spendableNow)}`} unit="USDC" />
            <Stat label="Hồi hạn mức sau" value={formatCountdown(overview.secondsToReset)} unit="phút:giây" />
          </div>

          <MeterBar
            title="Tầng 1: Whitelist (tin cậy)"
            hint={`Trần chung của chu kỳ, tính cả Sandbox. Tối đa ${formatUsdc(overview.perTxCap)} USDC mỗi lần.`}
            meter={overview.trusted}
            color="bg-trusted"
            text="text-trusted"
          />
          <MeterBar
            title="Tầng 2: Sandbox (API lạ)"
            hint={`Trần riêng cho địa chỉ ngoài whitelist. Tối đa ${formatUsdc(overview.sandboxPerTxCap)} USDC mỗi lần.`}
            meter={overview.sandbox}
            color="bg-sandbox"
            text="text-sandbox"
          />

          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted sm:grid-cols-2">
            <div>
              Chủ policy:{" "}
              <a href={addressUrl(raw.owner)} target="_blank" rel="noreferrer" className="font-mono hover:text-flow">
                {shortAddress(raw.owner)}
              </a>
            </div>
            <div>
              Ví agent:{" "}
              <a href={addressUrl(raw.agent)} target="_blank" rel="noreferrer" className="font-mono hover:text-flow">
                {shortAddress(raw.agent)}
              </a>
            </div>
            <div>Block: {raw.blockNumber.toString()}</div>
            <div>Cập nhật: {updatedAt ? new Date(updatedAt).toLocaleTimeString("vi-VN") : "—"} (3 giây/lần)</div>
            {latestIdentity && (
              <div className="sm:col-span-2">
                Hộ chiếu ERC-8004:{" "}
                <a
                  href={addressUrl(ERC8004_IDENTITY_REGISTRY_ADDRESS)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-trusted hover:underline"
                >
                  ID #{latestIdentity.agentId.toString()} ({latestIdentity.decoded.name ?? "AgentIdentity"}) ↗
                </a>
              </div>
            )}
          </dl>
        </>
      )}
    </section>
  );
}

function MeterBar({
  title,
  hint,
  meter,
  color,
  text,
}: {
  title: string;
  hint: string;
  meter: Meter;
  color: string;
  text: string;
}) {
  const pct = Math.round(meter.usedRatio * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        <span className="text-sm">
          Còn <span className={`font-mono text-xl font-semibold ${text}`}>{formatUsdc(meter.remaining)}</span>
          <span className="text-muted"> / {formatUsdc(meter.cap)} USDC</span>
        </span>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full bg-background"
        role="meter"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={100 - pct}
      >
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${100 - pct}%` }} />
      </div>
      <p className="text-xs text-muted">
        Đã chi {formatUsdc(meter.spent)} USDC trong chu kỳ. {hint}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: PolicyOverview["status"] }) {
  return status === "active" ? (
    <span className="flex items-center gap-2 rounded-full bg-trusted/15 px-3 py-1 text-sm font-medium text-trusted">
      <span className="h-2 w-2 animate-pulse rounded-full bg-trusted" /> Đang hoạt động
    </span>
  ) : (
    <span className="flex items-center gap-2 rounded-full bg-danger/15 px-3 py-1 text-sm font-medium text-danger">
      <span className="h-2 w-2 rounded-full bg-danger" /> Đã khóa (paused)
    </span>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl bg-background p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-mono text-xl font-semibold">{value}</div>
      <div className="text-xs text-muted">{unit}</div>
    </div>
  );
}


function Logo() {
  return (
    <span className="text-xl font-bold tracking-tight">
      Agent<span className="text-flow">Leash</span>
    </span>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6 text-muted">{children}</div>;
}
