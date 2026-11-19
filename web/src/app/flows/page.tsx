import type { Metadata } from "next";
import { FlowsView } from "@/components/FlowsView";
import { MissingAppIdNotice } from "@/components/MissingAppIdNotice";
import { APP_ID_STATE } from "@/lib/app-id";

export const metadata: Metadata = {
  title: "Dòng tiền x402 — AgentLeash",
};

export default function FlowsPage() {
  if (APP_ID_STATE !== "ok") {
    return <MissingAppIdNotice />;
  }
  return <FlowsView />;
}
