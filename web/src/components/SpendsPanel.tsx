"use client";

import { useId, useState } from "react";
import { addressUrl, shortAddress, txUrl } from "@/lib/chain";
import { formatUsdc } from "@/lib/policy";
import { resolveSellerName } from "@/lib/sellerAliases";
import {
  summarizeSpendFlows,
  totalSpent,
  type FlowNodeSummary,
  type Spend,
  type SpendFlowSummary,
} from "@/lib/spends";
import { isUnknownOrSandboxSpend } from "@/lib/whitelistPromote";
import { ActivityFlowIcon, ArrowUpRightIcon, ShieldCheckIcon } from "./Icons";
import { PromoteWhitelistAction, type PromoteWhitelistConfig } from "./PromoteWhitelistAction";
import { formatActivityTime } from "./formatTime";

const NODE_HEIGHT = 46;
const NODE_GAP = 15;
const SVG_PAD_Y = 8;

const TIER_VISUAL: Record<
  FlowNodeSummary["tier"],
  { textColor: string; boxStroke: string; badgeText: string }
> = {
  trusted: { textColor: "#4ade80", boxStroke: "#22c55e", badgeText: "Whitelist" },
  sandbox: { textColor: "#facc15", boxStroke: "#eab308", badgeText: "Sandbox" },
  mixed: { textColor: "#facc15", boxStroke: "#eab308", badgeText: "WL + Sandbox" },
  idle: { textColor: "#94a3b8", boxStroke: "#334155", badgeText: "Chưa chi" },
};

function truncateSvgLabel(text: string, maxChars = 17): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

/** Sơ đồ SVG thuần Agent → Policy → API: co giãn động theo số API whitelist và độ dày tỷ lệ USDC đã chi. */
function SpendFlowDiagram({ summary }: { summary: SpendFlowSummary }) {
  const uid = useId();
  const mixedGradId = `${uid}-mixed-grad`;
  const hasAnySpend = summary.totalAmount > 0n;
  const nodeCount = summary.nodes.length;
  const svgHeight = SVG_PAD_Y * 2 + nodeCount * NODE_HEIGHT + Math.max(0, nodeCount - 1) * NODE_GAP;
  const centerY = svgHeight / 2;
  const nodeCenterY = (idx: number) => SVG_PAD_Y + idx * (NODE_HEIGHT + NODE_GAP) + NODE_HEIGHT / 2;
  const ariaSummary = `Sơ đồ dòng tiền Agent qua Policy tới ${nodeCount} API: ${summary.nodes
    .map((node) => `${node.label} ${formatUsdc(node.amount)} USDC`)
    .join(", ")}.`;

  return (
    <div className="flex flex-col gap-2.5 rounded-lg bg-surface-inset p-3">
      {/* Bản gọn dễ đọc trên màn hình hẹp (< 640px) */}
      <div className="flex flex-col gap-2.5 sm:hidden" aria-label={ariaSummary}>
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground">AI Agent → AgentPolicy</span>
            <span className="text-xs text-muted">{summary.totalCount} khoản đã chi</span>
          </div>
          <span className="tabular-nums font-mono text-xs font-semibold text-flow-text">
            {formatUsdc(summary.totalAmount)} USDC
          </span>
        </div>
        <div className="divide-y divide-border">
          {summary.nodes.map((node) => {
            const visual = TIER_VISUAL[node.tier];
            const barPct = node.amount === 0n ? 0 : Math.max(8, Math.round(node.share * 100));
            const barClass =
              node.tier === "trusted"
                ? "bg-trusted"
                : node.tier === "idle"
                  ? "bg-border"
                  : "bg-sandbox";
            const badgeNote =
              node.tier === "trusted" && node.sandboxAmount > 0n
                ? `Whitelist (có ${formatUsdc(node.sandboxAmount)} Sandbox cũ)`
                : visual.badgeText;
            return (
              <div key={node.id} className="flex flex-col gap-1.5 py-2 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate font-semibold text-foreground">{node.label}</span>
                    <span className="text-xs font-medium" style={{ color: visual.textColor }}>
                      {badgeNote}
                    </span>
                  </div>
                  <span className="tabular-nums shrink-0 font-mono font-semibold text-foreground">
                    {formatUsdc(node.amount)} USDC
                    {node.count > 0 && <span className="font-normal text-muted"> ({node.count}×)</span>}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-card">
                  <div className={`h-full rounded-full ${barClass}`} style={{ width: `${barPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sơ đồ SVG ngang cho tablet & desktop (>= 640px) */}
      <svg
        viewBox={`0 0 600 ${svgHeight}`}
        role="img"
        aria-label={ariaSummary}
        className="hidden h-auto w-full select-none sm:block"
      >
        <title>Sơ đồ dòng tiền Agent → Policy → API</title>
        <defs>
          <linearGradient id={mixedGradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
        </defs>

        {/* Agent → Policy */}
        <path
          d={`M 118 ${centerY} C 150 ${centerY}, 164 ${centerY}, 194 ${centerY}`}
          fill="none"
          stroke={hasAnySpend ? "#22d3ee" : "#475569"}
          strokeWidth={hasAnySpend ? 5.5 : 1.5}
          strokeDasharray={hasAnySpend ? undefined : "4 4"}
          strokeLinecap="round"
        />
        <circle cx={194} cy={centerY} r={hasAnySpend ? 4 : 2.5} fill={hasAnySpend ? "#22d3ee" : "#64748b"} />

        {/* Policy → từng API */}
        {summary.nodes.map((node, idx) => {
          const cy = nodeCenterY(idx);
          const path = `M 332 ${centerY} C 370 ${centerY}, 370 ${cy}, 408 ${cy}`;
          const isIdleTrusted = node.tier === "trusted" && node.amount === 0n;
          const stroke =
            node.tier === "mixed"
              ? `url(#${mixedGradId})`
              : node.tier === "idle"
                ? "#475569"
                : TIER_VISUAL[node.tier].boxStroke;
          return (
            <g key={node.id}>
              <path
                d={path}
                fill="none"
                stroke={stroke}
                strokeWidth={node.strokeWidth}
                strokeDasharray={node.tier === "idle" || isIdleTrusted ? "4 4" : undefined}
                strokeOpacity={node.tier === "idle" ? 0.55 : isIdleTrusted ? 0.65 : 0.92}
                strokeLinecap="round"
              />
              {node.amount > 0n && (
                <circle
                  cx={408}
                  cy={cy}
                  r={3.5}
                  fill={node.tier === "trusted" ? "#22c55e" : "#eab308"}
                />
              )}
            </g>
          );
        })}

        {/* Node: AI Agent */}
        <rect x={8} y={centerY - 28} width={110} height={56} rx={10} fill="#0f172a" stroke="#334155" strokeWidth={1.5} />
        <text x={63} y={centerY - 3} textAnchor="middle" fill="#f1f5f9" fontSize={12} fontWeight={600}>
          AI Agent
        </text>
        <text x={63} y={centerY + 14} textAnchor="middle" fill="#94a3b8" fontSize={10}>
          Xin chi x402
        </text>

        {/* Node: AgentPolicy */}
        <rect
          x={194}
          y={centerY - 36}
          width={138}
          height={72}
          rx={10}
          fill="#0f172a"
          stroke={hasAnySpend ? "#22d3ee" : "#334155"}
          strokeOpacity={hasAnySpend ? 0.8 : 1}
          strokeWidth={1.5}
        />
        <text x={263} y={centerY - 12} textAnchor="middle" fill="#f1f5f9" fontSize={12} fontWeight={600}>
          AgentPolicy
        </text>
        <text
          x={263}
          y={centerY + 7}
          textAnchor="middle"
          fill="#67e8f9"
          fontSize={12}
          fontWeight={600}
          fontFamily="var(--font-mono), monospace"
        >
          {formatUsdc(summary.totalAmount)} USDC
        </text>
        <text x={263} y={centerY + 24} textAnchor="middle" fill="#94a3b8" fontSize={10}>
          {summary.totalCount} khoản đã chi
        </text>

        {/* Nodes: Thời tiết, Tỷ giá, các API đã whitelist, Địa chỉ lạ */}
        {summary.nodes.map((node, idx) => {
          const cy = nodeCenterY(idx);
          const top = cy - NODE_HEIGHT / 2;
          const visual = TIER_VISUAL[node.tier];
          const svgBadge =
            node.tier === "trusted" && node.sandboxAmount > 0n
              ? "Whitelist · có SB cũ"
              : visual.badgeText;
          return (
            <g key={node.id}>
              <title>
                {`${node.label} — ${
                  node.tier === "trusted" && node.sandboxAmount > 0n
                    ? `Whitelist (có ${formatUsdc(node.sandboxAmount)} USDC Sandbox cũ)`
                    : visual.badgeText
                }: ${formatUsdc(node.amount)} USDC`}
              </title>
              <rect
                x={408}
                y={top}
                width={184}
                height={NODE_HEIGHT}
                rx={10}
                fill="#0f172a"
                stroke={visual.boxStroke}
                strokeOpacity={node.tier === "idle" ? 0.85 : 0.8}
                strokeWidth={1.5}
              />
              <text x={418} y={cy - 4} fill="#f1f5f9" fontSize={12} fontWeight={600}>
                {truncateSvgLabel(node.label)}
              </text>
              <text x={418} y={cy + 13} fill={visual.textColor} fontSize={10} fontWeight={500}>
                {svgBadge}
              </text>
              <text
                x={582}
                y={cy - 4}
                textAnchor="end"
                fill={node.amount > 0n ? visual.textColor : "#94a3b8"}
                fontSize={12}
                fontWeight={600}
                fontFamily="var(--font-mono), monospace"
              >
                {formatUsdc(node.amount)}
              </text>
              <text x={582} y={cy + 13} textAnchor="end" fill="#94a3b8" fontSize={10}>
                {node.count > 0 ? `${node.count}× · USDC` : "USDC"}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-flow" aria-hidden="true" /> Agent → Policy
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-trusted" aria-hidden="true" /> Whitelist
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sandbox" aria-hidden="true" /> Sandbox
          </span>
        </div>
        <span>Độ dày nét tỷ lệ với USDC đã chi</span>
      </div>
    </div>
  );
}

type SpendFilter = "all" | "trusted" | "sandbox";

/** Khối Dòng tiền x402: sơ đồ nối dây + danh sách khoản chi event Authorized, mới nhất trên cùng. */
export function SpendsPanel({
  spends,
  loaded,
  error,
  promote,
  aliases,
  expanded = false,
}: {
  spends: Spend[];
  loaded: boolean;
  error: string | null;
  promote: PromoteWhitelistConfig;
  aliases?: Record<string, string> | null;
  expanded?: boolean;
}) {
  const [filter, setFilter] = useState<SpendFilter>("all");
  const flowSummary = summarizeSpendFlows(spends, {
    whitelist: promote.whitelist,
    aliases,
  });

  const visibleSpends =
    filter === "all" ? spends : spends.filter((s) => (filter === "sandbox" ? s.isSandbox : !s.isSandbox));

  return (
    <section className="flex h-full flex-col gap-4 rounded-xl border border-border bg-card/90 p-4 backdrop-blur-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ActivityFlowIcon className="h-4 w-4 text-flow" />
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Dòng tiền x402
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {loaded && (
            <span className="tabular-nums text-xs text-muted sm:text-sm">
              {spends.length} khoản ·{" "}
              <span className="font-mono font-semibold text-flow-text">{formatUsdc(totalSpent(spends))}</span> USDC
            </span>
          )}
        </div>
      </div>

      {error && (
        <div role="status" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger-text">
          Không đọc được event trên chuỗi, đang thử lại: {error}
        </div>
      )}

      {!loaded ? (
        <SpendsSkeleton />
      ) : (
        <>
          <SpendFlowDiagram summary={flowSummary} />

          {spends.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className="inline-flex flex-wrap gap-1 rounded-lg bg-surface-inset p-1 text-xs"
                role="group"
                aria-label="Lọc khoản chi theo tầng"
              >
                {(
                  [
                    { id: "all", label: `Tất cả (${spends.length})` },
                    { id: "trusted", label: `Whitelist (${spends.filter((s) => !s.isSandbox).length})` },
                    { id: "sandbox", label: `Sandbox (${spends.filter((s) => s.isSandbox).length})` },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={filter === item.id}
                    onClick={() => setFilter(item.id)}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      filter === item.id
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {spends.length === 0 ? (
            <div className="flex flex-col items-start gap-1.5 rounded-lg bg-surface-inset px-4 py-4 text-sm">
              <p className="font-medium text-foreground">Chưa có khoản chi x402 nào được ghi nhận.</p>
              <p className="text-xs leading-relaxed text-muted">
                Chạy Agent Đà Lạt từ thanh Demo phía trên (hoặc qua MCP/CLI) để xem dòng tiền chảy từ{" "}
                <span className="font-mono text-foreground">AgentPolicy</span> sang các API dữ liệu.
              </p>
            </div>
          ) : visibleSpends.length === 0 ? (
            <p className="rounded-lg bg-surface-inset px-3.5 py-3 text-xs text-muted">
              Không có khoản chi nào thuộc nhóm đang lọc.
            </p>
          ) : (
            <ul
              className={`al-scroll flex flex-col divide-y divide-border overflow-y-auto pr-1 ${
                expanded ? "max-h-[34rem]" : "max-h-52"
              }`}
            >
              {visibleSpends.map((s) => {
                const name = resolveSellerName(s.payTo, aliases);
                const eligibleForPromote = isUnknownOrSandboxSpend(s, promote.whitelist);
                return (
                  <li key={s.key} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
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
                          {s.released && (
                            <span
                              className="rounded-md border border-border bg-surface-inset px-2 py-0.5 text-xs text-muted"
                              title="Không được thanh toán, hạn mức đã hoàn lại"
                            >
                              Đã hoàn hạn mức
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
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
                            className="inline-flex items-center gap-0.5 font-medium text-flow hover:text-flow-text hover:underline"
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

                    <PromoteWhitelistAction payTo={s.payTo} eligible={eligibleForPromote} promote={promote} />
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <p className="mt-auto border-t border-border pt-2.5 text-xs leading-relaxed text-muted">
        Mỗi dòng ứng với một lần <code className="font-mono text-foreground">AgentPolicy</code> duyệt chi (event{" "}
        <code className="font-mono text-foreground">Authorized</code>). Lịch sử đồng bộ từ Routescan và RPC Fuji mỗi 3 giây.
      </p>
    </section>
  );
}

function SpendsSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label="Đang đọc lịch sử dòng tiền trên Fuji">
      <div className="h-40 w-full animate-pulse rounded-lg bg-surface-inset" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <div className="h-4 w-40 animate-pulse rounded bg-surface-inset" />
            <div className="h-3 w-52 animate-pulse rounded bg-surface-inset" />
          </div>
          <div className="h-4 w-20 animate-pulse rounded bg-surface-inset" />
        </div>
      ))}
    </div>
  );
}
