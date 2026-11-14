import { Dashboard } from "@/components/Dashboard";
import { APP_ID_STATE } from "@/lib/app-id";

export default function Home() {
  if (APP_ID_STATE !== "ok") {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 p-8">
        <h1 className="text-2xl font-bold">Chưa cấu hình Privy</h1>
        <p className="text-muted">
          {APP_ID_STATE === "missing"
            ? "Thiếu NEXT_PUBLIC_PRIVY_APP_ID trong web/.env.local."
            : "NEXT_PUBLIC_PRIVY_APP_ID phải dài đúng 25 ký tự."}{" "}
          Lấy ở dashboard.privy.io, mục App settings → Basics, rồi khởi động lại `npm run dev`.
        </p>
      </main>
    );
  }
  return <Dashboard />;
}
