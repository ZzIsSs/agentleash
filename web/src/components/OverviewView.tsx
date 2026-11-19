"use client";

import Link from "next/link";
import { addressUrl, shortAddress, txUrl } from "@/lib/chain";
import { formatUsdc } from "@/lib/policy";
import { resolveSellerName } from "@/lib/sellerAliases";
import { isUnknownOrSandboxRejection, isUnknownOrSandboxSpend } from "@/lib/whitelistPromote";
import { useConsole } from "./ConsoleProvider";
import { DemoControlBar } from "./DemoControlBar";
import {
  ActivityFlowIcon,
  AlertTriangleIcon,
  ArrowUpRightIcon,
  ShieldBanIcon,
  ShieldCheckIcon,
} from "./Icons";
import { OverviewPanel } from "./OverviewPanel";
import { PromoteWhitelistAction } from "./PromoteWhitelistAction";
import { formatActivityTime } from "./formatTime";

/** Trang / — Tổng quan & Điều khiển: Demo 7 bước, đồng hồ 2 tầng và tóm tắt hoạt động gần nhất. */
export function OverviewView() {
  const {
    authenticated,
    policy,
    raw,
    updatedAt,
    overview,
    spends,
    spendsLoaded,
    rejections,
    whitelist,
    aliases,
    erc8004Identities,
    demoRunner,
    demoMilestones,
    promoteConfig,
  } = useConsole();

  const recentSpends = spends.slice(0, 2);
  const recentRejections = rejections.items.slice(0, 2);
  const totalRejections = Math.max(rejections.total, rejections.items.length);

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/90 px-4 py-3.5 backdrop-blur-sm sm:px-5">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Tổng quan & Điều khiển
          </h1>
          <p className="mt-0.5 text-xs leading-relaxed text-muted sm:text-sm">
            Theo dõi sức khỏe ví policy 2 tầng, chạy kịch bản Demo 7 bước và xử lý nhanh các API mới phát sinh.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/flows"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-control bg-surface-inset px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-elevated"
          >
            <ActivityFlowIcon className="h-3.5 w-3.5 text-flow" />
            <span>Mở Dòng tiền x402</span>
          </Link>
          <Link
            href="/policies"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-flow/45 bg-flow/10 px-3 py-1.5 text-xs font-semibold text-flow-text transition hover:bg-flow/20"
          >
            <span>Cấu hình Luật 2 tầng</span>
          </Link>
        </div>
      </section>

      <DemoControlBar
        policy={policy}
        authenticated={authenticated}
        isPaused={raw?.paused ?? false}
        hasSpends={demoMilestones.hasSpends}
        hasWhitelistCapBlock={demoMilestones.hasWhitelistCapBlock}
        hasSandboxBlock={demoMilestones.hasSandboxBlock}
        availability={demoRunner.availability}
        runState={demoRunner.runState}
        onRunDemo={(bypassRules) => void demoRunner.runDemo(bypassRules, policy)}
        onResetDemoRun={demoRunner.resetRunState}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <OverviewPanel
            overview={overview}
            raw={raw}
            updatedAt={updatedAt}
            identities={erc8004Identities}
          />
        </div>

        <section
          aria-label="Tóm tắt hoạt động gần nhất"
          className="flex h-full flex-col gap-4 rounded-xl border border-border bg-card/90 p-4 backdrop-blur-sm sm:p-5 xl:col-span-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ActivityFlowIcon className="h-4 w-4 text-flow" />
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Hoạt động mới nhất
              </h2>
            </div>
            <span className="tabular-nums text-xs text-muted">
              {spends.length} khoản chi · {totalRejections} lần chặn
            </span>
          </div>

          {/* 2 khoản chi gần nhất */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Khoản chi gần nhất</h3>
              <Link href="/flows" className="text-xs font-medium text-flow hover:text-flow-text hover:underline">
                Xem tất cả ({spends.length}) →
              </Link>
            </div>

            {!spendsLoaded ? (
              <div className="flex flex-col gap-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-inset" />
                ))}
              </div>
            ) : recentSpends.length === 0 ? (
              <p className="rounded-lg bg-surface-inset px-3.5 py-3 text-xs text-muted">
                Chưa có khoản chi x402 nào. Bấm chạy Agent Đà Lạt phía trên hoặc xem chi tiết ở{" "}
                <Link href="/flows" className="text-flow hover:underline">
                  Dòng tiền x402
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-surface-inset/70 px-3.5 py-1">
                {recentSpends.map((s) => {
                  const name = resolveSellerName(s.payTo, aliases);
                  const eligible = isUnknownOrSandboxSpend(s, whitelist);
                  return (
                    <li key={s.key} className="flex flex-col gap-1.5 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{name}</span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${
                                s.isSandbox
                                  ? "border-sandbox/30 bg-sandbox/10 text-sandbox-text"
                                  : "border-trusted/30 bg-trusted/10 text-trusted-text"
                              }`}
                            >
                              {!s.isSandbox && <ShieldCheckIcon className="h-3 w-3 shrink-0" />}
                              <span>{s.isSandbox ? "Sandbox" : "Whitelist"}</span>
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
                            <span className="tabular-nums font-mono">
                              {formatActivityTime(s.timestamp === null ? null : s.timestamp * 1000)}
                            </span>
                            <a
                              href={addressUrl(s.payTo)}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono hover:text-flow hover:underline"
                            >
                              → {shortAddress(s.payTo)}
                            </a>
                            <a
                              href={txUrl(s.txHash)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 text-flow hover:text-flow-text hover:underline"
                            >
                              Snowscan
                              <ArrowUpRightIcon className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                        <span
                          className={`tabular-nums shrink-0 font-mono text-sm font-semibold ${
                            s.released ? "text-muted line-through" : "text-flow-text"
                          }`}
                        >
                          −{formatUsdc(s.amount)} USDC
                        </span>
                      </div>
                      <PromoteWhitelistAction payTo={s.payTo} eligible={eligible} promote={promoteConfig} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* 2 lần bị chặn gần nhất */}
          <div className="mt-auto flex flex-col gap-2.5 border-t border-border pt-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Lần bị chặn gần nhất</h3>
              <Link href="/audit" className="text-xs font-medium text-flow hover:text-flow-text hover:underline">
                Xem nhật ký ({totalRejections}) →
              </Link>
            </div>

            {rejections.available === null ? (
              <div className="flex flex-col gap-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-inset" />
                ))}
              </div>
            ) : rejections.available === false ? (
              <p className="rounded-lg bg-surface-inset px-3.5 py-3 text-xs text-muted">
                Chưa kết nối nguồn <code className="font-mono text-foreground">agent/logs/audit.json</code>.
              </p>
            ) : recentRejections.length === 0 ? (
              <p className="rounded-lg bg-surface-inset px-3.5 py-3 text-xs text-muted">
                Chưa có yêu cầu nào bị Rule Engine hoặc Contract từ chối.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-surface-inset/70 px-3.5 py-1">
                {recentRejections.map((r) => {
                  const isContract = r.source === "contract";
                  const eligible = isUnknownOrSandboxRejection(r);
                  return (
                    <li key={r.id} className="flex flex-col gap-1.5 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${
                              isContract
                                ? "border-danger/35 bg-danger/15 text-danger-text"
                                : "border-sandbox/35 bg-sandbox/15 text-sandbox-text"
                            }`}
                          >
                            {isContract ? (
                              <ShieldBanIcon className="h-3 w-3 shrink-0" />
                            ) : (
                              <AlertTriangleIcon className="h-3 w-3 shrink-0" />
                            )}
                            <span>{isContract ? "Contract chặn" : "Rule engine chặn"}</span>
                          </span>
                          <span className="text-sm font-medium text-foreground">{r.title}</span>
                        </div>
                        <span className="tabular-nums font-mono text-xs text-muted">{formatActivityTime(r.time)}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
                        <span>API: {r.payTo ? resolveSellerName(r.payTo, aliases) : r.api}</span>
                        {r.amountUnits !== null && (
                          <span className="tabular-nums font-mono text-foreground">
                            {formatUsdc(r.amountUnits)} USDC
                          </span>
                        )}
                        <code className="rounded bg-card px-1.5 py-0.5 font-mono text-xs text-foreground">
                          {r.code}
                        </code>
                      </div>

                      <PromoteWhitelistAction
                        payTo={r.payTo}
                        eligible={eligible}
                        promote={promoteConfig}
                        suggestedAlias={r.api}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
