/**
 * Đồng bộ (tùy chọn) mục "Bị từ chối" lên Upstash Redis để Dashboard Vercel đọc được.
 *
 * - Chỉ bật khi có đủ URL + token REST (nhận cả tên Upstash `UPSTASH_REDIS_REST_*` lẫn tên
 *   Vercel Marketplace `KV_REST_API_*`). Không có thì không làm gì: agent vẫn chỉ ghi
 *   `agent/logs/audit.json` như cũ (ưu tiên local, demo không phụ thuộc dịch vụ ngoài).
 * - Chỉ đẩy bản ghi bị chặn (REJECTED_*) và chỉ các trường mục Bị từ chối hiển thị.
 *   Không đẩy `query` / `endpoint` (Luật 5), không đẩy khóa nào.
 * - Không chặn luồng chi: lỗi mạng chỉ in ra stderr (stdout của MCP stdio phải thuần JSON-RPC).
 */
import type { AuditLogEntry } from "./log.ts";

export const DEFAULT_AUDIT_SYNC_KEY = "agentleash:audit:rejections";
/** Giữ tối đa 100 bản ghi mới nhất: đủ cho Dashboard (hiện 50) và nhẹ cho gói miễn phí. */
export const AUDIT_SYNC_MAX_ENTRIES = 100;
const SYNC_TIMEOUT_MS = 5_000;

export interface AuditSyncConfig {
  url: string;
  token: string;
  key: string;
}

export type SyncedRejection = Pick<
  AuditLogEntry,
  "id" | "timestamp" | "status" | "api" | "payTo" | "amountUnits" | "ruleCode" | "reason" | "bypassRules"
>;

type Env = Record<string, string | undefined>;

const clean = (v: string | undefined): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

/** Đọc cấu hình từ biến môi trường; trả `null` khi thiếu hoặc đang chạy trong vitest. */
export function resolveAuditSyncConfig(env: Env = process.env): AuditSyncConfig | null {
  if (env.VITEST) return null;
  const url = clean(env.UPSTASH_REDIS_REST_URL) ?? clean(env.KV_REST_API_URL);
  const token = clean(env.UPSTASH_REDIS_REST_TOKEN) ?? clean(env.KV_REST_API_TOKEN);
  if (!url || !token) return null;
  return {
    url: url.replace(/\/+$/, ""),
    token,
    key: clean(env.AUDIT_SYNC_KEY) ?? DEFAULT_AUDIT_SYNC_KEY,
  };
}

/** Rút gọn một bản ghi audit thành dạng đẩy lên cloud; `null` nếu không phải lượt bị chặn. */
export function toSyncedRejection(entry: AuditLogEntry): SyncedRejection | null {
  if (entry.status !== "REJECTED_OFFCHAIN" && entry.status !== "REJECTED_ONCHAIN") return null;
  return {
    id: entry.id,
    timestamp: entry.timestamp,
    status: entry.status,
    api: entry.api,
    ...(entry.payTo !== undefined ? { payTo: entry.payTo } : {}),
    ...(entry.amountUnits !== undefined ? { amountUnits: entry.amountUnits } : {}),
    ...(entry.ruleCode !== undefined ? { ruleCode: entry.ruleCode } : {}),
    ...(entry.reason !== undefined ? { reason: entry.reason } : {}),
    ...(entry.bypassRules !== undefined ? { bypassRules: entry.bypassRules } : {}),
  };
}

/**
 * Đẩy một lượt bị chặn lên Redis (LPUSH + LTRIM trong một pipeline REST).
 * Trả `true` khi thành công; mọi lỗi được nuốt và ghi stderr, không bao giờ throw.
 */
export async function pushAuditEntry(
  entry: AuditLogEntry,
  config: AuditSyncConfig,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const record = toSyncedRejection(entry);
  if (!record) return false;
  try {
    const res = await fetchFn(`${config.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["LPUSH", config.key, JSON.stringify(record)],
        ["LTRIM", config.key, "0", String(AUDIT_SYNC_MAX_ENTRIES - 1)],
      ]),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[AgentLeash audit-sync] Upstash trả HTTP ${res.status}, bỏ qua lượt đồng bộ này.`);
      return false;
    }
    const body = (await res.json().catch(() => null)) as Array<{ error?: string }> | null;
    const failed = Array.isArray(body) ? body.find((r) => r && typeof r.error === "string") : undefined;
    if (failed) {
      console.error(`[AgentLeash audit-sync] Upstash báo lỗi: ${failed.error}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[AgentLeash audit-sync] Không đồng bộ được lên Upstash: ${(err as Error)?.message || err}`);
    return false;
  }
}

const pending = new Set<Promise<boolean>>();

/** Gọi từ `appendAuditLog`: đẩy nền, không chờ. Không có cấu hình thì bỏ qua. */
export function queueAuditSync(
  entry: AuditLogEntry,
  config: AuditSyncConfig | null = resolveAuditSyncConfig(),
  fetchFn: typeof fetch = fetch,
): void {
  if (!config || !toSyncedRejection(entry)) return;
  const job = pushAuditEntry(entry, config, fetchFn);
  pending.add(job);
  void job.finally(() => pending.delete(job));
}

/** Chờ các lượt đồng bộ còn dở (gọi trước khi CLI thoát). */
export async function flushAuditSync(): Promise<void> {
  if (pending.size === 0) return;
  await Promise.allSettled([...pending]);
}
