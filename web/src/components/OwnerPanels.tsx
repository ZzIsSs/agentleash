"use client";

import type { Address } from "viem";
import { formatEther } from "viem";
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

/** Ô [3]: tạo policy của chủ (qua factory) và bật/tắt whitelist 2 API demo. Sửa hạn mức để GĐ 3c. */
export function SetupCard({
  owner,
  avax,
  myPolicy,
  raw,
  isOwner,
  whitelist,
  busy,
  onCreate,
  onToggle,
}: {
  owner: Address | null;
  avax: bigint | null;
  myPolicy: Address | null;
  raw: PolicyRaw | null;
  isOwner: boolean;
  whitelist: Record<string, boolean> | null;
  busy: boolean;
  onCreate: () => void;
  onToggle: (payTo: Address, allowed: boolean) => void;
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
            onClick={onCreate}
            disabled={busy || !owner || noGas}
            className="self-start rounded-lg bg-flow px-4 py-2 font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Tạo policy của tôi
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
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
          <p className="text-xs text-muted">Sửa hạn mức trên giao diện: GĐ 3c (16/11).</p>
        </div>
      )}
    </section>
  );
}
