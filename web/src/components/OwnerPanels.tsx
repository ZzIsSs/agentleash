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
import { DEMO_AGENT_ADDRESS, DEMO_POLICY_PARAMS, addressUrl, shortAddress, txUrl } from "@/lib/chain";
import type { TxState } from "@/lib/ownerTx";
import { formatPeriod, formatUsdc, type PolicyRaw } from "@/lib/policy";
import { KNOWN_SELLERS } from "@/lib/spends";

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

/** Ô [3]: tạo policy của chủ (qua factory), bật/tắt whitelist 2 API demo và chỉnh 4 hạn mức (setCaps). */
export function SetupCard({
  policy,
  owner,
  avax,
  myPolicy,
  raw,
  isOwner,
  whitelist,
  busy,
  onCreate,
  onToggle,
  onSetCaps,
}: {
  policy: Address;
  owner: Address | null;
  avax: bigint | null;
  myPolicy: Address | null;
  raw: PolicyRaw | null;
  isOwner: boolean;
  whitelist: Record<string, boolean> | null;
  busy: boolean;
  onCreate: () => void;
  onToggle: (payTo: Address, allowed: boolean) => void;
  onSetCaps: (caps: ParsedCaps) => Promise<boolean>;
}) {
  const noGas = avax !== null && avax === 0n;
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">
        <span className="text-muted">[3]</span> Policy & luật chi tiêu
      </h2>

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

      {!myPolicy ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Bạn đang xem policy demo của đội (chủ là ví deploy), nên chưa bấm khóa được. Tạo policy riêng: ví của bạn
            là chủ, không ai khác rút tiền hay đổi luật được.
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-background p-3 text-xs">
            <dt className="text-muted">Ví agent</dt>
            <dd className="font-mono">{shortAddress(DEMO_AGENT_ADDRESS)}</dd>
            <dt className="text-muted">Whitelist: mỗi lần / chu kỳ</dt>
            <dd className="font-mono text-trusted">
              {formatUsdc(DEMO_POLICY_PARAMS.perTxCap)} / {formatUsdc(DEMO_POLICY_PARAMS.dailyCap)} USDC
            </dd>
            <dt className="text-muted">Sandbox: mỗi lần / chu kỳ</dt>
            <dd className="font-mono text-sandbox">
              {formatUsdc(DEMO_POLICY_PARAMS.sandboxPerTxCap)} / {formatUsdc(DEMO_POLICY_PARAMS.sandboxDailyCap)} USDC
            </dd>
            <dt className="text-muted">Chu kỳ (demo)</dt>
            <dd className="font-mono">{formatPeriod(Number(DEMO_POLICY_PARAMS.period))}</dd>
          </dl>
          <button
            type="button"
            onClick={onCreate}
            disabled={busy || !owner || noGas}
            className="self-start rounded-lg bg-flow px-4 py-2 font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Tạo policy của tôi
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Policy của bạn:{" "}
            <a href={addressUrl(myPolicy)} target="_blank" rel="noreferrer" className="font-mono text-flow hover:underline">
              {shortAddress(myPolicy)}
            </a>
          </p>
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
          </div>
          <CapsForm policy={policy} raw={raw} isOwner={isOwner} busy={busy} onSetCaps={onSetCaps} />
        </div>
      )}
    </section>
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
  const [announcement, setAnnouncement] = useState("");
  const inputRefs = useRef<Partial<Record<CapsField, HTMLInputElement | null>>>({});

  const chainCapsKey = raw
    ? `${policy}:${raw.perTxCap}:${raw.dailyCap}:${raw.sandboxPerTxCap}:${raw.sandboxDailyCap}`
    : `${policy}:none`;

  useEffect(() => {
    setDirty(false);
    setInteracted({});
    setTouched({});
    setSubmitted(false);
    setAnnouncement("");
  }, [policy]);

  useEffect(() => {
    if (!dirty && raw) {
      setInputs(capsFromRaw(raw));
    }
  }, [chainCapsKey, dirty, raw]);

  const validation = validateCaps(inputs);
  const sameAsChain = !!raw && validation.ok && capsEqual(validation.caps, raw);

  const visibleError = (field: CapsField): string | undefined =>
    touched[field] || submitted ? validation.fieldErrors[field] : undefined;

  const handleChange = (field: CapsField, value: string) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
    setInteracted((prev) => ({ ...prev, [field]: true }));
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
    setAnnouncement("Đã điền 4 hạn mức mặc định demo: 0.002 / 0.003 / 0.0005 / 0.001 USDC.");
  };

  const handleRevert = () => {
    if (!raw) return;
    setInputs(capsFromRaw(raw));
    setDirty(false);
    setInteracted({});
    setTouched({});
    setSubmitted(false);
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
    if (!isOwner || busy) return;
    const confirmed = await onSetCaps(validation.caps);
    if (confirmed) {
      setDirty(false);
      setInteracted({});
      setTouched({});
      setSubmitted(false);
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
