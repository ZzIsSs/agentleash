"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Address } from "viem";
import { formatEther } from "viem";
import {
  CAPS_FIELD_LABELS,
  DEMO_CAPS_INPUT,
  capsEqual,
  capsFromRaw,
  validateCaps,
  type CapsField,
  type CapsInput,
  type ParsedCaps,
} from "@/lib/caps";
import {
  DEMO_AGENT_ADDRESS,
  DEMO_POLICY_PARAMS,
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  addressUrl,
  nftUrl,
  shortAddress,
  txUrl,
} from "@/lib/chain";
import { formatPeriod, formatUsdc, type PolicyRaw } from "@/lib/policy";
import {
  buildPolicyOptions,
  validateCreatePolicyInput,
  type CreatePolicyField,
  type PolicyOption,
} from "@/lib/policyCreate";
import { normalizeSellerAlias, resolveSellerName } from "@/lib/sellerAliases";
import { KNOWN_SELLERS } from "@/lib/spends";
import type { AgentIdentityRecord } from "@/lib/useErc8004";
import { getExtraWhitelistedAddresses, parseWhitelistInput } from "@/lib/whitelistPromote";
import {
  AlertTriangleIcon,
  ArrowUpRightIcon,
  BadgeIdIcon,
  CheckIcon,
  PlusIcon,
  ShieldCheckIcon,
  SlidersIcon,
  WalletIcon,
} from "./Icons";

const FAUCET_URL = "https://core.app/tools/testnet-faucet/?subnet=c&token=c";

type SetupTabId = "whitelist" | "caps" | "factory";

const SETUP_TABS: ReadonlyArray<{ id: SetupTabId; label: string }> = [
  { id: "whitelist", label: "Whitelist API" },
  { id: "caps", label: "Hạn mức" },
  { id: "factory", label: "Policy & ERC-8004" },
];

/** Khối Policy & luật chi tiêu: bố cục gọn có 3 tab WAI-ARIA (Whitelist / Hạn mức 2 tầng / Tạo Policy & ERC-8004). */
export function SetupPanel({
  authenticated,
  loginReady,
  onLogin,
  policy,
  defaultPolicy,
  owner,
  avax,
  policies,
  myPolicy,
  raw,
  isOwner,
  whitelist,
  aliases,
  identities,
  erc8004Error,
  busy,
  onSelectPolicy,
  onCreate,
  onToggle,
  onSaveAlias,
  onSetCaps,
  onRegisterErc8004,
  layout = "tabs",
}: {
  authenticated: boolean;
  loginReady: boolean;
  onLogin: () => void;
  policy: Address;
  defaultPolicy: Address;
  owner: Address | null;
  avax: bigint | null;
  policies: readonly Address[];
  myPolicy: Address | null;
  raw: PolicyRaw | null;
  isOwner: boolean;
  whitelist: Record<string, boolean> | null;
  aliases?: Record<string, string>;
  identities: readonly AgentIdentityRecord[] | null;
  erc8004Error: string | null;
  busy: boolean;
  onSelectPolicy: (policyAddress: Address) => void;
  onCreate: (agent: Address, periodSeconds: bigint) => Promise<boolean>;
  onToggle: (payTo: Address, allowed: boolean, alias?: string) => Promise<boolean> | void;
  onSaveAlias?: (payTo: Address, alias: string | null) => void;
  onSetCaps: (caps: ParsedCaps) => Promise<boolean>;
  onRegisterErc8004: (agentName: string) => Promise<boolean>;
  layout?: "tabs" | "expanded";
}) {
  const baseId = useId();
  const selectId = `${baseId}-policy-select`;
  const factorySectionId = `${baseId}-policy-factory`;
  const [activeTab, setActiveTab] = useState<SetupTabId>("whitelist");
  const tabRefs = useRef<Partial<Record<SetupTabId, HTMLButtonElement | null>>>({});

  const noGas = avax !== null && avax === 0n;
  const policyOptions = buildPolicyOptions(policies, defaultPolicy);
  const extraWhitelisted = getExtraWhitelistedAddresses(whitelist);

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % SETUP_TABS.length;
    else if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + SETUP_TABS.length) % SETUP_TABS.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = SETUP_TABS.length - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    const target = SETUP_TABS[nextIndex];
    setActiveTab(target.id);
    tabRefs.current[target.id]?.focus();
  };

  const statusHeaderBlock = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersIcon className="h-4 w-4 text-flow" />
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Policy & luật chi tiêu
          </h2>
        </div>

        {authenticated && (
          <button
            type="button"
            onClick={() => {
              if (layout === "expanded") {
                document.getElementById(factorySectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
              } else {
                setActiveTab("factory");
              }
            }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-flow/45 bg-flow/10 px-3 py-1.5 text-xs font-semibold text-flow-text transition hover:bg-flow/20"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span>{myPolicy ? "Tạo policy mới" : "Tạo policy riêng"}</span>
          </button>
        )}
      </div>

      {!authenticated ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-inset px-3.5 py-3 text-xs">
          <span className="leading-relaxed text-muted">
            Chế độ chỉ xem (khách): đăng nhập ví Privy bằng email để tạo policy riêng hoặc chỉnh sửa luật chi tiêu.
          </span>
          <button
            type="button"
            onClick={onLogin}
            disabled={!loginReady}
            className="min-h-9 shrink-0 rounded-lg bg-flow px-3.5 py-1.5 text-xs font-semibold text-background transition hover:bg-flow-text disabled:opacity-50"
          >
            {loginReady ? "Đăng nhập bằng email" : "Đang tải Privy…"}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-inset px-3.5 py-2.5 text-xs text-muted">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <WalletIcon className="h-3.5 w-3.5 text-flow" />
              <span>Ví chủ Privy:</span>
            </span>
            {owner ? (
              <a
                href={addressUrl(owner)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 font-mono text-foreground hover:text-flow hover:underline"
              >
                {shortAddress(owner)}
                <ArrowUpRightIcon className="h-3 w-3" />
              </a>
            ) : (
              <span>đang tạo ví nhúng…</span>
            )}
            {avax !== null && (
              <span className="tabular-nums font-mono text-foreground">
                · {Number(formatEther(avax)).toFixed(4)} AVAX
              </span>
            )}
          </div>

          {noGas && (
            <a
              href={FAUCET_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-sandbox-text hover:underline"
            >
              Lấy AVAX test trả gas
              <ArrowUpRightIcon className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {authenticated && policyOptions.length > 1 && (
        <PolicySwitcher
          selectId={selectId}
          policy={policy}
          options={policyOptions}
          onSelect={onSelectPolicy}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 text-muted">
          <span>Đang xem policy:</span>
          <a
            href={addressUrl(policy)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 font-mono text-flow hover:text-flow-text hover:underline"
          >
            {shortAddress(policy)}
            <ArrowUpRightIcon className="h-3 w-3" />
          </a>
        </div>
        {!isOwner && (
          <span className="rounded-md bg-surface-inset px-2 py-0.5 text-xs text-muted">
            {authenticated ? "Chỉ xem (không phải chủ policy này)" : "Chỉ xem (khách)"}
          </span>
        )}
      </div>

      {raw && raw.balance === 0n && (
        <div className="flex items-start gap-2 rounded-lg border border-sandbox/40 bg-sandbox/10 px-3 py-2.5 text-xs text-sandbox-text">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Policy chưa có USDC test. Nạp USDC vào địa chỉ policy trên để agent có thể thanh toán x402.</span>
        </div>
      )}
    </>
  );

  const whitelistBody = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-medium text-foreground">Danh sách API tin cậy (Tầng 1)</h3>
        <span className="text-xs text-muted">Ngoài danh sách → áp trần Sandbox</span>
      </div>

      <div className="divide-y divide-border border-y border-border">
        {Object.entries(KNOWN_SELLERS).map(([addr, name]) => {
          const allowed = whitelist?.[addr] ?? null;
          return (
            <div key={addr} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="font-medium text-foreground">{name}</div>
                <div className="font-mono text-xs text-muted">{shortAddress(addr)}</div>
              </div>
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${
                    allowed === null
                      ? "border-border bg-card text-muted"
                      : allowed
                        ? "border-trusted/30 bg-trusted/10 text-trusted-text"
                        : "border-sandbox/30 bg-sandbox/10 text-sandbox-text"
                  }`}
                >
                  {allowed && <ShieldCheckIcon className="h-3 w-3" />}
                  <span>{allowed === null ? "Đang đọc" : allowed ? "Whitelist" : "Sandbox"}</span>
                </span>
                <button
                  type="button"
                  disabled={busy || !isOwner || allowed === null}
                  onClick={() => onToggle(addr as Address, !allowed)}
                  className="min-h-9 rounded-lg border border-border-control bg-card px-3 py-1 text-xs font-medium text-foreground transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {allowed ? "Gỡ" : "Thêm"}
                </button>
              </div>
            </div>
          );
        })}

        {extraWhitelisted.map((addr) => (
          <ExtraWhitelistRow
            key={addr}
            addr={addr}
            displayName={resolveSellerName(addr, aliases)}
            currentAlias={aliases?.[addr.toLowerCase()] ?? ""}
            isOwner={isOwner}
            busy={busy}
            onToggle={(allowed) => onToggle(addr, allowed)}
            onSaveAlias={(nextAlias) => onSaveAlias?.(addr, nextAlias)}
          />
        ))}
      </div>

      <AddWhitelistForm
        policy={policy}
        whitelist={whitelist}
        isOwner={isOwner}
        busy={busy}
        onAdd={(addr, alias) => onToggle(addr, true, alias)}
      />
    </div>
  );

  const capsBody = (
    <CapsForm policy={policy} raw={raw} isOwner={isOwner} busy={busy} onSetCaps={onSetCaps} />
  );

  const factoryBody = (
    <div className="flex flex-col gap-5">
      {authenticated ? (
        <div className="flex flex-col gap-3 rounded-lg bg-surface-inset p-4">
          <p className="text-xs leading-relaxed text-muted">
            {!myPolicy
              ? "Bạn đang xem policy demo chung. Tạo AgentPolicy riêng qua Factory để ví Privy của bạn làm chủ duy nhất — không ai khác rút tiền hay đổi luật được."
              : "Deploy thêm một AgentPolicy độc lập qua Factory. Policy mới tạo cần nạp USDC test và bật whitelist API trước khi agent chạy."}
          </p>
          <CreatePolicyForm busy={busy} disabled={!owner || noGas} onCreate={onCreate} />
        </div>
      ) : (
        <p className="rounded-lg bg-surface-inset px-3.5 py-3 text-xs text-muted">
          Đăng nhập ví Privy để deploy AgentPolicy mới qua Factory.
        </p>
      )}

      <Erc8004Section
        owner={owner}
        isOwner={isOwner}
        busy={busy}
        identities={identities}
        error={erc8004Error}
        onRegister={onRegisterErc8004}
      />
    </div>
  );

  if (layout === "expanded") {
    return (
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card/90 p-4 backdrop-blur-sm sm:p-5">
          {statusHeaderBlock}
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <section className="flex flex-col rounded-xl border border-border bg-card/90 p-4 backdrop-blur-sm sm:p-5 xl:col-span-6">
            {whitelistBody}
          </section>

          <section className="flex flex-col rounded-xl border border-border bg-card/90 p-4 backdrop-blur-sm sm:p-5 xl:col-span-6">
            {capsBody}
          </section>

          <section
            id={factorySectionId}
            className="flex flex-col rounded-xl border border-border bg-card/90 p-4 backdrop-blur-sm sm:p-5 xl:col-span-12"
          >
            {factoryBody}
          </section>
        </div>
      </div>
    );
  }

  return (
    <section className="flex h-full flex-col gap-4 rounded-xl border border-border bg-card/90 p-4 backdrop-blur-sm sm:p-5">
      {statusHeaderBlock}

      {/* Thanh tab WAI-ARIA cho 3 nhóm thiết lập */}
      <div className="flex flex-col">
        <div
          role="tablist"
          aria-label="Cấu hình chi tiết Policy"
          className="al-scroll flex overflow-x-auto border-b border-border"
        >
          {SETUP_TABS.map((tab, idx) => {
            const isSelected = activeTab === tab.id;
            const tabId = `${baseId}-tab-${tab.id}`;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                id={tabId}
                type="button"
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`al-tab relative flex-none px-2 py-2.5 text-xs font-semibold transition sm:px-3.5 sm:text-sm ${
                  isSelected
                    ? "text-flow-text"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Whitelist API */}
        <div
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-whitelist`}
          hidden={activeTab !== "whitelist"}
          tabIndex={activeTab === "whitelist" ? 0 : undefined}
          className="pt-4"
        >
          {whitelistBody}
        </div>

        {/* Tab 2: Hạn mức 2 tầng */}
        <div
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-caps`}
          hidden={activeTab !== "caps"}
          tabIndex={activeTab === "caps" ? 0 : undefined}
          className="pt-4"
        >
          {capsBody}
        </div>

        {/* Tab 3: Policy mới & ERC-8004 */}
        <div
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-factory`}
          hidden={activeTab !== "factory"}
          tabIndex={activeTab === "factory" ? 0 : undefined}
          className="pt-4"
        >
          {factoryBody}
        </div>
      </div>
    </section>
  );
}

function ExtraWhitelistRow({
  addr,
  displayName,
  currentAlias,
  isOwner,
  busy,
  onToggle,
  onSaveAlias,
}: {
  addr: Address;
  displayName: string;
  currentAlias: string;
  isOwner: boolean;
  busy: boolean;
  onToggle: (allowed: boolean) => void;
  onSaveAlias: (alias: string | null) => void;
}) {
  const editInputId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentAlias);

  const startEdit = () => {
    setDraft(currentAlias);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(currentAlias);
    setEditing(false);
  };

  return (
    <div className="flex flex-col gap-2 py-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{displayName}</span>
            <span className="inline-flex items-center gap-1 rounded-md border border-trusted/30 bg-trusted/10 px-2 py-0.5 text-xs font-medium text-trusted-text">
              <CheckIcon className="h-3 w-3" />
              API quen
            </span>
          </div>
          <a
            href={addressUrl(addr)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 font-mono text-xs text-muted hover:text-flow hover:underline"
          >
            {shortAddress(addr)}
            <ArrowUpRightIcon className="h-3 w-3" />
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={editing ? cancelEdit : startEdit}
            className="min-h-9 rounded-lg border border-border-control bg-surface-inset px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-surface-elevated"
          >
            {editing ? "Đóng" : "Sửa tên"}
          </button>
          <span className="inline-flex items-center gap-1 rounded-md border border-trusted/30 bg-trusted/10 px-2 py-0.5 text-xs font-medium text-trusted-text">
            Whitelist
          </span>
          <button
            type="button"
            disabled={busy || !isOwner}
            onClick={() => onToggle(false)}
            className="min-h-9 rounded-lg border border-border-control bg-card px-3 py-1 text-xs font-medium text-foreground transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
          >
            Gỡ
          </button>
        </div>
      </div>

      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSaveAlias(normalizeSellerAlias(draft));
            setEditing(false);
          }}
          className="flex flex-col gap-2 rounded-lg bg-surface-inset p-2.5 sm:flex-row sm:items-center"
        >
          <label htmlFor={editInputId} className="sr-only">
            Tên gợi nhớ cho {shortAddress(addr)}
          </label>
          <input
            id={editInputId}
            name="sellerAliasEdit"
            type="text"
            autoFocus
            maxLength={48}
            value={draft}
            placeholder="Ví dụ: API Chuyến bay (để trống để xóa tên)"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancelEdit();
            }}
            className="min-h-9 min-w-0 flex-1 rounded-lg border border-border-control bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted/70"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="min-h-9 rounded-lg bg-flow px-3 py-1 text-xs font-semibold text-background transition hover:bg-flow-text"
            >
              Lưu tên
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="min-h-9 rounded-lg border border-border-control bg-card px-3 py-1 text-xs font-medium text-foreground transition hover:bg-surface-elevated"
            >
              Hủy
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function AddWhitelistForm({
  policy,
  whitelist,
  isOwner,
  busy,
  onAdd,
}: {
  policy: Address;
  whitelist: Record<string, boolean> | null;
  isOwner: boolean;
  busy: boolean;
  onAdd: (payTo: Address, alias?: string) => Promise<boolean> | void;
}) {
  const inputId = useId();
  const aliasInputId = useId();
  const hintId = useId();
  const [value, setValue] = useState("");
  const [aliasValue, setAliasValue] = useState("");
  const check = parseWhitelistInput(value, whitelist, policy);
  const disabled = busy || !isOwner || !check.ok;

  return (
    <form
      className="flex flex-col gap-2.5 rounded-lg bg-surface-inset p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (disabled || !check.ok) return;
        const nextAlias = normalizeSellerAlias(aliasValue) ?? undefined;
        const result = await onAdd(check.address, nextAlias);
        if (result !== false) {
          setValue("");
          setAliasValue("");
        }
      }}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-1 sm:col-span-7">
          <label htmlFor={inputId} className="text-xs font-medium text-foreground">
            Địa chỉ nhận tiền (<code className="font-mono text-flow-text">payTo</code>)
          </label>
          <input
            id={inputId}
            name="whitelistPayTo"
            type="text"
            autoCorrect="off"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            disabled={!isOwner}
            value={value}
            placeholder="0x… (ví dụ địa chỉ trong gợi ý MCP)"
            aria-invalid={check.error ? "true" : "false"}
            aria-describedby={hintId}
            onChange={(e) => setValue(e.target.value)}
            className={`min-h-11 min-w-0 rounded-lg border bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted/70 transition disabled:cursor-not-allowed disabled:opacity-50 ${
              check.error ? "border-danger bg-danger/5" : "border-border-control"
            }`}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1 sm:col-span-5">
          <label htmlFor={aliasInputId} className="text-xs font-medium text-foreground">
            Tên API (tùy chọn)
          </label>
          <input
            id={aliasInputId}
            name="whitelistAlias"
            type="text"
            autoComplete="off"
            maxLength={48}
            disabled={!isOwner}
            value={aliasValue}
            placeholder="Ví dụ: API Chuyến bay"
            onChange={(e) => setAliasValue(e.target.value)}
            className="min-h-11 min-w-0 rounded-lg border border-border-control bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted/70 transition disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={hintId} className={`text-xs ${check.error ? "text-danger-text" : "text-muted"}`}>
          {check.error
            ? `Lỗi: ${check.error}`
            : isOwner
              ? "Ký setWhitelist bằng ví chủ Privy; tên riêng sẽ hiển thị ngay trên sơ đồ Dòng tiền x402."
              : "Chỉ ví chủ policy mới thêm được địa chỉ vào whitelist."}
        </p>
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-border-control bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
        >
          Thêm vào Whitelist
        </button>
      </div>
    </form>
  );
}

function PolicySwitcher({
  selectId,
  policy,
  options,
  onSelect,
}: {
  selectId: string;
  policy: Address;
  options: readonly PolicyOption[];
  onSelect: (addr: Address) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface-inset p-3">
      <label htmlFor={selectId} className="text-xs font-medium text-muted">
        Chọn policy hiển thị & thao tác
      </label>
      <select
        id={selectId}
        name="activePolicy"
        value={policy}
        onChange={(e) => onSelect(e.target.value as Address)}
        className="min-h-11 rounded-lg border border-border-control bg-card px-3 py-2 font-mono text-xs text-foreground"
      >
        {options.map((opt) => (
          <option key={opt.address} value={opt.address}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function CreatePolicyForm({
  busy,
  disabled,
  onCreate,
}: {
  busy: boolean;
  disabled: boolean;
  onCreate: (agent: Address, periodSeconds: bigint) => Promise<boolean>;
}) {
  const formId = useId();
  const headingId = `${formId}-heading`;
  const agentId = `${formId}-agent`;
  const agentErrId = `${formId}-agent-err`;
  const periodId = `${formId}-period`;
  const periodErrId = `${formId}-period-err`;

  const [agentInput, setAgentInput] = useState<string>(DEMO_AGENT_ADDRESS);
  const [periodInput, setPeriodInput] = useState<string>(String(DEMO_POLICY_PARAMS.period));
  const [interacted, setInteracted] = useState<Partial<Record<CreatePolicyField, boolean>>>({});
  const [touched, setTouched] = useState<Partial<Record<CreatePolicyField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const agentRef = useRef<HTMLInputElement | null>(null);
  const periodRef = useRef<HTMLInputElement | null>(null);

  const validation = validateCreatePolicyInput({ agent: agentInput, periodSeconds: periodInput });
  const visibleError = (field: CreatePolicyField) =>
    touched[field] || submitted ? validation.fieldErrors[field] : undefined;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    if (!validation.ok) {
      if (validation.fieldErrors.agent) agentRef.current?.focus();
      else if (validation.fieldErrors.periodSeconds) periodRef.current?.focus();
      return;
    }
    if (busy || disabled) return;
    await onCreate(validation.parsed.agent, validation.parsed.periodSeconds);
  };

  const agentErr = visibleError("agent");
  const periodErr = visibleError("periodSeconds");

  return (
    <form aria-labelledby={headingId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-[15px] font-semibold text-foreground">
          Tạo AgentPolicy qua Factory
        </h3>
        <span className="tabular-nums font-mono text-xs text-muted">
          Mặc định: {formatUsdc(DEMO_POLICY_PARAMS.perTxCap)} / {formatUsdc(DEMO_POLICY_PARAMS.dailyCap)} USDC
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
          <label htmlFor={agentId} className="text-xs text-muted">
            Ví agent (EOA được phép xin chi)
          </label>
          <input
            ref={agentRef}
            id={agentId}
            name="agentAddress"
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            disabled={busy || disabled}
            value={agentInput}
            aria-invalid={agentErr ? "true" : "false"}
            aria-describedby={agentErr ? agentErrId : undefined}
            onChange={(e) => {
              setAgentInput(e.target.value);
              setInteracted((p) => ({ ...p, agent: true }));
            }}
            onBlur={() => {
              if (interacted.agent) setTouched((p) => ({ ...p, agent: true }));
            }}
            className={`min-h-11 w-full min-w-0 rounded-lg border bg-card px-3 py-2 font-mono text-xs text-foreground disabled:opacity-50 ${
              agentErr ? "border-danger bg-danger/5" : "border-border-control"
            }`}
          />
          {agentErr && (
            <p id={agentErrId} className="text-xs text-danger-text">
              {agentErr}
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={periodId} className="text-xs text-muted">
            Chu kỳ (giây)
          </label>
          <input
            ref={periodRef}
            id={periodId}
            name="periodSeconds"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            required
            disabled={busy || disabled}
            value={periodInput}
            aria-invalid={periodErr ? "true" : "false"}
            aria-describedby={periodErr ? periodErrId : undefined}
            onChange={(e) => {
              setPeriodInput(e.target.value);
              setInteracted((p) => ({ ...p, periodSeconds: true }));
            }}
            onBlur={() => {
              if (interacted.periodSeconds) setTouched((p) => ({ ...p, periodSeconds: true }));
            }}
            className={`min-h-11 w-full min-w-0 rounded-lg border bg-card px-3 py-2 font-mono text-xs text-foreground disabled:opacity-50 ${
              periodErr ? "border-danger bg-danger/5" : "border-border-control"
            }`}
          />
          {periodErr && (
            <p id={periodErrId} className="text-xs text-danger-text">
              {periodErr}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="tabular-nums text-xs text-muted">
          Sandbox mặc định: {formatUsdc(DEMO_POLICY_PARAMS.sandboxPerTxCap)} /{" "}
          {formatUsdc(DEMO_POLICY_PARAMS.sandboxDailyCap)} USDC · Chu kỳ: {formatPeriod(Number(periodInput) || 120)}
        </span>
        <button
          type="submit"
          disabled={busy || disabled}
          className="min-h-10 rounded-lg bg-flow px-4 py-2 text-xs font-semibold text-background transition hover:bg-flow-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          Tạo policy & agent mới
        </button>
      </div>
    </form>
  );
}

function Erc8004Section({
  owner,
  isOwner,
  busy,
  identities,
  error,
  onRegister,
}: {
  owner: Address | null;
  isOwner: boolean;
  busy: boolean;
  identities: readonly AgentIdentityRecord[] | null;
  error: string | null;
  onRegister: (agentName: string) => Promise<boolean>;
}) {
  const inputId = useId();
  const [agentName, setAgentName] = useState("AgentLeash · x402 Fuji Agent");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !owner || !isOwner) return;
    await onRegister(agentName);
  };

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-[15px] font-medium text-foreground">
          <BadgeIdIcon className="h-4 w-4 text-flow" />
          <span>Hộ chiếu danh tính ERC-8004</span>
        </h3>
        <a
          href={addressUrl(ERC8004_IDENTITY_REGISTRY_ADDRESS)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 font-mono text-xs text-muted hover:text-flow hover:underline"
        >
          Registry {shortAddress(ERC8004_IDENTITY_REGISTRY_ADDRESS)}
          <ArrowUpRightIcon className="h-3 w-3" />
        </a>
      </div>

      {error && <p className="text-xs text-danger-text">Không đọc được registry ERC-8004: {error}</p>}

      {identities === null ? (
        <p className="text-xs text-muted">Đang kiểm tra NFT danh tính trên Fuji…</p>
      ) : identities.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted">
          Chủ policy chưa đăng ký hộ chiếu ERC-8004 trên Fuji. Đăng ký 1 lần để gắn danh tính chuẩn Trustless Agents cho
          agent.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface-inset px-3">
          {identities.map((id) => (
            <li key={id.agentId.toString()} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
              <div className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={nftUrl(ERC8004_IDENTITY_REGISTRY_ADDRESS, id.agentId)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-trusted/30 bg-trusted/10 px-2 py-0.5 font-mono font-semibold text-trusted-text hover:underline"
                  >
                    ID #{id.agentId.toString()}
                  </a>
                  <span className="font-medium text-foreground">{id.decoded.name ?? "AgentIdentity NFT"}</span>
                </div>
                <span className="font-mono text-xs text-muted">
                  {id.decoded.policyAddress
                    ? `Policy: ${shortAddress(id.decoded.policyAddress)}`
                    : id.agentWallet
                      ? `Wallet: ${shortAddress(id.agentWallet)}`
                      : shortAddress(id.owner)}
                </span>
              </div>
              {id.txHash && (
                <a
                  href={txUrl(id.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-flow hover:text-flow-text hover:underline"
                >
                  Snowscan
                  <ArrowUpRightIcon className="h-3 w-3" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={inputId} className="text-xs text-muted">
            Tên hiển thị trên hộ chiếu ERC-8004 (URI công khai, không PII)
          </label>
          <input
            id={inputId}
            name="erc8004AgentName"
            type="text"
            autoComplete="off"
            maxLength={64}
            disabled={busy || !owner || !isOwner}
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="min-h-11 rounded-lg border border-border-control bg-surface-inset px-3 py-2 text-xs text-foreground disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !owner || !isOwner}
          className="min-h-11 shrink-0 rounded-lg border border-flow/45 bg-flow/10 px-4 py-2 text-xs font-semibold text-flow-text transition hover:bg-flow/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Đăng ký ERC-8004
        </button>
      </form>
    </div>
  );
}

const CAPS_GROUPS: ReadonlyArray<{
  legend: string;
  accent: string;
  dot: string;
  fields: ReadonlyArray<{ key: CapsField; label: string }>;
}> = [
  {
    legend: "Tầng 1 · Whitelist (tin cậy)",
    accent: "text-trusted-text",
    dot: "bg-trusted",
    fields: [
      { key: "perTxCap", label: "Mỗi lần (USDC)" },
      { key: "dailyCap", label: "Chu kỳ (chung cả 2 tầng)" },
    ],
  },
  {
    legend: "Tầng 2 · Sandbox (địa chỉ lạ)",
    accent: "text-sandbox-text",
    dot: "bg-sandbox",
    fields: [
      { key: "sandboxPerTxCap", label: "Mỗi lần (USDC)" },
      { key: "sandboxDailyCap", label: "Chu kỳ (USDC)" },
    ],
  },
];

const FIELD_ORDER: CapsField[] = ["perTxCap", "dailyCap", "sandboxPerTxCap", "sandboxDailyCap"];

function CapsForm({
  policy,
  raw,
  isOwner,
  busy,
  onSetCaps,
}: {
  policy: Address;
  raw: PolicyRaw | null;
  isOwner: boolean;
  busy: boolean;
  onSetCaps: (caps: ParsedCaps) => Promise<boolean>;
}) {
  const baseId = useId();
  const headingId = `${baseId}-caps-heading`;
  const hintId = `${baseId}-caps-hint`;

  const [inputs, setInputs] = useState<CapsInput>(() => (raw ? capsFromRaw(raw) : DEMO_CAPS_INPUT));
  const [dirty, setDirty] = useState(false);
  const [interacted, setInteracted] = useState<Partial<Record<CapsField, boolean>>>({});
  const [touched, setTouched] = useState<Partial<Record<CapsField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [zeroCapConfirmed, setZeroCapConfirmed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const inputRefs = useRef<Partial<Record<CapsField, HTMLInputElement | null>>>({});
  const zeroConfirmRef = useRef<HTMLInputElement | null>(null);
  const zeroConfirmId = `${baseId}-zero-confirm`;

  const chainCapsKey = raw
    ? `${policy}:${raw.perTxCap}:${raw.dailyCap}:${raw.sandboxPerTxCap}:${raw.sandboxDailyCap}`
    : `${policy}:none`;

  useEffect(() => {
    setDirty(false);
    setInteracted({});
    setTouched({});
    setSubmitted(false);
    setZeroCapConfirmed(false);
    setAnnouncement("");
  }, [policy]);

  useEffect(() => {
    if (!dirty && raw) {
      setInputs(capsFromRaw(raw));
      setZeroCapConfirmed(false);
    }
  }, [chainCapsKey, dirty, raw]);

  const validation = validateCaps(inputs);
  const sameAsChain = !!raw && validation.ok && capsEqual(validation.caps, raw);
  const hasZeroCap =
    validation.ok &&
    (validation.caps.perTxCap === 0n ||
      validation.caps.dailyCap === 0n ||
      validation.caps.sandboxPerTxCap === 0n ||
      validation.caps.sandboxDailyCap === 0n);

  const visibleError = (field: CapsField): string | undefined =>
    touched[field] || submitted ? validation.fieldErrors[field] : undefined;

  const handleChange = (field: CapsField, value: string) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
    setInteracted((prev) => ({ ...prev, [field]: true }));
    setZeroCapConfirmed(false);
    setAnnouncement("");
  };

  const handleBlur = (field: CapsField) => {
    if (!interacted[field]) return;
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validation.fieldErrors[field];
    if (err) {
      setAnnouncement(`${CAPS_FIELD_LABELS[field]}: ${err}`);
    }
  };

  const handleFillDemo = () => {
    setInputs(DEMO_CAPS_INPUT);
    setDirty(true);
    setInteracted({});
    setTouched({});
    setSubmitted(false);
    setZeroCapConfirmed(false);
    setAnnouncement("Đã điền 4 hạn mức mặc định demo: 0.002 / 0.003 / 0.0005 / 0.001 USDC.");
  };

  const handleRevert = () => {
    if (!raw) return;
    setInputs(capsFromRaw(raw));
    setDirty(false);
    setInteracted({});
    setTouched({});
    setSubmitted(false);
    setZeroCapConfirmed(false);
    setAnnouncement("Đã khôi phục theo giá trị hiện tại trên chuỗi.");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    if (!validation.ok) {
      const firstInvalid = FIELD_ORDER.find((f) => validation.fieldErrors[f]);
      if (firstInvalid) {
        inputRefs.current[firstInvalid]?.focus();
      }
      return;
    }
    if (hasZeroCap && !zeroCapConfirmed) {
      zeroConfirmRef.current?.focus();
      return;
    }
    if (!isOwner || busy) return;
    const confirmed = await onSetCaps(validation.caps);
    if (confirmed) {
      setDirty(false);
      setInteracted({});
      setTouched({});
      setSubmitted(false);
      setZeroCapConfirmed(false);
    }
  };

  const controlsDisabled = busy || !isOwner || !raw;

  return (
    <form aria-labelledby={headingId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-[15px] font-medium text-foreground">
          Hạn mức 2 tầng (<code className="font-mono text-xs text-flow-text">setCaps</code>)
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && raw && (
            <button
              type="button"
              onClick={handleRevert}
              disabled={busy}
              className="min-h-8 rounded-lg border border-border-control bg-surface-inset px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
            >
              Khớp chuỗi
            </button>
          )}
          <button
            type="button"
            onClick={handleFillDemo}
            disabled={controlsDisabled}
            className="min-h-8 rounded-lg border border-flow/45 bg-flow/10 px-2.5 py-1 text-xs font-medium text-flow-text transition hover:bg-flow/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Mặc định demo (0.002 / 0.003 / 0.0005 / 0.001)
          </button>
        </div>
      </div>

      <p id={hintId} className="text-xs leading-relaxed text-muted">
        Đơn vị USDC (tối đa 6 số thập phân). Ràng buộc on-chain: mỗi lần ≤ chu kỳ (cả 2 tầng) và Sandbox chu kỳ ≤
        Whitelist chu kỳ.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CAPS_GROUPS.map((group) => (
          <fieldset key={group.legend} className="flex min-w-0 flex-col gap-2.5 rounded-lg bg-surface-inset p-3.5">
            <legend className={`inline-flex items-center gap-1.5 px-1 text-xs font-semibold ${group.accent}`}>
              <span className={`h-2 w-2 rounded-full ${group.dot}`} aria-hidden="true" />
              <span>{group.legend}</span>
            </legend>
            {group.fields.map(({ key, label }) => {
              const inputId = `${baseId}-${key}`;
              const errorId = `${baseId}-${key}-error`;
              const err = visibleError(key);
              const describedBy = err ? `${hintId} ${errorId}` : hintId;
              return (
                <div key={key} className="flex min-w-0 flex-col gap-1">
                  <label htmlFor={inputId} className="text-xs text-muted">
                    {label}
                  </label>
                  <input
                    ref={(el) => {
                      inputRefs.current[key] = el;
                    }}
                    id={inputId}
                    name={key}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    disabled={controlsDisabled}
                    value={inputs[key]}
                    placeholder={DEMO_CAPS_INPUT[key]}
                    aria-invalid={err ? "true" : "false"}
                    aria-describedby={describedBy}
                    onChange={(e) => handleChange(key, e.target.value)}
                    onBlur={() => handleBlur(key)}
                    className={`tabular-nums min-h-11 w-full min-w-0 rounded-lg border bg-card px-3 py-2 font-mono text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${
                      err ? "border-danger bg-danger/5" : "border-border-control"
                    }`}
                  />
                  {err && (
                    <p id={errorId} className="text-xs text-danger-text">
                      Lỗi: {err}
                    </p>
                  )}
                </div>
              );
            })}
          </fieldset>
        ))}
      </div>

      {submitted && !validation.ok && (
        <div className="rounded-lg border border-danger/45 bg-danger/10 px-3 py-2 text-xs text-danger-text">
          Chưa thể gửi giao dịch: {validation.errors[0]}
        </div>
      )}

      {hasZeroCap && (
        <div className="flex flex-col gap-2 rounded-lg border border-sandbox/45 bg-sandbox/10 px-3 py-2.5 text-xs text-sandbox-text">
          <p>
            Cảnh báo: bạn đang đặt ít nhất một hạn mức bằng <strong>0 USDC</strong>. Điều này sẽ khóa toàn bộ khoản chi
            thuộc tầng tương ứng trên hợp đồng.
          </p>
          <label htmlFor={zeroConfirmId} className="flex cursor-pointer items-center gap-2 font-medium text-foreground">
            <input
              ref={zeroConfirmRef}
              id={zeroConfirmId}
              type="checkbox"
              checked={zeroCapConfirmed}
              disabled={controlsDisabled}
              onChange={(e) => setZeroCapConfirmed(e.target.checked)}
              className="h-4 w-4 accent-[#eab308]"
            />
            Tôi hiểu và vẫn muốn lưu hạn mức bằng 0 USDC
          </label>
          {submitted && !zeroCapConfirmed && (
            <span className="text-danger-text">Vui lòng tick xác nhận ở trên trước khi ký giao dịch đặt hạn mức = 0.</span>
          )}
        </div>
      )}

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted">
          {!raw
            ? "Đang đọc hạn mức từ Fuji…"
            : !isOwner
              ? "Chỉ ví chủ policy mới chỉnh được hạn mức."
              : sameAsChain
                ? "Đang khớp với hạn mức trên chuỗi."
                : "Thay đổi sẽ cần ví Privy ký giao dịch setCaps trên Fuji."}
        </span>
        <button
          type="submit"
          disabled={controlsDisabled}
          className="min-h-10 rounded-lg bg-flow px-4 py-2 text-xs font-semibold text-background transition hover:bg-flow-text disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
        >
          Lưu hạn mức
        </button>
      </div>
    </form>
  );
}
