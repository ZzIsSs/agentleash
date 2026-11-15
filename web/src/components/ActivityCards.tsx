"use client";

import { useId } from "react";
import { addressUrl, shortAddress, txUrl } from "@/lib/chain";
import { formatUsdc } from "@/lib/policy";
import type { Rejection } from "@/lib/rejections";
import {
  sellerName,
  summarizeSpendFlows,
  totalSpent,
  type FlowNodeSummary,
  type Spend,
  type SpendFlowSummary,
} from "@/lib/spends";

/** Hôm nay thì chỉ giờ, ngày khác thì kèm ngày/tháng. */
function formatTime(ms: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} ${time}`;
}

const TARGET_CENTERS = [31, 92, 153] as const;

const TIER_VISUAL: Record<
  FlowNodeSummary["tier"],
  { textColor: string; boxStroke: string; badgeText: string }
> = {
  trusted: { textColor: "#22c55e", boxStroke: "#22c55e", badgeText: "Whitelist" },
  sandbox: { textColor: "#eab308", boxStroke: "#eab308", badgeText: "Sandbox" },
  mixed: { textColor: "#eab308", boxStroke: "#eab308", badgeText: "WL + Sandbox" },
  idle: { textColor: "#94a3b8", boxStroke: "#1e293b", badgeText: "Chưa chi" },
};

/** Sơ đồ SVG thuần Agent → Policy → API: độ dày đường nối tỷ lệ theo tổng USDC đã chi (bỏ khoản released). */
function SpendFlowDiagram({ summary }: { summary: SpendFlowSummary }) {
  const uid = useId();
  const mixedGradId = `${uid}-mixed-grad`;
  const hasAnySpend = summary.totalAmount > 0n;
  const [w, r, u] = summary.nodes;
  const ariaSummary = `Sơ đồ dòng tiền Agent qua Policy tới các API: Thời tiết ${formatUsdc(w.amount)} USDC, Tỷ giá ${formatUsdc(r.amount)} USDC, Địa chỉ lạ ${formatUsdc(u.amount)} USDC.`;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
      <svg
        viewBox="0 0 600 184"
        role="img"
        aria-label={ariaSummary}
        className="h-auto w-full select-none"
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
          d="M 118 92 C 150 92, 164 92, 194 92"
          fill="none"
          stroke={hasAnySpend ? "#22d3ee" : "#334155"}
          strokeWidth={hasAnySpend ? 6 : 1.5}
          strokeDasharray={hasAnySpend ? undefined : "4 4"}
          strokeLinecap="round"
        />
        <circle cx={194} cy={92} r={hasAnySpend ? 4 : 2.5} fill={hasAnySpend ? "#22d3ee" : "#475569"} />

        {/* Policy → từng API */}
        {summary.nodes.map((node, idx) => {
          const cy = TARGET_CENTERS[idx];
          const path = `M 332 92 C 370 92, 370 ${cy}, 408 ${cy}`;
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
                strokeDasharray={node.tier === "idle" ? "4 4" : undefined}
                strokeOpacity={node.tier === "idle" ? 0.45 : 0.9}
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
        <rect x={8} y={64} width={110} height={56} rx={12} fill="#0f172a" stroke="#1e293b" strokeWidth={1.5} />
        <text x={63} y={89} textAnchor="middle" fill="#e2e8f0" fontSize={12} fontWeight={600}>
          AI Agent
        </text>
        <text x={63} y={106} textAnchor="middle" fill="#94a3b8" fontSize={10}>
          Xin chi x402
        </text>

        {/* Node: AgentPolicy */}
        <rect
          x={194}
          y={56}
          width={138}
          height={72}
          rx={12}
          fill="#0f172a"
          stroke={hasAnySpend ? "#22d3ee" : "#1e293b"}
          strokeOpacity={hasAnySpend ? 0.7 : 1}
          strokeWidth={1.5}
        />
        <text x={263} y={80} textAnchor="middle" fill="#e2e8f0" fontSize={12} fontWeight={600}>
          AgentPolicy
        </text>
        <text
          x={263}
          y={99}
          textAnchor="middle"
          fill="#22d3ee"
          fontSize={12}
          fontWeight={600}
          fontFamily="var(--font-mono), monospace"
        >
          {formatUsdc(summary.totalAmount)} USDC
        </text>
        <text x={263} y={116} textAnchor="middle" fill="#94a3b8" fontSize={10}>
          {summary.totalCount} khoản đã chi
        </text>

        {/* Nodes: Thời tiết, Tỷ giá, Địa chỉ lạ */}
        {summary.nodes.map((node, idx) => {
          const cy = TARGET_CENTERS[idx];
          const top = cy - 23;
          const visual = TIER_VISUAL[node.tier];
          return (
            <g key={node.id}>
              <rect
                x={408}
                y={top}
                width={184}
                height={46}
                rx={10}
                fill="#0f172a"
                stroke={visual.boxStroke}
                strokeOpacity={node.tier === "idle" ? 1 : 0.65}
                strokeWidth={1.5}
              />
              <text x={418} y={cy - 4} fill="#e2e8f0" fontSize={12} fontWeight={600}>
                {node.label}
              </text>
              <text x={418} y={cy + 13} fill={visual.textColor} fontSize={10} fontWeight={500}>
                {visual.badgeText}
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

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-flow" /> Agent → Policy
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-trusted" /> Whitelist
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sandbox" /> Sandbox
          </span>
        </div>
        <span>Độ dày nét = tỷ lệ USDC đã chi</span>
      </div>
    </div>
  );
}

/** Ô [2]: các khoản chi policy đã duyệt (event Authorized), mới nhất trên cùng. */
export function SpendsCard({ spends, loaded, error }: { spends: Spend[]; loaded: boolean; error: string | null }) {
  const flowSummary = summarizeSpendFlows(spends);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          <span className="text-muted">[2]</span> Dòng tiền
        </h2>
        {loaded && (
          <span className="text-sm text-muted">
            {spends.length} khoản · <span className="font-mono text-flow">{formatUsdc(totalSpent(spends))}</span> USDC
          </span>
        )}
      </div>
      {error && <p className="text-xs text-danger">Không đọc được event, đang thử lại: {error}</p>}
      {!loaded ? (
        <p className="text-muted">Đang đọc lịch sử chi trên Fuji…</p>
      ) : (
        <>
          <SpendFlowDiagram summary={flowSummary} />
          {spends.length === 0 ? (
            <p className="text-sm text-muted">Chưa có khoản chi nào. Chạy agent để thấy dòng tiền chảy ra.</p>
          ) : (
            <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
          {spends.map((s) => {
            const name = sellerName(s.payTo);
            return (
              <li key={s.key} className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{name ?? "Địa chỉ lạ"}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        s.isSandbox ? "bg-sandbox/15 text-sandbox" : "bg-trusted/15 text-trusted"
                      }`}
                    >
                      {s.isSandbox ? "Sandbox" : "Whitelist"}
                    </span>
                    {s.released && (
                      <span className="rounded-full bg-muted/15 px-2 py-0.5 text-[11px] text-muted" title="Không được thanh toán, hạn mức đã hoàn lại">
                        Đã hoàn hạn mức
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted">
                    <span>{formatTime(s.timestamp === null ? null : s.timestamp * 1000)}</span>
                    <a href={addressUrl(s.payTo)} target="_blank" rel="noreferrer" className="font-mono hover:text-flow">
                      → {shortAddress(s.payTo)}
                    </a>
                    <a href={txUrl(s.txHash)} target="_blank" rel="noreferrer" className="text-flow hover:underline">
                      Snowscan ↗
                    </a>
                  </div>
                </div>
                <span className={`shrink-0 font-mono font-semibold ${s.released ? "text-muted line-through" : "text-flow"}`}>
                  −{formatUsdc(s.amount)} USDC
                </span>
              </li>
            );
          })}
        </ul>
          )}
        </>
      )}
      <p className="text-xs text-muted">
        Mỗi dòng là một lần policy duyệt chi (event <code>Authorized</code>). Lịch sử lấy từ Routescan, khoản mới đọc từ
        RPC Fuji 3 giây một lần.
      </p>
    </section>
  );
}

/** Ô [4]: các lần agent bị chặn, gộp rule engine (ngoài chuỗi) và contract (trên chuỗi). */
export function RejectionsCard({ items, available }: { items: Rejection[]; available: boolean | null }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          <span className="text-muted">[4]</span> Bị từ chối
        </h2>
        {items.length > 0 && <span className="text-sm text-danger">{items.length} lần bị chặn</span>}
      </div>
      {available === false ? (
        <p className="text-sm text-muted">
          Không thấy nhật ký agent (<code>agent/logs/audit.json</code>). Mục này chỉ có khi agent chạy cùng máy với
          dashboard.
        </p>
      ) : available === null ? (
        <p className="text-muted">Đang đọc nhật ký agent…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">Chưa có lần nào bị chặn.</p>
      ) : (
        <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
          {items.map((r) => (
            <li key={r.id} className="flex flex-col gap-1 rounded-xl border-l-4 border-danger bg-background px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    r.source === "contract" ? "bg-danger/15 text-danger" : "bg-sandbox/15 text-sandbox"
                  }`}
                  title={r.source === "contract" ? "Contract từ chối trên chuỗi" : "Rule engine chặn trước khi gọi contract"}
                >
                  {r.source === "contract" ? "Contract chặn" : "Rule engine chặn"}
                </span>
                <span className="font-medium">{r.title}</span>
              </div>
              {r.detail && r.detail !== r.title && <p className="text-xs text-muted">{r.detail}</p>}
              <div className="flex flex-wrap gap-x-3 text-xs text-muted">
                <span>{formatTime(r.time)}</span>
                <span>API: {r.api}</span>
                {r.amountUnits !== null && <span className="font-mono">{formatUsdc(r.amountUnits)} USDC</span>}
                <span className="font-mono">{r.code}</span>
                {r.bypassRules && <span className="text-danger">Agent bị chiếm: bỏ qua rule engine</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
