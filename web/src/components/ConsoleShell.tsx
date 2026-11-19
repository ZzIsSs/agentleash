"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { addressUrl, shortAddress } from "@/lib/chain";
import { formatCountdown, formatPeriod, formatUsdc } from "@/lib/policy";
import { useConsole } from "./ConsoleProvider";
import {
  ActivityFlowIcon,
  AgentLeashMark,
  AlertTriangleIcon,
  ArrowUpRightIcon,
  CloseIcon,
  MenuIcon,
  ShieldBanIcon,
  ShieldCheckIcon,
  SlidersIcon,
  TerminalIcon,
} from "./Icons";
import { ConfirmDialog, KillSwitch, TxBanner } from "./OwnerControls";

type NavRouteItem = {
  href: "/" | "/flows" | "/policies" | "/audit" | "/mcp";
  label: string;
  sublabel: string;
  Icon: typeof ShieldCheckIcon;
};

const NAV_ROUTES: readonly NavRouteItem[] = [
  { href: "/", label: "Tổng quan", sublabel: "Điều khiển & hạn mức", Icon: ShieldCheckIcon },
  { href: "/flows", label: "Dòng tiền x402", sublabel: "Sơ đồ & giao dịch", Icon: ActivityFlowIcon },
  { href: "/policies", label: "Policy & Luật 2 tầng", sublabel: "Whitelist & setCaps", Icon: SlidersIcon },
  { href: "/audit", label: "Nhật ký & Rules", sublabel: "Chặn off/on-chain", Icon: ShieldBanIcon },
  { href: "/mcp", label: "MCP Bên A – Bên B", sublabel: "Cấu hình agent", Icon: TerminalIcon },
];

/** Che email khi quay demo: "demo.user@example.com" → "de•••@example.com". */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "•••";
  const local = email.slice(0, at);
  return `${local.slice(0, Math.min(2, local.length - 1))}•••${email.slice(at)}`;
}

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const { spends, rejections, raw } = useConsole();
  const rejectionCount = Math.max(rejections.total, rejections.items.length);

  return (
    <ul className="flex flex-col gap-1.5">
      {NAV_ROUTES.map(({ href, label, sublabel, Icon }) => {
        const active = isActiveRoute(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={`group flex items-center justify-between gap-2.5 rounded-xl border px-3 py-2.5 transition ${
                active
                  ? "border-flow/55 bg-flow/12 text-flow-text"
                  : "border-transparent text-muted hover:border-border hover:bg-surface-inset/75 hover:text-foreground"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                {/* Chỉ báo trạng thái phi màu sắc (WCAG 1.4.1): thanh pill dọc kết hợp viền và chữ đậm */}
                <span
                  className={`h-4 w-1 shrink-0 rounded-full transition ${
                    active ? "bg-flow" : "bg-transparent group-hover:bg-border-control/60"
                  }`}
                  aria-hidden="true"
                />
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active ? "text-flow-text" : "text-muted group-hover:text-foreground"
                  }`}
                />
                <span className="flex min-w-0 flex-col">
                  <span className={`truncate text-xs sm:text-sm ${active ? "font-semibold text-foreground" : "font-medium"}`}>
                    {label}
                  </span>
                  <span className="truncate text-xs text-muted">{sublabel}</span>
                </span>
              </span>

              {href === "/" && (
                <span
                  className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full border border-background ${
                    raw?.paused ? "bg-danger" : "bg-trusted"
                  }`}
                  title={raw?.paused ? "Policy đang bị khóa" : "Policy đang hoạt động"}
                  aria-label={raw?.paused ? "Đang khóa" : "Đang hoạt động"}
                />
              )}
              {href === "/flows" && (
                <span className="tabular-nums shrink-0 rounded-md border border-flow/30 bg-flow/10 px-1.5 py-0.5 font-mono text-xs font-medium text-flow-text">
                  {spends.length}
                </span>
              )}
              {href === "/audit" && (
                <span
                  className={`tabular-nums shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-xs font-medium ${
                    rejectionCount > 0
                      ? "border-danger/35 bg-danger/10 text-danger-text"
                      : "border-border bg-surface-inset text-muted"
                  }`}
                >
                  {rejectionCount}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SidebarQuickStatusCard() {
  const { overview, raw, policy } = useConsole();
  const paused = raw?.paused ?? false;

  return (
    <section
      aria-label="Trạng thái nhanh"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card/90 p-3.5 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-tight text-foreground">Trạng thái nhanh</span>
        {overview ? (
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${
              paused
                ? "border-danger/40 bg-danger/15 text-danger-text"
                : "border-trusted/30 bg-trusted/10 text-trusted-text"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${paused ? "bg-danger" : "bg-trusted"}`} aria-hidden="true" />
            <span>{paused ? "Đã khóa" : "Hoạt động"}</span>
          </span>
        ) : (
          <span className="h-5 w-20 animate-pulse rounded bg-surface-inset" aria-hidden="true" />
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-lg bg-surface-inset p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted">Chi được ngay</span>
          <span
            className={`tabular-nums font-mono font-semibold ${
              paused ? "text-danger-text" : "text-flow-text"
            }`}
          >
            {overview ? `${formatUsdc(overview.spendableNow)} USDC` : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted">Hồi hạn mức sau</span>
          <span className="tabular-nums font-mono font-semibold text-foreground">
            {overview ? formatCountdown(overview.secondsToReset) : "—"}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5 text-xs text-muted">
        <span>Policy:</span>
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
    </section>
  );
}

/** Khung điều hướng cố định dùng chung cho cả 5 route: Sticky Header, Sidebar (desktop), Drawer (mobile), TxBanner & Kill Switch Dialog. */
export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const drawerId = useId();
  const drawerRef = useRef<HTMLDialogElement | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const {
    ready,
    authenticated,
    login,
    logout,
    userEmail,
    userWallet,
    policy,
    raw,
    policyError,
    overview,
    txState,
    resetTx,
    busy,
    isOwner,
    confirmPause,
    setConfirmPause,
    sendPause,
  } = useConsole();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;
    if (mobileNavOpen && !dialog.open) {
      dialog.showModal();
    } else if (!mobileNavOpen && dialog.open) {
      dialog.close();
    }
  }, [mobileNavOpen]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-dashboard"
        className="sr-only rounded-lg bg-flow px-3 py-2 text-xs font-semibold text-background focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Chuyển tới nội dung chính
      </a>

      {/* Sticky Header ghim cố định xuyên suốt các trang */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-2 px-3 py-2.5 sm:px-5 xl:flex-row xl:items-center xl:justify-between lg:px-6">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Mở menu điều hướng"
              aria-expanded={mobileNavOpen}
              aria-controls={drawerId}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border-control bg-surface-inset px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-elevated lg:hidden"
            >
              <MenuIcon className="h-4 w-4 shrink-0" />
              <span>Menu</span>
            </button>

            <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none">
              <AgentLeashMark className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
              <div className="flex flex-col">
                <span translate="no" className="text-lg font-bold leading-tight tracking-tight text-foreground sm:text-xl">
                  Agent<span className="text-flow">Leash</span>
                </span>
                <span className="text-xs text-muted">Cổng kiểm soát chi tiêu x402</span>
              </div>
            </Link>

            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-sandbox/35 bg-sandbox/10 px-2 py-1 text-xs font-medium text-sandbox-text">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sandbox" aria-hidden="true" />
              <span>
                DEMO: chu kỳ {overview ? formatPeriod(overview.periodSeconds) : "120 giây"} (thực tế: 1 ngày)
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs sm:gap-2 xl:text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-inset px-2.5 py-1 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-trusted" aria-hidden="true" />
              <span>Fuji Testnet</span>
            </span>

            <a
              href={addressUrl(policy)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border bg-surface-inset px-2.5 py-1 font-mono text-xs text-flow hover:border-flow/45 hover:text-flow-text hover:underline"
              title="Mở policy trên Snowscan"
            >
              <span>{shortAddress(policy)}</span>
              <ArrowUpRightIcon className="h-3 w-3" />
            </a>

            {overview && (
              <span className="tabular-nums rounded-md border border-border bg-surface-inset px-2.5 py-1 font-mono text-xs font-semibold text-foreground">
                {formatUsdc(overview.balance)} USDC
              </span>
            )}

            {authenticated ? (
              <>
                <span
                  className="max-w-44 truncate rounded-md border border-border bg-surface-inset px-2.5 py-1 text-xs text-muted"
                  title={userWallet ?? undefined}
                >
                  {userEmail ? maskEmail(userEmail) : userWallet ? shortAddress(userWallet) : ""}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="min-h-9 rounded-lg border border-border-control bg-surface-inset px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-elevated"
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <span className="rounded-md border border-border bg-surface-inset px-2.5 py-1 text-xs text-muted">
                  Chỉ xem
                </span>
                <button
                  type="button"
                  onClick={login}
                  disabled={!ready}
                  className="min-h-9 rounded-lg bg-flow px-3.5 py-1.5 text-xs font-semibold text-background transition hover:bg-flow-text disabled:opacity-50"
                >
                  {ready ? "Đăng nhập bằng email" : "Đang tải Privy…"}
                </button>
              </>
            )}

            <KillSwitch raw={raw} isOwner={isOwner} busy={busy} onRequest={setConfirmPause} />
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer (< lg) dùng <dialog>.showModal() */}
      <dialog
        ref={drawerRef}
        id={drawerId}
        aria-label="Điều hướng các trang AgentLeash"
        onClose={() => setMobileNavOpen(false)}
        onClick={(e) => {
          if (e.target === drawerRef.current) setMobileNavOpen(false);
        }}
        className="al-nav-drawer border-r border-border bg-card p-4 text-foreground lg:hidden"
      >
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <AgentLeashMark className="h-6 w-6 shrink-0" />
              <span className="text-sm font-bold text-foreground">Điều hướng</span>
            </div>
            <button
              type="button"
              autoFocus
              onClick={() => setMobileNavOpen(false)}
              aria-label="Đóng menu điều hướng"
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-border-control bg-surface-inset text-muted transition hover:bg-surface-elevated hover:text-foreground"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <nav aria-label="Điều hướng di động">
            <SidebarNavLinks pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
          </nav>

          <div className="mt-auto">
            <SidebarQuickStatusCard />
          </div>
        </div>
      </dialog>

      {/* Shell 2 cột trên desktop: Left Sidebar (272px) + Nội dung từng trang */}
      <div className="mx-auto grid w-full max-w-[1560px] flex-1 grid-cols-1 items-start gap-4 px-3 py-4 sm:px-5 sm:py-5 lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-5 lg:px-6">
        <aside
          aria-label="Thanh điều hướng và trạng thái nhanh"
          className="hidden lg:sticky lg:top-[7.25rem] lg:flex lg:flex-col lg:gap-4 2xl:top-[5.25rem]"
        >
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card/90 p-3.5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-xs font-semibold tracking-tight text-foreground">Các màn hình</span>
              <span className="font-mono text-xs text-muted">5 routes</span>
            </div>
            <nav aria-label="Điều hướng chính AgentLeash">
              <SidebarNavLinks pathname={pathname} />
            </nav>
          </section>

          <SidebarQuickStatusCard />
        </aside>

        <main id="main-dashboard" tabIndex={-1} className="flex min-w-0 flex-col gap-4">
          <TxBanner state={txState} onClose={resetTx} />

          {policyError && (
            <div
              role="alert"
              className="flex items-center gap-2.5 rounded-xl border border-danger/45 bg-danger/10 px-4 py-2.5 text-xs text-danger-text backdrop-blur-sm sm:text-sm"
            >
              <AlertTriangleIcon className="h-4 w-4 shrink-0" />
              <span>Không đọc được dữ liệu on-chain từ Fuji RPC, đang tự động thử lại: {policyError}</span>
            </div>
          )}

          {children}
        </main>
      </div>

      {confirmPause && (
        <ConfirmDialog
          action={confirmPause}
          policy={policy}
          onCancel={() => setConfirmPause(null)}
          onConfirm={() => {
            const action = confirmPause;
            setConfirmPause(null);
            void sendPause(action);
          }}
        />
      )}
    </div>
  );
}
