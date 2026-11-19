"use client";

import Link from "next/link";
import { formatUsdc } from "@/lib/policy";
import { useConsole } from "./ConsoleProvider";
import { RejectionsPanel } from "./RejectionsPanel";

/** Trang /audit — Tóm tắt 4 lớp bảo vệ RuleEngine & Contract + Nhật ký bị từ chối đầy đủ. */
export function AuditView() {
  const { raw, rejections, promoteConfig, aliases } = useConsole();

  const layers = [
    {
      name: "Lớp 1 · Sandbox Cap",
      metric: raw
        ? `${formatUsdc(raw.sandboxPerTxCap)} / ${formatUsdc(raw.sandboxDailyCap)} USDC`
        : "Đang đọc…",
      accent: "text-sandbox-text",
      badgeClass: "border-sandbox/35 bg-sandbox/10 text-sandbox-text",
      badge: "On-chain",
      detail: "Giới hạn tối đa mỗi lần / chu kỳ cho địa chỉ chưa whitelist; luôn có hiệu lực kể cả khi bypass RuleEngine.",
    },
    {
      name: "Lớp 2 · Chống SSRF",
      metric: "HTTP/HTTPS Safe URL",
      accent: "text-trusted-text",
      badgeClass: "border-trusted/30 bg-trusted/10 text-trusted-text",
      badge: "Gateway",
      detail: "Chặn scheme lạ và dải IP metadata cloud (169.254.169.254, metadata.google.internal) ngay trước khi gọi.",
    },
    {
      name: "Lớp 3 · Rate Limit & Loop",
      metric: "Chống lặp vô hạn",
      accent: "text-flow-text",
      badgeClass: "border-flow/35 bg-flow/10 text-flow-text",
      badge: "Off-chain",
      detail: "Giới hạn tần suất gọi/phút, chống trùng query liên tiếp và ngắt chuỗi lỗi lặp (LOOP_DETECTED).",
    },
    {
      name: "Lớp 4 · Khớp giá 402",
      metric: "Strict payTo & Price",
      accent: "text-trusted-text",
      badgeClass: "border-trusted/30 bg-trusted/10 text-trusted-text",
      badge: "402 Check",
      detail: "Đối chiếu hóa đơn HTTP 402 đúng địa chỉ người bán đã đăng ký và không vượt trần giá kỳ vọng.",
    },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/90 px-4 py-3.5 backdrop-blur-sm sm:px-5">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Nhật ký bị từ chối & RuleEngine
          </h1>
          <p className="mt-0.5 text-xs leading-relaxed text-muted sm:text-sm">
            Theo dõi toàn bộ yêu cầu bị chặn bởi Rule Engine (0 gas) hoặc Smart Contract trên chuỗi, kèm nút 1-click{" "}
            <span className="font-medium text-flow-text">Chuyển thành API quen</span>.
          </p>
        </div>

        <Link
          href="/policies"
          className="inline-flex min-h-9 items-center rounded-lg border border-border-control bg-surface-inset px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-elevated"
        >
          Chỉnh Whitelist & Hạn mức →
        </Link>
      </section>

      <section
        aria-label="Tóm tắt 4 lớp bảo vệ RuleEngine và Contract"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {layers.map((layer) => (
          <div
            key={layer.name}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card/90 p-4 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">{layer.name}</span>
              <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${layer.badgeClass}`}>
                {layer.badge}
              </span>
            </div>
            <div className={`tabular-nums font-mono text-sm font-semibold ${layer.accent}`}>
              {layer.metric}
            </div>
            <p className="text-xs leading-relaxed text-muted">{layer.detail}</p>
          </div>
        ))}
      </section>

      <RejectionsPanel
        items={rejections.items}
        total={rejections.total}
        available={rejections.available}
        promote={promoteConfig}
        aliases={aliases}
        expanded
      />
    </div>
  );
}
