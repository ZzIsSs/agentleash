import { MissingAppIdNotice } from "@/components/MissingAppIdNotice";
import { OverviewView } from "@/components/OverviewView";
import { APP_ID_STATE } from "@/lib/app-id";

export default function Home() {
  if (APP_ID_STATE !== "ok") {
    return <MissingAppIdNotice />;
  }
  return <OverviewView />;
}
