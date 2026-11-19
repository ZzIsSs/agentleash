"use client";

import {
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  addressUrl,
  nftUrl,
  shortAddress,
} from "@/lib/chain";
import {
  formatCountdown,
  formatUsdc,
  type Meter,
  type PolicyOverview,
  type PolicyRaw,
} from "@/lib/policy";
import type { AgentIdentityRecord } from "@/lib/useErc8004";
import {
  ArrowUpRightIcon,
  BadgeIdIcon,
  LockIcon,
  ShieldCheckIcon,
} from "./Icons";
import { formatClock } from "./formatTime";

/** Khối Tổng quan: Đồng hồ hạn mức 2 tầng (Whitelist & Sandbox) + KPI số dư + thông tin hợp đồng on-chain. */
export function OverviewPanel({
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
    <section className="flex h-full flex-col gap-5 rounded-xl border border-border bg-card/90 p-4 backdrop-blur-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="h-4 w-4 text-trusted-text" />
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Tổng quan & hạn mức 2 tầng
          </h2>
        </div>
        {overview ? (
          <StatusBadge status={overview.status} />
        ) : (
          <span className="h-6 w-28 animate-pulse rounded-md bg-surface-inset" aria-hidden="true" />
        )}
      </div>

      {!overview || !raw ? (
        <OverviewSkeleton />
      ) : (
        <>
          {/* 3 KPI telemetry chính dùng tabular-nums để đồng hồ đếm ngược không giật ngang */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <StatWell label="Số dư policy" value={formatUsdc(overview.balance)} unit="USDC" />
            <StatWell
              label="Chi được ngay"
              value={formatUsdc(overview.spendableNow)}
              unit="USDC"
              accent={overview.status === "paused" ? "text-danger-text" : "text-flow-text"}
            />
            <StatWell label="Hồi hạn mức sau" value={formatCountdown(overview.secondsToReset)} unit="phút:giây" />
          </div>

          <div className="flex flex-col gap-4">
            <MeterBar
              title="Tầng 1 · Whitelist (tin cậy)"
              hint={`Trần chung của chu kỳ, tính cả Sandbox. Tối đa ${formatUsdc(overview.perTxCap)} USDC / lần.`}
              meter={overview.trusted}
              barColor="bg-trusted"
              textColor="text-trusted-text"
              dotColor="bg-trusted"
            />
            <MeterBar
              title="Tầng 2 · Sandbox (API lạ)"
              hint={`Trần riêng cho địa chỉ ngoài whitelist. Tối đa ${formatUsdc(overview.sandboxPerTxCap)} USDC / lần.`}
              meter={overview.sandbox}
              barColor="bg-sandbox"
              textColor="text-sandbox-text"
              dotColor="bg-sandbox"
            />
          </div>

          <dl className="mt-auto grid grid-cols-1 gap-x-4 gap-y-2 border-t border-border pt-3.5 text-xs text-muted sm:grid-cols-2">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <dt>Chủ policy:</dt>
              <dd>
                <a
                  href={addressUrl(raw.owner)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-foreground hover:text-flow hover:underline"
                >
                  {shortAddress(raw.owner)}
                  <ArrowUpRightIcon className="h-3 w-3" />
                </a>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <dt>Ví agent:</dt>
              <dd>
                <a
                  href={addressUrl(raw.agent)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-foreground hover:text-flow hover:underline"
                >
                  {shortAddress(raw.agent)}
                  <ArrowUpRightIcon className="h-3 w-3" />
                </a>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <dt>Block Fuji:</dt>
              <dd className="tabular-nums font-mono text-foreground">{raw.blockNumber.toString()}</dd>
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <dt>Cập nhật:</dt>
              <dd className="tabular-nums font-mono text-foreground">
                {formatClock(updatedAt)} (3s/lần)
              </dd>
            </div>
            {latestIdentity && (
              <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2">
                <dt className="inline-flex items-center gap-1 text-muted">
                  <BadgeIdIcon className="h-3.5 w-3.5 text-trusted-text" />
                  <span>Hộ chiếu ERC-8004:</span>
                </dt>
                <dd>
                  <a
                    href={nftUrl(ERC8004_IDENTITY_REGISTRY_ADDRESS, latestIdentity.agentId)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono font-medium text-trusted-text hover:underline"
                  >
                    ID #{latestIdentity.agentId.toString()} ({latestIdentity.decoded.name ?? "AgentIdentity"})
                    <ArrowUpRightIcon className="h-3 w-3" />
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </>
      )}
    </section>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-busy="true" aria-label="Đang đọc dữ liệu policy trên Fuji">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg bg-surface-inset p-3">
            <div className="h-3 w-20 animate-pulse rounded bg-surface-elevated" />
            <div className="h-6 w-24 animate-pulse rounded bg-surface-elevated" />
          </div>
        ))}
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="flex justify-between">
            <div className="h-4 w-36 animate-pulse rounded bg-surface-inset" />
            <div className="h-4 w-24 animate-pulse rounded bg-surface-inset" />
          </div>
          <div className="h-2.5 w-full animate-pulse rounded-full bg-surface-inset" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-surface-inset" />
        </div>
      ))}
    </div>
  );
}

function StatWell({
  label,
  value,
  unit,
  accent = "text-foreground",
}: {
  label: string;
  value: string;
  unit: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-surface-inset px-3.5 py-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className={`tabular-nums font-mono text-lg font-semibold sm:text-xl ${accent}`}>{value}</span>
        <span className="text-xs font-medium text-muted">{unit}</span>
      </div>
    </div>
  );
}

function MeterBar({
  title,
  hint,
  meter,
  barColor,
  textColor,
  dotColor,
}: {
  title: string;
  hint: string;
  meter: Meter;
  barColor: string;
  textColor: string;
  dotColor: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(meter.usedRatio * 100)));
  const remainingPct = 100 - pct;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-[15px] font-medium text-foreground">
          <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} aria-hidden="true" />
          <span>{title}</span>
        </h3>
        <span className="tabular-nums text-xs text-muted sm:text-sm">
          Còn{" "}
          <span className={`font-mono text-base font-semibold sm:text-lg ${textColor}`}>
            {formatUsdc(meter.remaining)}
          </span>
          <span className="font-mono text-muted"> / {formatUsdc(meter.cap)} USDC</span>
        </span>
      </div>

      <div
        className="h-2.5 overflow-hidden rounded-full bg-surface-inset"
        role="meter"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={remainingPct}
      >
        <div
          className={`h-full rounded-full ${barColor} transition-[width] duration-300`}
          style={{ width: `${remainingPct}%` }}
        />
      </div>

      <p className="text-xs leading-relaxed text-muted">
        Đã chi <span className="tabular-nums font-mono text-foreground">{formatUsdc(meter.spent)}</span> USDC trong chu
        kỳ. {hint}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: PolicyOverview["status"] }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-trusted/30 bg-trusted/10 px-2.5 py-1 text-xs font-semibold text-trusted-text">
        <span className="h-2 w-2 rounded-full bg-trusted" aria-hidden="true" />
        <span>Đang hoạt động</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/15 px-2.5 py-1 text-xs font-semibold text-danger-text">
      <LockIcon className="h-3.5 w-3.5 shrink-0" />
      <span>Đã khóa (paused)</span>
    </span>
  );
}
