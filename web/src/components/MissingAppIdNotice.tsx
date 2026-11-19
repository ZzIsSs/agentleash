import { APP_ID_STATE } from "@/lib/app-id";
import { AgentLeashMark, AlertTriangleIcon } from "./Icons";

export function MissingAppIdNotice() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 px-6 py-12">
      <div className="flex items-center gap-3">
        <AgentLeashMark className="h-8 w-8 shrink-0" />
        <span className="text-xl font-bold tracking-tight text-foreground">
          Agent<span className="text-flow">Leash</span>
        </span>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-sandbox/40 bg-card/90 p-6 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 text-sandbox-text">
          <AlertTriangleIcon className="h-5 w-5 shrink-0" />
          <h1 className="text-lg font-semibold text-foreground">Chưa cấu hình Privy App ID</h1>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          {APP_ID_STATE === "missing"
            ? "Thiếu biến môi trường NEXT_PUBLIC_PRIVY_APP_ID trong web/.env.local."
            : "NEXT_PUBLIC_PRIVY_APP_ID phải dài đúng 25 ký tự."}{" "}
          Lấy mã tại <span className="font-mono text-foreground">dashboard.privy.io</span> (mục{" "}
          <span className="text-foreground">App settings → Basics</span>), lưu vào{" "}
          <code className="rounded bg-surface-inset px-1.5 py-0.5 font-mono text-xs text-flow-text">
            web/.env.local
          </code>{" "}
          rồi khởi động lại <code className="font-mono text-xs text-foreground">npm run dev</code>.
        </p>
      </section>
    </main>
  );
}
