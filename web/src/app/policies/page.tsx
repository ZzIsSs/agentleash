import type { Metadata } from "next";
import { MissingAppIdNotice } from "@/components/MissingAppIdNotice";
import { PoliciesView } from "@/components/PoliciesView";
import { APP_ID_STATE } from "@/lib/app-id";

export const metadata: Metadata = {
  title: "Policy & Luật 2 tầng — AgentLeash",
};

export default function PoliciesPage() {
  if (APP_ID_STATE !== "ok") {
    return <MissingAppIdNotice />;
  }
  return <PoliciesView />;
}
