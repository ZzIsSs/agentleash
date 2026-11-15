import { readFile } from "node:fs/promises";
import path from "node:path";
import { rejectionToJson, toRejections } from "@/lib/rejections";

// Đọc file mỗi lần gọi, không cache: agent ghi thêm dòng trong lúc demo.
export const dynamic = "force-dynamic";

/** agent/src/log.ts ghi vào agentleash/agent/logs/audit.json; `npm run dev` chạy trong agentleash/web. */
const AUDIT_LOG_PATH = process.env.AUDIT_LOG_PATH || path.resolve(process.cwd(), "..", "agent", "logs", "audit.json");

export async function GET() {
  let text: string;
  try {
    text = await readFile(AUDIT_LOG_PATH, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({ available: false, items: [] });
    }
    return Response.json({ error: "Không đọc được nhật ký agent." }, { status: 500 });
  }

  try {
    const items = toRejections(JSON.parse(text)).map(rejectionToJson);
    return Response.json({ available: true, items });
  } catch {
    // Agent đang ghi dở file: báo tạm thời để dashboard giữ danh sách cũ.
    return Response.json({ error: "Nhật ký agent đang được ghi, thử lại sau." }, { status: 503 });
  }
}
