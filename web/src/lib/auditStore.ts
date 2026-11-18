/**
 * Đọc mục "Bị từ chối" từ Upstash Redis (agent/src/auditSync.ts đẩy lên) cho bản Dashboard Vercel.
 * Chỉ dùng phía server (route /api/rejections). Không có biến cấu hình thì route giữ nguyên cách
 * đọc file agent/logs/audit.json như bản local.
 */

export const DEFAULT_AUDIT_SYNC_KEY = "agentleash:audit:rejections";
/** Khớp AUDIT_SYNC_MAX_ENTRIES phía agent. */
export const AUDIT_STORE_MAX_ENTRIES = 100;
/** Gộp các lượt đọc gần nhau (nhiều tab, poll 3 giây) để tiết kiệm hạn mức gói miễn phí. */
export const AUDIT_STORE_CACHE_MS = 2_000;

export type AuditStoreConfig = { url: string; token: string; key: string };

type Env = Record<string, string | undefined>;

const clean = (v: string | undefined): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

/**
 * Nhận cả tên biến Vercel Marketplace (`KV_REST_API_*`) lẫn tên Upstash (`UPSTASH_REDIS_REST_*`).
 * Ưu tiên token chỉ-đọc vì Dashboard không cần ghi.
 */
export function resolveAuditStoreConfig(env: Env = process.env): AuditStoreConfig | null {
  const url = clean(env.KV_REST_API_URL) ?? clean(env.UPSTASH_REDIS_REST_URL);
  const token =
    clean(env.KV_REST_API_READ_ONLY_TOKEN) ?? clean(env.KV_REST_API_TOKEN) ?? clean(env.UPSTASH_REDIS_REST_TOKEN);
  if (!url || !token) return null;
  return {
    url: url.replace(/\/+$/, ""),
    token,
    key: clean(env.AUDIT_SYNC_KEY) ?? DEFAULT_AUDIT_SYNC_KEY,
  };
}

/** Lấy tối đa 100 bản ghi mới nhất (LRANGE), bỏ qua dòng hỏng; ném lỗi khi Upstash không trả 200. */
export async function readSyncedAudit(
  config: AuditStoreConfig,
  fetchFn: typeof fetch = fetch,
): Promise<unknown[]> {
  const res = await fetchFn(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["LRANGE", config.key, "0", String(AUDIT_STORE_MAX_ENTRIES - 1)]),
    cache: "no-store",
    signal: AbortSignal.timeout(4_000),
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const body = (await res.json()) as { result?: unknown; error?: string };
  if (typeof body.error === "string") throw new Error(`Upstash: ${body.error}`);
  if (!Array.isArray(body.result)) return [];

  const out: unknown[] = [];
  for (const raw of body.result) {
    if (typeof raw !== "string") continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // Bỏ dòng hỏng, giữ các dòng còn lại.
    }
  }
  return out;
}

/** Bộ đệm rất ngắn theo instance để nhiều người xem cùng lúc chỉ tốn một lượt gọi Upstash. */
export function createCachedAuditReader(
  config: AuditStoreConfig,
  fetchFn: typeof fetch = fetch,
  ttlMs: number = AUDIT_STORE_CACHE_MS,
  now: () => number = Date.now,
) {
  let cached: { at: number; data: Promise<unknown[]> } | null = null;
  return async (): Promise<unknown[]> => {
    const t = now();
    if (cached && t - cached.at < ttlMs) return cached.data;
    const data = readSyncedAudit(config, fetchFn);
    cached = { at: t, data };
    try {
      return await data;
    } catch (err) {
      cached = null;
      throw err;
    }
  };
}
