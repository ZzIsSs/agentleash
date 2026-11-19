"use client";

import type { Address } from "viem";
import { shortAddress, txUrl } from "@/lib/chain";
import type { TxState } from "@/lib/ownerTx";
import { getPromoteButtonState } from "@/lib/whitelistPromote";
import { ArrowUpRightIcon, CheckIcon, ShieldCheckIcon } from "./Icons";

export type PromoteWhitelistConfig = {
  whitelist: Record<string, boolean> | null;
  authenticated: boolean;
  isOwner: boolean;
  ownerReady: boolean;
  busy: boolean;
  txState: TxState;
  promotingTarget: Address | null;
  onPromote: (payTo: Address, suggestedAlias?: string | null) => void;
};

/** Nút 1-click "Chuyển thành API quen" + trạng thái tx ngay cạnh giao dịch API lạ / Sandbox. */
export function PromoteWhitelistAction({
  payTo,
  eligible,
  promote,
  suggestedAlias,
}: {
  payTo: string | null | undefined;
  eligible: boolean;
  promote: PromoteWhitelistConfig;
  suggestedAlias?: string | null;
}) {
  if (!eligible) return null;

  const btnState = getPromoteButtonState({
    payTo,
    whitelist: promote.whitelist,
    isOwner: promote.isOwner,
    ownerReady: promote.ownerReady,
    busy: promote.busy,
  });

  const targetLower = btnState.targetAddress?.toLowerCase();
  const isActiveTarget =
    !!targetLower && !!promote.promotingTarget && promote.promotingTarget.toLowerCase() === targetLower;
  const activeTx = isActiveTarget ? promote.txState : null;

  if (btnState.alreadyWhitelisted) {
    const doneHash = activeTx?.phase === "done" ? activeTx.hash : null;
    return (
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-trusted/30 bg-trusted/10 px-2 py-0.5 text-xs font-medium text-trusted-text">
          <CheckIcon className="h-3.5 w-3.5" />
          Đã thành API quen
        </span>
        {doneHash && (
          <a
            href={txUrl(doneHash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-flow hover:text-flow-text hover:underline"
          >
            Snowscan
            <ArrowUpRightIcon className="h-3 w-3" />
          </a>
        )}
      </div>
    );
  }

  if (!btnState.visible || !btnState.targetAddress) return null;
  const targetAddress = btnState.targetAddress;

  const isSigning = activeTx?.phase === "signing";
  const isPending = activeTx?.phase === "pending";
  const pendingHash = activeTx?.phase === "pending" ? activeTx.hash : null;
  const errorMsg = activeTx?.phase === "error" ? activeTx.message : null;
  const disabledReason = !promote.authenticated
    ? "Đăng nhập ví chủ Privy để chuyển thành API quen."
    : btnState.disabledReason;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <button
        type="button"
        disabled={btnState.disabled || isSigning || isPending}
        title={disabledReason ?? `Đưa ${targetAddress} vào Whitelist (Tầng 1) qua 1 chữ ký Privy`}
        onClick={() => promote.onPromote(targetAddress, suggestedAlias)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-flow/45 bg-flow/10 px-3 py-1.5 text-xs font-semibold text-flow-text transition hover:bg-flow/20 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <ShieldCheckIcon className="h-3.5 w-3.5 shrink-0" />
        <span>{isSigning ? "Đang ký Privy…" : isPending ? "Đang chờ xác nhận…" : "Chuyển thành API quen"}</span>
      </button>

      {pendingHash && (
        <a
          href={txUrl(pendingHash)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-xs text-flow hover:text-flow-text hover:underline"
        >
          {shortAddress(pendingHash)} · Snowscan
          <ArrowUpRightIcon className="h-3 w-3" />
        </a>
      )}

      {errorMsg && <span className="text-xs text-danger-text">{errorMsg}</span>}
    </div>
  );
}
