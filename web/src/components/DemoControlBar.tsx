"use client";

import { useId, useState } from "react";
import type { Address } from "viem";
import { shortAddress, txUrl } from "@/lib/chain";
import { buildDemoCliCommand } from "@/lib/demoRun";
import type { Rejection } from "@/lib/rejections";
import type { Spend } from "@/lib/spends";
import type { DemoRunState, DemoRunnerAvailability } from "@/lib/useDemoRunner";
import {
  AlertTriangleIcon,
  ArrowUpRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  PlayIcon,
  TerminalIcon,
} from "./Icons";

type DemoStepInfo = {
  num: number;
  label: string;
  done: boolean;
  active?: boolean;
};

/** Thanh điều khiển Demo 2 phút chuyên biệt có thể thu gọn: tách biệt hẳn với bảng luật production. */
export function DemoControlBar({
  policy,
  authenticated,
  isPaused,
  hasSpends,
  hasWhitelistCapBlock,
  hasSandboxBlock,
  availability,
  runState,
  onRunDemo,
  onResetDemoRun,
}: {
  policy: Address;
  authenticated: boolean;
  isPaused: boolean;
  hasSpends: boolean;
  hasWhitelistCapBlock: boolean;
  hasSandboxBlock: boolean;
  availability: DemoRunnerAvailability | null;
  runState: DemoRunState;
  onRunDemo: (bypassRules: boolean) => void;
  onResetDemoRun?: () => void;
}) {
  const switchId = useId();
  const hintId = useId();
  const panelId = useId();

  const [expanded, setExpanded] = useState(true);
  const [bypassRules, setBypassRules] = useState(false);
  const [copied, setCopied] = useState(false);

  const running = runState.phase === "running";
  const canRunLocal = authenticated && !!availability?.available && !running;
  const cliCommand = buildDemoCliCommand(bypassRules, policy);
  const showModeResult =
    runState.phase !== "idle" && runState.phase !== "running" && runState.bypassRules === bypassRules;

  const steps: DemoStepInfo[] = [
    { num: 1, label: "Đăng nhập", done: authenticated, active: !authenticated },
    { num: 2, label: "Luật 2 tầng", done: authenticated },
    { num: 3, label: "Mua x402", done: hasSpends, active: authenticated && !hasSpends },
    { num: 4, label: "Chặn trần", done: hasWhitelistCapBlock },
    { num: 5, label: "Sandbox", done: hasSandboxBlock, active: bypassRules && !hasSandboxBlock },
    { num: 6, label: "Kill Switch", done: isPaused },
    { num: 7, label: "Snowscan", done: hasSpends && isPaused },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cliCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback: người dùng copy trực tiếp từ thẻ <code>.
    }
  };

  return (
    <section
      aria-label="Bảng điều khiển Demo 2 phút"
      className={`rounded-xl border backdrop-blur-sm transition-colors ${
        bypassRules
          ? "border-danger/45 bg-card/90"
          : "border-sandbox/35 bg-card/90"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${
              bypassRules
                ? "border-danger/35 bg-danger/10 text-danger-text"
                : "border-sandbox/35 bg-sandbox/10 text-sandbox-text"
            }`}
          >
            <TerminalIcon className="h-3.5 w-3.5" />
            <span>Demo 2 phút</span>
          </span>
          <span className="text-sm font-medium text-foreground">
            {bypassRules
              ? "Giả lập agent bị chiếm quyền (--bypass-rules)"
              : "Luồng mẫu Đà Lạt (--mock-llm) & kiểm thử 7 bước"}
          </span>
          <span className="tabular-nums font-mono text-xs text-muted">
            {completedCount}/7 mốc
          </span>
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-control bg-surface-inset px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-elevated"
        >
          <span>{expanded ? "Thu gọn" : "Mở bảng Demo"}</span>
          <ChevronDownIcon
            className={`h-3.5 w-3.5 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {expanded && (
        <div id={panelId} className="flex flex-col gap-3 border-t border-border px-4 py-3.5 sm:px-5">
          {/* Thanh tiến trình 7 bước kịch bản UniHack */}
          <ol className="flex flex-wrap gap-1.5 lg:grid lg:grid-cols-7" aria-label="Tiến trình kịch bản demo 7 bước">
            {steps.map((step) => (
              <li
                key={step.num}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
                  step.done
                    ? "border-trusted/30 bg-trusted/10 text-trusted-text"
                    : step.active
                      ? "border-flow/40 bg-flow/10 text-flow-text"
                      : "border-border bg-surface-inset text-muted"
                }`}
              >
                <span
                  className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded font-mono text-xs font-semibold ${
                    step.done
                      ? "bg-trusted/20 text-trusted-text"
                      : step.active
                        ? "bg-flow/20 text-flow-text"
                        : "bg-card text-muted"
                  }`}
                >
                  {step.done ? <CheckIcon className="h-3 w-3" /> : step.num}
                </span>
                <span className="font-medium whitespace-nowrap">{step.label}</span>
              </li>
            ))}
          </ol>

          {/* Hàng công tắc --bypass-rules + nút chạy */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canRunLocal) onRunDemo(bypassRules);
            }}
            className={`flex flex-col gap-3 border-t border-border pt-3 ${
              bypassRules ? "text-foreground" : ""
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <input
                  id={switchId}
                  name="bypassRules"
                  type="checkbox"
                  role="switch"
                  aria-checked={bypassRules}
                  aria-describedby={hintId}
                  checked={bypassRules}
                  onChange={(e) => {
                    setBypassRules(e.target.checked);
                    onResetDemoRun?.();
                  }}
                  {...({ switch: "" } as Record<string, string>)}
                  className="al-switch"
                />
                <label htmlFor={switchId} className="cursor-pointer text-xs font-semibold text-foreground sm:text-sm">
                  Bỏ qua Rule Engine (<code className="font-mono text-xs text-sandbox-text">--bypass-rules</code>)
                </label>
              </div>

              <button
                type="submit"
                disabled={!canRunLocal}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 sm:text-sm ${
                  bypassRules
                    ? "bg-danger-solid text-white hover:bg-red-700"
                    : "bg-flow text-background hover:bg-flow-text"
                }`}
              >
                {bypassRules ? (
                  <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                ) : (
                  <PlayIcon className="h-4 w-4 shrink-0" />
                )}
                <span>
                  {running
                    ? "Đang chạy agent trên Fuji…"
                    : bypassRules
                      ? "Thử tấn công địa chỉ lạ"
                      : "Chạy Agent Đà Lạt (mock)"}
                </span>
              </button>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <p id={hintId} className="text-xs leading-relaxed text-muted">
                {bypassRules
                  ? "Đang BẬT: Tắt kiểm tra off-chain, giả lập agent bị chiếm gọi thẳng địa chỉ lạ 0x1111…1111 (0.001 USDC) để AgentPolicy chặn ở tầng Sandbox."
                  : "Đang TẮT: Agent chạy Rule Engine + Gemini mock (--mock-llm) thực hiện mua dữ liệu Thời tiết & Tỷ giá hợp lệ."}
              </p>

              <div className="flex min-w-0 items-center gap-2 rounded-lg bg-surface-inset px-3 py-1.5 text-xs">
                <code className="min-w-0 truncate font-mono text-xs text-foreground">{cliCommand}</code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded border border-border-control bg-card px-2.5 py-0.5 text-xs font-medium text-foreground transition hover:bg-surface-elevated"
                >
                  {copied ? <CheckIcon className="h-3 w-3 text-trusted-text" /> : <CopyIcon className="h-3 w-3" />}
                  <span>{copied ? "Đã chép" : "Chép CLI"}</span>
                </button>
              </div>
            </div>

            {availability && !availability.available && (
              <p className="text-xs text-sandbox-text">
                {availability.reason ??
                  "Nút chạy trực tiếp chỉ khả dụng khi chạy local cùng agent; có thể dùng lệnh CLI bên phải để thử."}
              </p>
            )}
            {availability?.available && !authenticated && (
              <p className="text-xs text-muted">
                Đăng nhập ví Privy ở thanh trên để kích hoạt nút chạy trực tiếp từ trình duyệt, hoặc chạy lệnh CLI bên phải.
              </p>
            )}

            {showModeResult && runState.phase === "done" && (
              <div
                role="status"
                aria-live="polite"
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold text-trusted-text">
                    Kết quả ({runState.bypassRules ? "Bỏ qua Rule Engine" : "Có Rule Engine"}):
                  </span>
                  <span className="tabular-nums text-foreground">
                    Thành công: <strong>{runState.summary.successCount ?? 0}</strong> · Bị chặn:{" "}
                    <strong className="text-danger-text">{runState.summary.blockedCount ?? 0}</strong>
                  </span>
                  {runState.summary.balanceUsdc && (
                    <span className="tabular-nums font-mono text-muted">
                      Số dư: {runState.summary.balanceUsdc} USDC
                    </span>
                  )}
                </div>
                {runState.summary.blockedLines.map((line, idx) => (
                  <p key={idx} className="font-mono text-xs text-danger-text">
                    {line}
                  </p>
                ))}
                {runState.summary.txHashes.length > 0 && (
                  <div className="flex flex-wrap gap-2.5">
                    {runState.summary.txHashes.slice(0, 3).map((hash) => (
                      <a
                        key={hash}
                        href={txUrl(hash)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-flow hover:text-flow-text hover:underline"
                      >
                        {shortAddress(hash)}
                        <ArrowUpRightIcon className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showModeResult && runState.phase === "error" && (
              <p role="status" aria-live="polite" className="text-xs font-medium text-danger-text">
                Lỗi chạy agent: {runState.message}
              </p>
            )}
          </form>
        </div>
      )}
    </section>
  );
}

/** Suy luận tiến độ demo từ danh sách rejections hiện tại. */
export function deriveDemoMilestones(rejections: readonly Rejection[], spends: readonly Spend[]) {
  const hasWhitelistCapBlock = rejections.some(
    (r) => r.code === "ExceedsDailyCap" || r.code === "ExceedsPerTxCap",
  );
  const hasSandboxBlock = rejections.some(
    (r) => r.code === "ExceedsSandboxPerTxCap" || r.code === "ExceedsSandboxDailyCap" || r.bypassRules,
  );
  const hasSpends = spends.some((s) => !s.released);
  return { hasSpends, hasWhitelistCapBlock, hasSandboxBlock };
}
