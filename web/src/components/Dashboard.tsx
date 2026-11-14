"use client";

import { usePrivy } from "@privy-io/react-auth";
import { POLICY_ADDRESS, addressUrl, shortAddress } from "@/lib/chain";
import {
  deriveOverview,
  formatCountdown,
  formatPeriod,
  formatUsdc,
  type Meter,
  type PolicyOverview,
  type PolicyRaw,
} from "@/lib/policy";
import { useNow, usePolicy } from "@/lib/usePolicy";

export function Dashboard() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { raw, error, updatedAt } = usePolicy(authenticated);
  const now = useNow();

  if (!ready) {
    return <Centered>Đang tải Privy…</Centered>;
  }

  if (!authenticated) {
    return (
      <Centered>
        <div className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-border bg-card p-8 text-center">
          <Logo />
          <p className="text-muted">
            Ví cho AI agent có dây xích on-chain: hạn mức hai tầng, whitelist và nút khóa khẩn cấp trên Avalanche
            Fuji.
          </p>
          <button
            onClick={login}
            className="rounded-lg bg-flow px-4 py-3 font-semibold text-background transition hover:opacity-90"
          >
            Đăng nhập bằng email
          </button>
        </div>
      </Centered>
    );
  }

  const overview = raw ? deriveOverview(raw, now) : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-4 p-4 md:p-6">
      <Header
        email={user?.email?.address ?? null}
        wallet={user?.wallet?.address ?? null}
        overview={overview}
        onLogout={logout}
      />

      {error && (
        <div className="rounded-lg border border-danger/50 bg-danger/10 px-4 py-2 text-sm text-danger">
          Không đọc được dữ liệu on-chain, đang thử lại: {error}
        </div>
      )}

      <main className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <OverviewCard overview={overview} raw={raw} updatedAt={updatedAt} />
        <Placeholder index={2} title="Sơ đồ dòng tiền" note="GĐ 3b, ngày 15/11" />
        <Placeholder index={3} title="Luật chi tiêu 2 tầng" note="GĐ 3c, ngày 16/11" />
        <Placeholder index={4} title="Lịch sử chi & nhật ký bị từ chối" note="GĐ 3b, ngày 15/11" />
      </main>
    </div>
  );
}

function Header({
  email,
  wallet,
  overview,
  onLogout,
}: {
  email: string | null;
  wallet: string | null;
  overview: PolicyOverview | null;
  onLogout: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        <Logo />
        {overview && (
          <span className="rounded-full border border-sandbox/50 bg-sandbox/10 px-3 py-1 text-xs font-medium text-sandbox">
            DEMO: chu kỳ {formatPeriod(overview.periodSeconds)} (thực tế: 1 ngày)
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-md bg-background px-2 py-1 text-muted">Fuji Testnet</span>
        <a
          href={addressUrl(POLICY_ADDRESS)}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-flow hover:underline"
          title="Mở policy trên Snowscan"
        >
          {shortAddress(POLICY_ADDRESS)}
        </a>
        {overview && <span className="font-mono">{formatUsdc(overview.balance)} USDC</span>}
        <span className="text-muted" title={wallet ?? undefined}>
          {email ?? (wallet ? shortAddress(wallet) : "")}
        </span>
        <button onClick={onLogout} className="rounded-md border border-border px-3 py-1 text-muted hover:text-foreground">
          Đăng xuất
        </button>
        {/* TODO Nguyên (GĐ 3b): gọi pause(). Cần ví chủ policy ký, ví Privy hiện chưa phải owner. */}
        <button
          disabled
          className="cursor-not-allowed rounded-lg bg-danger/40 px-4 py-2 font-bold text-white/70"
          title="Có ở GĐ 3b"
        >
          KHÓA KHẨN CẤP
        </button>
      </div>
    </header>
  );
}

function OverviewCard({
  overview,
  raw,
  updatedAt,
}: {
  overview: PolicyOverview | null;
  raw: PolicyRaw | null;
  updatedAt: number | null;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          <span className="text-muted">[1]</span> Tổng quan
        </h2>
        {overview && <StatusBadge status={overview.status} />}
      </div>

      {!overview || !raw ? (
        <p className="text-muted">Đang đọc policy trên Fuji…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Số dư policy" value={`${formatUsdc(overview.balance)}`} unit="USDC" />
            <Stat label="Agent chi được ngay" value={`${formatUsdc(overview.spendableNow)}`} unit="USDC" />
            <Stat label="Hồi hạn mức sau" value={formatCountdown(overview.secondsToReset)} unit="phút:giây" />
          </div>

          <MeterBar
            title="Tầng 1: Whitelist (tin cậy)"
            hint={`Trần chung của chu kỳ, tính cả Sandbox. Tối đa ${formatUsdc(overview.perTxCap)} USDC mỗi lần.`}
            meter={overview.trusted}
            color="bg-trusted"
            text="text-trusted"
          />
          <MeterBar
            title="Tầng 2: Sandbox (API lạ)"
            hint={`Trần riêng cho địa chỉ ngoài whitelist. Tối đa ${formatUsdc(overview.sandboxPerTxCap)} USDC mỗi lần.`}
            meter={overview.sandbox}
            color="bg-sandbox"
            text="text-sandbox"
          />

          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted sm:grid-cols-2">
            <div>
              Chủ policy:{" "}
              <a href={addressUrl(raw.owner)} target="_blank" rel="noreferrer" className="font-mono hover:text-flow">
                {shortAddress(raw.owner)}
              </a>
            </div>
            <div>
              Ví agent:{" "}
              <a href={addressUrl(raw.agent)} target="_blank" rel="noreferrer" className="font-mono hover:text-flow">
                {shortAddress(raw.agent)}
              </a>
            </div>
            <div>Block: {raw.blockNumber.toString()}</div>
            <div>Cập nhật: {updatedAt ? new Date(updatedAt).toLocaleTimeString("vi-VN") : "—"} (3 giây/lần)</div>
          </dl>
        </>
      )}
    </section>
  );
}

function MeterBar({
  title,
  hint,
  meter,
  color,
  text,
}: {
  title: string;
  hint: string;
  meter: Meter;
  color: string;
  text: string;
}) {
  const pct = Math.round(meter.usedRatio * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        <span className="text-sm">
          Còn <span className={`font-mono text-xl font-semibold ${text}`}>{formatUsdc(meter.remaining)}</span>
          <span className="text-muted"> / {formatUsdc(meter.cap)} USDC</span>
        </span>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full bg-background"
        role="meter"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={100 - pct}
      >
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${100 - pct}%` }} />
      </div>
      <p className="text-xs text-muted">
        Đã chi {formatUsdc(meter.spent)} USDC trong chu kỳ. {hint}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: PolicyOverview["status"] }) {
  return status === "active" ? (
    <span className="flex items-center gap-2 rounded-full bg-trusted/15 px-3 py-1 text-sm font-medium text-trusted">
      <span className="h-2 w-2 animate-pulse rounded-full bg-trusted" /> Đang hoạt động
    </span>
  ) : (
    <span className="flex items-center gap-2 rounded-full bg-danger/15 px-3 py-1 text-sm font-medium text-danger">
      <span className="h-2 w-2 rounded-full bg-danger" /> Đã khóa (paused)
    </span>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl bg-background p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-mono text-xl font-semibold">{value}</div>
      <div className="text-xs text-muted">{unit}</div>
    </div>
  );
}

function Placeholder({ index, title, note }: { index: number; title: string; note: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-dashed border-border bg-card/50 p-5">
      <h2 className="text-lg font-semibold">
        <span className="text-muted">[{index}]</span> {title}
      </h2>
      <p className="text-sm text-muted">Sắp có: {note}.</p>
    </section>
  );
}

function Logo() {
  return (
    <span className="text-xl font-bold tracking-tight">
      Agent<span className="text-flow">Leash</span>
    </span>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6 text-muted">{children}</div>;
}
