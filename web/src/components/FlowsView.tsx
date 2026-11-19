"use client";

import Link from "next/link";
import { useConsole } from "./ConsoleProvider";
import { SlidersIcon } from "./Icons";
import { SpendsPanel } from "./SpendsPanel";

/** Trang /flows — Không gian rộng cho sơ đồ Dòng tiền x402 và sổ giao dịch on-chain chi tiết. */
export function FlowsView() {
  const { spends, spendsLoaded, spendsError, promoteConfig, aliases } = useConsole();

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/90 px-4 py-3.5 backdrop-blur-sm sm:px-5">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Dòng tiền x402
          </h1>
          <p className="mt-0.5 text-xs leading-relaxed text-muted sm:text-sm">
            Sơ đồ luồng USDC qua <code className="font-mono text-foreground">AgentPolicy</code> tới các API Whitelist,
            API mới có tên riêng và vùng Sandbox kèm link đối chiếu Snowscan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="inline-flex min-h-9 items-center rounded-lg border border-border-control bg-surface-inset px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-elevated"
          >
            ← Tổng quan
          </Link>
          <Link
            href="/policies"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-flow/45 bg-flow/10 px-3 py-1.5 text-xs font-semibold text-flow-text transition hover:bg-flow/20"
          >
            <SlidersIcon className="h-3.5 w-3.5" />
            <span>Quản lý Whitelist API</span>
          </Link>
        </div>
      </section>

      <SpendsPanel
        spends={spends}
        loaded={spendsLoaded}
        error={spendsError}
        promote={promoteConfig}
        aliases={aliases}
        expanded
      />
    </div>
  );
}
