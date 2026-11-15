"use client";

import { addressUrl, shortAddress, txUrl } from "@/lib/chain";
import { formatUsdc } from "@/lib/policy";
import type { Rejection } from "@/lib/rejections";
import { sellerName, totalSpent, type Spend } from "@/lib/spends";

/** Hôm nay thì chỉ giờ, ngày khác thì kèm ngày/tháng. */
function formatTime(ms: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} ${time}`;
}

/** Ô [2]: các khoản chi policy đã duyệt (event Authorized), mới nhất trên cùng. */
export function SpendsCard({ spends, loaded, error }: { spends: Spend[]; loaded: boolean; error: string | null }) {
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
      ) : spends.length === 0 ? (
        <p className="text-sm text-muted">Chưa có khoản chi nào. Chạy agent để thấy dòng tiền chảy ra.</p>
      ) : (
        <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
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
