import type { Metadata } from "next";
import { McpView } from "@/components/McpView";
import { MissingAppIdNotice } from "@/components/MissingAppIdNotice";
import { APP_ID_STATE } from "@/lib/app-id";

export const metadata: Metadata = {
  title: "MCP Bên A – Bên B — AgentLeash",
};

export default function McpPage() {
  if (APP_ID_STATE !== "ok") {
    return <MissingAppIdNotice />;
  }
  return <McpView />;
}
