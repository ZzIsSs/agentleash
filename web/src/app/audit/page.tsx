import type { Metadata } from "next";
import { AuditView } from "@/components/AuditView";
import { MissingAppIdNotice } from "@/components/MissingAppIdNotice";
import { APP_ID_STATE } from "@/lib/app-id";

export const metadata: Metadata = {
  title: "Nhật ký & RuleEngine — AgentLeash",
};

export default function AuditPage() {
  if (APP_ID_STATE !== "ok") {
    return <MissingAppIdNotice />;
  }
  return <AuditView />;
}
