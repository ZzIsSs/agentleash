"use client";

import { useEffect, useId, useRef } from "react";
import type { Address } from "viem";
import { shortAddress, txUrl } from "@/lib/chain";
import type { TxState } from "@/lib/ownerTx";
import type { PolicyRaw } from "@/lib/policy";
import {
  AlertTriangleIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CloseIcon,
  LockIcon,
  UnlockIcon,
} from "./Icons";

/** Nút khóa khẩn cấp ở thanh trên cùng: luôn hiện, chỉ bấm được khi ví đang đăng nhập là chủ policy. */
export function KillSwitch({
  raw,
  isOwner,
  busy,
  onRequest,
}: {
  raw: PolicyRaw | null;
  isOwner: boolean;
  busy: boolean;
  onRequest: (action: "pause" | "unpause") => void;
}) {
  const disabled = !raw || !isOwner || busy;
  const reason = !raw
    ? "Đang đọc trạng thái policy trên Fuji…"
    : !isOwner
      ? "Chỉ ví chủ policy mới bấm được. Tạo policy của bạn ở mục Policy & luật chi tiêu."
      : busy
        ? "Đang có giao dịch chờ xác nhận."
        : undefined;

  if (raw?.paused) {
    return (
      <button
        type="button"
        onClick={() => onRequest("unpause")}
        disabled={disabled}
        title={reason}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-trusted bg-trusted/15 px-3.5 py-2 text-xs font-bold tracking-wide text-trusted-text transition hover:bg-trusted/25 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <UnlockIcon className="h-4 w-4 shrink-0" />
        <span>MỞ KHÓA</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onRequest("pause")}
      disabled={disabled}
      title={reason}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-danger bg-danger-solid px-3.5 py-2 text-xs font-bold tracking-wide text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:border-danger/40 disabled:bg-danger-solid/40 disabled:text-white/75"
    >
      <LockIcon className="h-4 w-4 shrink-0" />
      <span>KHÓA KHẨN CẤP</span>
    </button>
  );
}

/** Hộp thoại xác nhận dùng phần tử `<dialog>` chuẩn HTML5 (showModal + Esc tự động). */
export function ConfirmDialog({
  action,
  policy,
  onCancel,
  onConfirm,
}: {
  action: "pause" | "unpause";
  policy: Address;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const pausing = action === "pause";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      dialog.showModal();
    }
    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onCancel}
      className={`rounded-xl border bg-card p-0 text-foreground shadow-2xl ${
        pausing ? "border-danger/60" : "border-trusted/60"
      }`}
    >
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
              pausing
                ? "border-danger/35 bg-danger/10 text-danger-text"
                : "border-trusted/35 bg-trusted/10 text-trusted-text"
            }`}
          >
            {pausing ? <LockIcon className="h-5 w-5" /> : <UnlockIcon className="h-5 w-5" />}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={titleId} className="text-base font-bold text-foreground">
              {pausing ? "Khóa khẩn cấp toàn bộ policy?" : "Mở khóa hoạt động policy?"}
            </h2>
            <p className="text-sm leading-relaxed text-muted">
              {pausing
                ? "Mọi khoản chi tiếp theo của agent sẽ bị contract từ chối ngay lập tức, kể cả khoản đã authorize nhưng chưa settle."
                : "Agent sẽ được phép xin chi trở lại trong phần hạn mức còn lại của chu kỳ."}{" "}
              Lệnh này cần 1 chữ ký giao dịch trên Fuji (tốn ít AVAX test trả gas).
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-surface-inset px-3 py-2 font-mono text-xs text-muted">
          Policy: <span className="break-all text-foreground">{policy}</span>
        </div>

        <div className="flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            autoFocus={pausing}
            onClick={onCancel}
            className="min-h-10 rounded-lg border border-border-control bg-surface-inset px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-elevated"
          >
            Hủy
          </button>
          <button
            type="button"
            autoFocus={!pausing}
            onClick={onConfirm}
            className={`min-h-10 rounded-lg px-4 py-2 text-sm font-bold transition ${
              pausing
                ? "bg-danger-solid text-white hover:bg-red-700"
                : "bg-trusted text-background hover:opacity-90"
            }`}
          >
            {pausing ? "Xác nhận khóa ngay" : "Mở khóa policy"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

const TX_STEPS = ["Đang ký Privy", "Chờ xác nhận Fuji", "Hoàn tất"] as const;

/** Thanh trạng thái 3 bước cho lệnh chủ ký gần nhất. */
export function TxBanner({ state, onClose }: { state: TxState; onClose: () => void }) {
  if (state.phase === "idle") return null;
  const step = state.phase === "signing" ? 0 : state.phase === "pending" ? 1 : 2;
  const failed = state.phase === "error";
  const hash = "hash" in state ? state.hash : undefined;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        failed
          ? "border-danger/45 bg-danger/10"
          : state.phase === "done"
            ? "border-trusted/45 bg-trusted/10"
            : "border-flow/45 bg-flow/10"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 font-semibold text-foreground">
          {failed ? (
            <AlertTriangleIcon className="h-4 w-4 shrink-0 text-danger-text" />
          ) : state.phase === "done" ? (
            <CheckIcon className="h-4 w-4 shrink-0 text-trusted-text" />
          ) : (
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-flow" />
          )}
          {state.label}
        </span>

        {failed ? (
          <span className="text-danger-text">{state.message}</span>
        ) : (
          <ol className="flex flex-wrap items-center gap-1.5">
            {TX_STEPS.map((name, i) => {
              const completed = i < step || state.phase === "done";
              const active = i === step && state.phase !== "done";
              return (
                <li
                  key={name}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${
                    completed
                      ? "border-trusted/30 bg-trusted/15 text-trusted-text"
                      : active
                        ? "border-flow/35 bg-flow/15 text-flow-text"
                        : "border-border bg-surface-inset text-muted"
                  }`}
                >
                  {completed ? (
                    <CheckIcon className="h-3 w-3 shrink-0" />
                  ) : active ? (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-flow" />
                  ) : (
                    <span className="tabular-nums text-xs">{i + 1}</span>
                  )}
                  <span>{name}</span>
                </li>
              );
            })}
          </ol>
        )}

        {state.phase === "signing" && (
          <span className="text-xs text-muted">Xác nhận chữ ký trong cửa sổ Privy.</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {hash && (
          <a
            href={txUrl(hash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-flow hover:text-flow-text hover:underline"
          >
            {shortAddress(hash)} · Snowscan
            <ArrowUpRightIcon className="h-3 w-3" />
          </a>
        )}
        {(state.phase === "done" || failed) && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông báo giao dịch"
            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-border-control bg-surface-inset px-2.5 py-1 text-xs text-muted transition hover:text-foreground"
          >
            <span>Đóng</span>
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
