"use client";

import Link from "next/link";
import { POLICY_ADDRESS } from "@/lib/chain";
import { useConsole } from "./ConsoleProvider";
import { ActivityFlowIcon } from "./Icons";
import { SetupPanel } from "./SetupPanel";

/** Trang /policies — Không gian thoáng quản lý Whitelist API (kèm alias), setCaps 2 tầng, Factory & ERC-8004. */
export function PoliciesView() {
  const {
    authenticated,
    ready,
    login,
    policy,
    ownerAddress,
    avax,
    policies,
    myPolicy,
    raw,
    isOwner,
    whitelist,
    aliases,
    erc8004Identities,
    erc8004Error,
    busy,
    setSelectedPolicy,
    sendCreate,
    sendWhitelist,
    saveAlias,
    sendSetCaps,
    sendRegisterErc8004,
  } = useConsole();

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/90 px-4 py-3.5 backdrop-blur-sm sm:px-5">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Policy & Luật 2 tầng
          </h1>
          <p className="mt-0.5 text-xs leading-relaxed text-muted sm:text-sm">
            Duyệt API tin cậy kèm tên gợi nhớ riêng, chỉnh hạn mức 2 tầng on-chain (<code className="font-mono text-foreground">setCaps</code>), tạo Policy qua Factory và hộ chiếu ERC-8004.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
              isOwner
                ? "border-trusted/30 bg-trusted/10 text-trusted-text"
                : "border-border bg-surface-inset text-muted"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isOwner ? "bg-trusted" : "bg-muted"}`}
              aria-hidden="true"
            />
            <span>
              {isOwner
                ? "Ví chủ Privy sẵn sàng ký"
                : authenticated
                  ? "Đang xem policy khác"
                  : "Chế độ Khách (chỉ xem)"}
            </span>
          </span>
          <Link
            href="/flows"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-control bg-surface-inset px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-elevated"
          >
            <ActivityFlowIcon className="h-3.5 w-3.5 text-flow" />
            <span>Xem Dòng tiền x402</span>
          </Link>
        </div>
      </section>

      <SetupPanel
        layout="expanded"
        authenticated={authenticated}
        loginReady={ready}
        onLogin={login}
        policy={policy}
        defaultPolicy={POLICY_ADDRESS}
        owner={ownerAddress}
        avax={avax}
        policies={policies}
        myPolicy={myPolicy}
        raw={raw}
        isOwner={isOwner}
        whitelist={whitelist}
        aliases={aliases}
        identities={erc8004Identities}
        erc8004Error={erc8004Error}
        busy={busy}
        onSelectPolicy={setSelectedPolicy}
        onCreate={sendCreate}
        onToggle={(payTo, allowed, alias) => sendWhitelist(payTo, allowed, undefined, alias)}
        onSaveAlias={(payTo, nextAlias) => saveAlias(payTo, nextAlias)}
        onSetCaps={sendSetCaps}
        onRegisterErc8004={sendRegisterErc8004}
      />
    </div>
  );
}
