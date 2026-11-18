import { readFile } from "node:fs/promises";
import path from "node:path";
import { createCachedAuditReader, resolveAuditStoreConfig } from "@/lib/auditStore";
import { rejectionToJson, toRejectionsWithTotal } from "@/lib/rejections";

// Đọc file mỗi lần gọi, không cache: agent ghi thêm dòng trong lúc demo.
export const dynamic = "force-dynamic";

/** agent/src/log.ts ghi vào agentleash/agent/logs/audit.json; `npm run dev` chạy trong agentleash/web. */
const AUDIT_LOG_PATH = process.env.AUDIT_LOG_PATH || path.resolve(process.cwd(), "..", "agent", "logs", "audit.json");

// Bản Vercel: có biến Upstash thì đọc mục Bị từ chối do agent local đẩy lên (agent/src/auditSync.ts).
const storeConfig = resolveAuditStoreConfig();
const readStore = storeConfig ? createCachedAuditReader(storeConfig) : null;

export async function GET() {
  if (readStore) {
    try {
      const { items, total } = toRejectionsWithTotal(await readStore());
      return Response.json({
        available: true,
        source: "upstash",
        items: items.map(rejectionToJson),
        total,
      });
    } catch {
      // Dashboard giữ danh sách cũ khi gặp 503.
      return Response.json({ error: "Chưa đọc được nhật ký đồng bộ, thử lại sau." }, { status: 503 });
    }
  }

  let text: string;
  try {
    text = await readFile(AUDIT_LOG_PATH, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({ available: false, items: [], total: 0 });
    }
    return Response.json({ error: "Không đọc được nhật ký agent." }, { status: 500 });
  }

  try {
    const { items, total } = toRejectionsWithTotal(JSON.parse(text));
    return Response.json({
      available: true,
      source: "file",
      items: items.map(rejectionToJson),
      total,
    });
  } catch {
    // Agent đang ghi dở file: báo tạm thời để dashboard giữ danh sách cũ.
    return Response.json({ error: "Nhật ký agent đang được ghi, thử lại sau." }, { status: 503 });
  }
}
