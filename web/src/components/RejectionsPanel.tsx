"use client";

import { useState } from "react";
import { addressUrl, shortAddress } from "@/lib/chain";
import { formatUsdc } from "@/lib/policy";
import type { Rejection, RejectionSource } from "@/lib/rejections";
import { resolveSellerName } from "@/lib/sellerAliases";
import { isUnknownOrSandboxRejection } from "@/lib/whitelistPromote";
import { AlertTriangleIcon, ArrowUpRightIcon, ShieldBanIcon } from "./Icons";
import { PromoteWhitelistAction, type PromoteWhitelistConfig } from "./PromoteWhitelistAction";
import { formatActivityTime } from "./formatTime";

type SourceFilter = "all" | RejectionSource;

/** Khối Nhật ký bị từ chối: gộp các lần bị chặn ở Rule Engine và Smart Contract, kèm nút 1-click duyệt API quen. */
export function RejectionsPanel({
  items,
  total,
  available,
  promote,
  aliases,
  expanded = false,
}: {
  items: Rejection[];
  total?: number;
  available: boolean | null;
  promote: PromoteWhitelistConfig;
  aliases?: Record<string, string> | null;
  expanded?: boolean;
}) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const totalCount = Math.max(total ?? items.length, items.length);

  const visibleItems =
    sourceFilter === "all" ? items : items.filter((r) => r.source === sourceFilter);

  return (
    <section className="flex h-full flex-col gap-4 rounded-xl border border-border bg-card/90 p-4 backdrop-blur-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldBanIcon className="h-4 w-4 text-danger-text" />
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Nhật ký bị từ chối
          </h2>
        </div>

        {totalCount > 0 && (
          <span className="tabular-nums inline-flex items-center gap-1.5 rounded-md border border-danger/35 bg-danger/10 px-2.5 py-0.5 text-xs font-semibold text-danger-text">
            <span>{totalCount} lần bị chặn</span>
            {totalCount > items.length && (
              <span className="font-normal text-muted">· hiện {items.length} gần nhất</span>
            )}
          </span>
        )}
      </div>

      {available === null ? (
        <RejectionsSkeleton />
      ) : available === false ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-inset px-4 py-4 text-sm">
          <p className="font-medium text-foreground">Chưa kết nối nguồn nhật ký agent</p>
          <p className="text-xs leading-relaxed text-muted">
            Không tìm thấy <code className="font-mono text-foreground">agent/logs/audit.json</code>. Mục này tự đồng bộ
            khi chạy agent cùng máy với Dashboard, hoặc khi cấu hình Upstash Redis cho bản Vercel online.
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col gap-1.5 rounded-lg bg-surface-inset px-4 py-4 text-sm">
          <p className="font-medium text-foreground">Chưa có yêu cầu nào bị chặn.</p>
          <p className="text-xs leading-relaxed text-muted">
            Khi agent chi vượt trần Whitelist, gọi địa chỉ lạ vượt trần Sandbox (hoặc bật công tắc{" "}
            <span className="font-mono text-foreground">--bypass-rules</span> ở thanh Demo), lý do chặn tiếng Việt sẽ
            hiện tại đây.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              className="inline-flex flex-wrap gap-1 rounded-lg bg-surface-inset p-1 text-xs"
              role="group"
              aria-label="Lọc theo lớp chặn"
            >
              {(
                [
                  { id: "all", label: `Tất cả (${items.length})` },
                  { id: "contract", label: `Contract (${items.filter((r) => r.source === "contract").length})` },
                  { id: "rule-engine", label: `Rule Engine (${items.filter((r) => r.source === "rule-engine").length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={sourceFilter === tab.id}
                  onClick={() => setSourceFilter(tab.id)}
                  className={`rounded-md px-2.5 py-1 font-medium transition ${
                    sourceFilter === tab.id
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {visibleItems.length === 0 ? (
            <p className="rounded-lg bg-surface-inset px-3.5 py-3 text-xs text-muted">
              Không có bản ghi nào thuộc lớp chặn đang lọc.
            </p>
          ) : (
            <ul
              className={`al-scroll flex flex-col divide-y divide-border overflow-y-auto pr-1 ${
                expanded ? "max-h-[38rem]" : "max-h-[26rem]"
              }`}
            >
              {visibleItems.map((r) => {
                const eligibleForPromote = isUnknownOrSandboxRejection(r);
                const isContract = r.source === "contract";
                return (
                  <li
                    key={r.id}
                    className={`flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 ${
                      isContract ? "bg-transparent" : "bg-transparent"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          isContract
                            ? "border-danger/35 bg-danger/15 text-danger-text"
                            : "border-sandbox/35 bg-sandbox/15 text-sandbox-text"
                        }`}
                        title={
                          isContract
                            ? "Smart contract AgentPolicy từ chối trên chuỗi"
                            : "Rule engine chặn ngoài chuỗi trước khi gọi contract"
                        }
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

                    {r.detail && r.detail !== r.title && (
                      <p className="text-xs leading-relaxed text-muted">{r.detail}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="tabular-nums font-mono">{formatActivityTime(r.time)}</span>
                      <span>API: {r.payTo ? resolveSellerName(r.payTo, aliases) : r.api}</span>
                      {r.payTo && (
                        <a
                          href={addressUrl(r.payTo)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 font-mono hover:text-flow hover:underline"
                        >
                          → {shortAddress(r.payTo)}
                          <ArrowUpRightIcon className="h-3 w-3" />
                        </a>
                      )}
                      {r.amountUnits !== null && (
                        <span className="tabular-nums font-mono text-foreground">{formatUsdc(r.amountUnits)} USDC</span>
                      )}
                      <code className="rounded bg-surface-inset px-1.5 py-0.5 font-mono text-xs text-foreground">
                        {r.code}
                      </code>
                      {r.bypassRules && (
                        <span className="font-medium text-danger-text">Giả lập bị chiếm: bỏ qua Rule Engine</span>
                      )}
                    </div>

                    <PromoteWhitelistAction
                      payTo={r.payTo}
                      eligible={eligibleForPromote}
                      promote={promote}
                      suggestedAlias={r.api}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function RejectionsSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" role="status" aria-busy="true" aria-label="Đang đọc nhật ký từ chối">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg bg-surface-inset p-3.5">
          <div className="flex items-center gap-2">
            <div className="h-5 w-24 animate-pulse rounded bg-surface-elevated" />
            <div className="h-4 w-48 animate-pulse rounded bg-surface-elevated" />
          </div>
          <div className="h-3 w-64 animate-pulse rounded bg-surface-elevated" />
        </div>
      ))}
    </div>
  );
}
