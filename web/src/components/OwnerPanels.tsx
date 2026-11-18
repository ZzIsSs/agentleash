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
import type { TxState } from "@/lib/ownerTx";
import { formatPeriod, formatUsdc, type PolicyRaw } from "@/lib/policy";
import {
  buildPolicyOptions,
  validateCreatePolicyInput,
  type CreatePolicyField,
  type PolicyOption,
} from "@/lib/policyCreate";
import { KNOWN_SELLERS } from "@/lib/spends";
import type { AgentIdentityRecord } from "@/lib/useErc8004";
import { getExtraWhitelistedAddresses, parseWhitelistInput } from "@/lib/whitelistPromote";

const FAUCET_URL = "https://core.app/tools/testnet-faucet/?subnet=c&token=c";

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
    ? "Đang đọc policy…"
    : !isOwner
      ? "Chỉ chủ policy bấm được. Tạo policy của bạn ở ô [3]."
      : busy
        ? "Đang có giao dịch chưa xong."
        : undefined;

  if (raw?.paused) {
    return (
      <button
        onClick={() => onRequest("unpause")}
        disabled={disabled}
        title={reason}
        className="rounded-lg border-2 border-trusted px-4 py-2 font-bold text-trusted transition hover:bg-trusted/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        MỞ KHÓA
      </button>
    );
  }
  return (
    <button
      onClick={() => onRequest("pause")}
      disabled={disabled}
      title={reason}
      className="rounded-lg bg-danger px-4 py-2 font-bold text-white shadow-lg shadow-danger/30 transition hover:bg-danger/90 disabled:cursor-not-allowed disabled:bg-danger/40 disabled:text-white/70 disabled:shadow-none"
    >
      KHÓA KHẨN CẤP
    </button>
  );
}

/** Hộp xác nhận ngay trong trang (không dùng window.confirm). */
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
  const pausing = action === "pause";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className={`flex w-full max-w-md flex-col gap-4 rounded-2xl border bg-card p-6 ${pausing ? "border-danger/60" : "border-trusted/60"}`}
      >
        <h2 id="confirm-title" className={`text-lg font-bold ${pausing ? "text-danger" : "text-trusted"}`}>
          {pausing ? "Khóa khẩn cấp policy?" : "Mở khóa policy?"}
        </h2>
        <p className="text-sm text-muted">
          {pausing
            ? "Mọi khoản chi tiếp theo của agent sẽ bị contract từ chối, kể cả khoản đã duyệt mà chưa thanh toán."
            : "Agent sẽ chi tiếp được trong hạn mức còn lại."}{" "}
          Bạn cần ký một giao dịch trên Fuji (tốn ít AVAX test trả gas).
        </p>
        <p className="font-mono text-xs text-muted">Policy: {policy}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-muted hover:text-foreground">
            Hủy
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={`rounded-lg px-4 py-2 font-bold ${pausing ? "bg-danger text-white" : "bg-trusted text-background"}`}
          >
            {pausing ? "Khóa ngay" : "Mở khóa"}
          </button>
        </div>
      </div>
    </div>
  );
}

const STEPS = ["Đang ký", "Đang chờ xác nhận", "Xong"] as const;

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
        failed ? "border-danger/50 bg-danger/10" : state.phase === "done" ? "border-trusted/50 bg-trusted/10" : "border-flow/40 bg-flow/5"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">{state.label}</span>
        {failed ? (
          <span className="text-danger">Lỗi: {state.message}</span>
        ) : (
          <ol className="flex flex-wrap items-center gap-2">
            {STEPS.map((name, i) => (
              <li
                key={name}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                  i < step || state.phase === "done"
                    ? "bg-trusted/15 text-trusted"
                    : i === step
                      ? "bg-flow/15 text-flow"
                      : "text-muted"
                }`}
              >
                {i === step && state.phase !== "done" ? (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-flow" />
                ) : (
                  <span>{i < step || state.phase === "done" ? "✓" : i + 1}</span>
                )}
                {name}
              </li>
            ))}
          </ol>
        )}
        {state.phase === "signing" && <span className="text-xs text-muted">Xác nhận trong cửa sổ Privy.</span>}
      </div>
      <div className="flex items-center gap-3">
        {hash && (
          <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="font-mono text-xs text-flow hover:underline">
            {shortAddress(hash)} trên Snowscan ↗
          </a>
        )}
        {(state.phase === "done" || failed) && (
          <button onClick={onClose} className="text-xs text-muted hover:text-foreground" aria-label="Đóng thông báo">
            Đóng ✕
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Ô nhập địa chỉ `payTo` để "Chuyển thành API quen" không cần dòng trong Dòng tiền / Bị từ chối
 * (ví dụ địa chỉ lấy từ gợi ý MCP khi mở bản Vercel). Ký bằng đúng luồng `setWhitelist` của bảng [3].
 */
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
  onAdd: (payTo: Address) => void;
}) {
  const inputId = useId();
  const hintId = useId();
  const [value, setValue] = useState("");
  const check = parseWhitelistInput(value, whitelist, policy);
  const disabled = busy || !isOwner || !check.ok;

  return (
    <form
      className="flex flex-col gap-1.5 rounded-xl bg-background px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled || !check.ok) return;
        onAdd(check.address);
        setValue("");
      }}
    >
      <label htmlFor={inputId} className="text-xs text-muted">
        Thêm API quen bằng địa chỉ nhận tiền (payTo)
      </label>
      <div className="flex min-w-0 gap-2">
        <input
          id={inputId}
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
          className={`min-h-11 min-w-0 flex-1 rounded-lg border bg-card px-3 py-1.5 font-mono text-xs text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-flow disabled:cursor-not-allowed disabled:opacity-50 ${
            check.error ? "border-danger bg-danger/5" : "border-border"
          }`}
        />
        <button
          type="submit"
          disabled={disabled}
          className="min-h-11 shrink-0 rounded-lg border border-border px-3 text-xs text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Thêm
        </button>
      </div>
      <p id={hintId} className={`text-xs ${check.error ? "text-danger" : "text-muted"}`}>
        {check.error
          ? `Lỗi: ${check.error}`
          : isOwner
            ? "Ký setWhitelist bằng ví chủ Privy; địa chỉ sẽ hiện ở danh sách trên sau khi giao dịch xong."
            : "Chỉ ví chủ policy mới thêm được."}
      </p>
    </form>
  );
}

/** Ô [3]: tạo policy của chủ (qua factory), chọn policy đang xem, whitelist 2 API + API quen đã duyệt, setCaps và hộ chiếu ERC-8004. */
export function SetupCard({
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
  identities,
  erc8004Error,
  busy,
  onSelectPolicy,
  onCreate,
  onToggle,
  onSetCaps,
  onRegisterErc8004,
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
  identities: readonly AgentIdentityRecord[] | null;
  erc8004Error: string | null;
  busy: boolean;
  onSelectPolicy: (policyAddress: Address) => void;
  onCreate: (agent: Address, periodSeconds: bigint) => Promise<boolean>;
  onToggle: (payTo: Address, allowed: boolean) => void;
  onSetCaps: (caps: ParsedCaps) => Promise<boolean>;
  onRegisterErc8004: (agentName: string) => Promise<boolean>;
}) {
  const selectId = useId();
  const createPanelId = useId();
  const [showCreatePanel, setShowCreatePanel] = useState(false);

  const noGas = avax !== null && avax === 0n;
  const policyOptions = buildPolicyOptions(policies, defaultPolicy);
  const extraWhitelisted = getExtraWhitelistedAddresses(whitelist);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          <span className="text-muted">[3]</span> Policy & luật chi tiêu
        </h2>
        {authenticated && myPolicy && (
          <button
            type="button"
            aria-expanded={showCreatePanel}
            aria-controls={createPanelId}
            disabled={busy || !owner || noGas}
            onClick={() => setShowCreatePanel((v) => !v)}
            className="rounded-lg border border-flow/40 bg-flow/10 px-3 py-1.5 text-xs font-semibold text-flow transition hover:bg-flow/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {showCreatePanel ? "Đóng form tạo agent" : "+ Tạo agent / policy mới"}
          </button>
        )}
      </div>

      {!authenticated ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background p-3 text-xs text-muted">
          <span>Chế độ chỉ xem (khách): đăng nhập ví Privy để tạo policy riêng hoặc chỉnh sửa luật chi tiêu.</span>
          <button
            type="button"
            onClick={onLogin}
            disabled={!loginReady}
            className="shrink-0 rounded-lg bg-flow px-3 py-1.5 font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {loginReady ? "Đăng nhập bằng email" : "Đang tải Privy…"}
          </button>
        </div>
      ) : (
        <div className="rounded-xl bg-background p-3 text-xs text-muted">
          Ví chủ của bạn (Privy):{" "}
          {owner ? (
            <a href={addressUrl(owner)} target="_blank" rel="noreferrer" className="font-mono text-foreground hover:text-flow">
              {shortAddress(owner)}
            </a>
          ) : (
            "đang tạo…"
          )}
          {avax !== null && (
            <>
              {" "}
              · <span className="font-mono">{Number(formatEther(avax)).toFixed(4)} AVAX</span>
            </>
          )}
          {noGas && (
            <>
              {" "}
              ·{" "}
              <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="text-sandbox hover:underline">
                Cần AVAX test trả gas: lấy ở faucet ↗
              </a>
            </>
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

      {authenticated && (!myPolicy || showCreatePanel) && (
        <div
          id={createPanelId}
          className="flex flex-col gap-3 rounded-xl border border-flow/30 bg-background/70 p-4"
        >
          {!myPolicy ? (
            <p className="text-sm text-muted">
              Bạn đang xem policy demo của đội. Tạo policy riêng qua Factory: ví của bạn là chủ duy nhất, không ai khác
              rút tiền hay đổi luật được.
            </p>
          ) : (
            <p className="text-xs text-muted">
              Deploy thêm một <code>AgentPolicy</code> độc lập qua Factory. Policy mới tạo cần nạp USDC test và bật
              whitelist API trước khi agent chạy.
            </p>
          )}
          <CreatePolicyForm
            busy={busy}
            disabled={!owner || noGas}
            onCreate={async (agent, periodSeconds) => {
              const ok = await onCreate(agent, periodSeconds);
              if (ok) setShowCreatePanel(false);
              return ok;
            }}
          />
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            Đang xem policy:{" "}
            <a href={addressUrl(policy)} target="_blank" rel="noreferrer" className="font-mono text-flow hover:underline">
              {shortAddress(policy)}
            </a>
          </span>
          {!isOwner && (
            <span className="text-xs text-muted">
              {authenticated
                ? "Chế độ chỉ xem (ví đang đăng nhập không phải chủ policy này)"
                : "Chế độ chỉ xem (khách)"}
            </span>
          )}
        </div>
        {raw && raw.balance === 0n && (
          <p className="rounded-lg border border-sandbox/50 bg-sandbox/10 px-3 py-2 text-xs text-sandbox">
            Policy chưa có USDC. Chuyển USDC test vào địa chỉ policy để agent chi được.
          </p>
        )}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Whitelist (Tầng 1, tin cậy)</h3>
          {Object.entries(KNOWN_SELLERS).map(([addr, name]) => {
            const allowed = whitelist?.[addr] ?? null;
            return (
              <div key={addr} className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2 text-sm">
                <div>
                  <div>{name}</div>
                  <div className="font-mono text-xs text-muted">{shortAddress(addr)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs ${allowed ? "text-trusted" : "text-sandbox"}`}>
                    {allowed === null ? "…" : allowed ? "Whitelist" : "Sandbox"}
                  </span>
                  <button
                    type="button"
                    disabled={busy || !isOwner || allowed === null}
                    onClick={() => onToggle(addr as Address, !allowed)}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {allowed ? "Gỡ" : "Thêm"}
                  </button>
                </div>
              </div>
            );
          })}
          {extraWhitelisted.map((addr) => (
            <div
              key={addr}
              className="flex items-center justify-between gap-3 rounded-xl border border-trusted/25 bg-background px-3 py-2 text-sm"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span>API quen đã duyệt</span>
                  <span className="rounded-full bg-trusted/15 px-2 py-0.5 text-[10px] font-medium text-trusted">
                    1-click
                  </span>
                </div>
                <a
                  href={addressUrl(addr)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-muted hover:text-flow"
                >
                  {shortAddress(addr)} ↗
                </a>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-trusted">Whitelist</span>
                <button
                  type="button"
                  disabled={busy || !isOwner}
                  onClick={() => onToggle(addr, false)}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Gỡ
                </button>
              </div>
            </div>
          ))}
          <AddWhitelistForm
            policy={policy}
            whitelist={whitelist}
            isOwner={isOwner}
            busy={busy}
            onAdd={(addr) => onToggle(addr, true)}
          />
        </div>
        <CapsForm policy={policy} raw={raw} isOwner={isOwner} busy={busy} onSetCaps={onSetCaps} />
        <Erc8004Section
          owner={owner}
          isOwner={isOwner}
          busy={busy}
          identities={identities}
          error={erc8004Error}
          onRegister={onRegisterErc8004}
        />
      </div>
    </section>
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
    <div className="flex flex-col gap-1.5 rounded-xl bg-background p-3">
      <label htmlFor={selectId} className="text-xs font-medium text-muted">
        Chọn policy hiển thị & thao tác
      </label>
      <select
        id={selectId}
        name="activePolicy"
        value={policy}
        onChange={(e) => onSelect(e.target.value as Address)}
        className="min-h-11 rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-flow"
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
        <h3 id={headingId} className="text-sm font-medium text-foreground">
          Tạo AgentPolicy qua Factory
        </h3>
        <span className="font-mono text-[11px] text-muted">
          Mặc định: {formatUsdc(DEMO_POLICY_PARAMS.perTxCap)} / {formatUsdc(DEMO_POLICY_PARAMS.dailyCap)} USDC
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={agentId} className="text-xs text-muted">
            Ví agent (EOA được phép xin chi)
          </label>
          <input
            ref={agentRef}
            id={agentId}
            name="agentAddress"
            type="text"
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
            className={`min-h-11 rounded-lg border bg-card px-3 py-1.5 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-flow disabled:opacity-50 ${
              agentErr ? "border-danger bg-danger/5" : "border-border"
            }`}
          />
          {agentErr && (
            <p id={agentErrId} className="text-xs text-danger">
              {agentErr}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={periodId} className="text-xs text-muted">
            Chu kỳ (giây)
          </label>
          <input
            ref={periodRef}
            id={periodId}
            name="periodSeconds"
            type="text"
            inputMode="numeric"
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
            className={`min-h-11 rounded-lg border bg-card px-3 py-1.5 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-flow disabled:opacity-50 ${
              periodErr ? "border-danger bg-danger/5" : "border-border"
            }`}
          />
          {periodErr && (
            <p id={periodErrId} className="text-xs text-danger">
              {periodErr}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted">
          Sandbox mặc định: {formatUsdc(DEMO_POLICY_PARAMS.sandboxPerTxCap)} /{" "}
          {formatUsdc(DEMO_POLICY_PARAMS.sandboxDailyCap)} USDC · Chu kỳ: {formatPeriod(Number(periodInput) || 120)}
        </span>
        <button
          type="submit"
          disabled={busy || disabled}
          className="rounded-lg bg-flow px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">
          Hộ chiếu danh tính <span className="text-flow">ERC-8004</span>
        </h3>
        <a
          href={addressUrl(ERC8004_IDENTITY_REGISTRY_ADDRESS)}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-muted hover:text-flow"
        >
          Registry {shortAddress(ERC8004_IDENTITY_REGISTRY_ADDRESS)} ↗
        </a>
      </div>

      {error && <p className="text-xs text-danger">Không đọc được registry ERC-8004: {error}</p>}

      {identities === null ? (
        <p className="text-xs text-muted">Đang kiểm tra NFT danh tính trên Fuji…</p>
      ) : identities.length === 0 ? (
        <p className="text-xs text-muted">
          Chủ policy chưa đăng ký hộ chiếu ERC-8004 trên Fuji. Đăng ký 1 lần để gắn danh tính chuẩn Trustless Agents cho
          agent.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {identities.map((id) => (
            <li
              key={id.agentId.toString()}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background px-3 py-2 text-xs"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={nftUrl(ERC8004_IDENTITY_REGISTRY_ADDRESS, id.agentId)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-trusted/15 px-2 py-0.5 font-mono font-semibold text-trusted hover:underline"
                  >
                    ID #{id.agentId.toString()}
                  </a>
                  <span className="font-medium text-foreground">{id.decoded.name ?? "AgentIdentity NFT"}</span>
                </div>
                <span className="font-mono text-[11px] text-muted">
                  {id.decoded.policyAddress
                    ? `Policy: ${shortAddress(id.decoded.policyAddress)}`
                    : id.agentWallet
                      ? `Wallet: ${shortAddress(id.agentWallet)}`
                      : shortAddress(id.owner)}
                </span>
              </div>
              {id.txHash && (
                <a href={txUrl(id.txHash)} target="_blank" rel="noreferrer" className="text-flow hover:underline">
                  Snowscan ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <label htmlFor={inputId} className="text-xs text-muted">
            Tên hiển thị trên hộ chiếu ERC-8004 (lưu URI công khai, không PII)
          </label>
          <input
            id={inputId}
            name="erc8004AgentName"
            type="text"
            maxLength={64}
            disabled={busy || !owner || !isOwner}
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="min-h-11 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-flow disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !owner || !isOwner}
          className="min-h-11 rounded-lg border border-flow/50 bg-flow/10 px-3 py-2 text-xs font-semibold text-flow transition hover:bg-flow/20 disabled:cursor-not-allowed disabled:opacity-40"
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
  fields: ReadonlyArray<{ key: CapsField; label: string }>;
}> = [
  {
    legend: "Tầng 1: Whitelist (tin cậy)",
    accent: "text-trusted",
    fields: [
      { key: "perTxCap", label: "Mỗi lần (USDC)" },
      { key: "dailyCap", label: "Chu kỳ (chung cả 2 tầng)" },
    ],
  },
  {
    legend: "Tầng 2: Sandbox (địa chỉ lạ)",
    accent: "text-sandbox",
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
    <form
      aria-labelledby={headingId}
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-3 border-t border-border pt-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-sm font-medium">
          Hạn mức 2 tầng (<code>setCaps</code>)
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && raw && (
            <button
              type="button"
              onClick={handleRevert}
              disabled={busy}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Khớp chuỗi
            </button>
          )}
          <button
            type="button"
            onClick={handleFillDemo}
            disabled={controlsDisabled}
            className="rounded-md border border-flow/40 bg-flow/10 px-2.5 py-1 text-xs font-medium text-flow transition hover:bg-flow/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Mặc định demo (0.002 / 0.003 / 0.0005 / 0.001)
          </button>
        </div>
      </div>

      <p id={hintId} className="text-xs text-muted">
        Đơn vị USDC (tối đa 6 số thập phân). Ràng buộc: mỗi lần ≤ chu kỳ (cả 2 tầng) và Sandbox chu kỳ ≤ Whitelist chu kỳ.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CAPS_GROUPS.map((group) => (
          <fieldset key={group.legend} className="flex flex-col gap-2.5 rounded-xl bg-background p-3">
            <legend className={`px-1 text-xs font-semibold ${group.accent}`}>{group.legend}</legend>
            {group.fields.map(({ key, label }) => {
              const inputId = `${baseId}-${key}`;
              const errorId = `${baseId}-${key}-error`;
              const err = visibleError(key);
              const describedBy = err ? `${hintId} ${errorId}` : hintId;
              return (
                <div key={key} className="flex flex-col gap-1">
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
                    className={`min-h-11 rounded-lg border bg-card px-3 py-1.5 font-mono text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-flow disabled:cursor-not-allowed disabled:opacity-50 ${
                      err ? "border-danger bg-danger/5" : "border-border"
                    }`}
                  />
                  {err && (
                    <p id={errorId} className="text-xs text-danger">
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
        <div className="rounded-lg border border-danger/50 bg-danger/10 px-3 py-2 text-xs text-danger">
          Chưa thể gửi giao dịch: {validation.errors[0]}
        </div>
      )}

      {hasZeroCap && (
        <div className="flex flex-col gap-2 rounded-lg border border-sandbox/60 bg-sandbox/10 px-3 py-2 text-xs text-sandbox">
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
            <span className="text-danger">Vui lòng tick xác nhận ở trên trước khi ký giao dịch đặt hạn mức = 0.</span>
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
          className="rounded-lg bg-flow px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Lưu hạn mức
        </button>
      </div>
    </form>
  );
}
