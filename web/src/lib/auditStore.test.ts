import { describe, expect, it, vi } from "vitest";
import {
  AUDIT_STORE_MAX_ENTRIES,
  DEFAULT_AUDIT_SYNC_KEY,
  createCachedAuditReader,
  readSyncedAudit,
  resolveAuditStoreConfig,
  type AuditStoreConfig,
} from "./auditStore";
import { toRejectionsWithTotal } from "./rejections";

const CONFIG: AuditStoreConfig = {
  url: "https://example-redis.upstash.io",
  token: "read-only-token",
  key: DEFAULT_AUDIT_SYNC_KEY,
};

const SYNCED = {
  id: "r-1",
  timestamp: "2026-11-18T15:00:00.000Z",
  status: "REJECTED_ONCHAIN",
  api: "smoke-unknown",
  payTo: "0x1111111111111111111111111111111111111111",
  amountUnits: "1000",
  ruleCode: "ExceedsSandboxPerTxCap",
  reason: "Vượt trần Sandbox",
  bypassRules: false,
};

const lrangeResponse = (result: unknown) =>
  vi.fn(async () => new Response(JSON.stringify({ result }), { status: 200 }));

describe("auditStore — đọc mục Bị từ chối từ Upstash cho bản Vercel", () => {
  it("không có biến thì trả null (route giữ cách đọc file như local)", () => {
    expect(resolveAuditStoreConfig({})).toBeNull();
    expect(resolveAuditStoreConfig({ KV_REST_API_URL: "https://kv.upstash.io" })).toBeNull();
  });

  it("ưu tiên token chỉ-đọc của Vercel Marketplace, vẫn nhận tên biến Upstash", () => {
    expect(
      resolveAuditStoreConfig({
        KV_REST_API_URL: "https://kv.upstash.io/",
        KV_REST_API_TOKEN: "write",
        KV_REST_API_READ_ONLY_TOKEN: "read",
      }),
    ).toEqual({ url: "https://kv.upstash.io", token: "read", key: DEFAULT_AUDIT_SYNC_KEY });

    expect(
      resolveAuditStoreConfig({
        UPSTASH_REDIS_REST_URL: "https://a.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "t",
        AUDIT_SYNC_KEY: "k",
      }),
    ).toEqual({ url: "https://a.upstash.io", token: "t", key: "k" });
  });

  it("gọi LRANGE đúng khóa kèm Bearer, bỏ dòng hỏng, rồi dựng được danh sách Bị từ chối", async () => {
    const fetchFn = lrangeResponse([
      JSON.stringify(SYNCED),
      "{hỏng",
      42,
      JSON.stringify({ ...SYNCED, id: "r-2", status: "REJECTED_OFFCHAIN", ruleCode: "NOT_WHITELISTED" }),
    ]);
    const entries = await readSyncedAudit(CONFIG, fetchFn as unknown as typeof fetch);

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example-redis.upstash.io");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer read-only-token");
    expect(JSON.parse(init.body as string)).toEqual([
      "LRANGE",
      DEFAULT_AUDIT_SYNC_KEY,
      "0",
      String(AUDIT_STORE_MAX_ENTRIES - 1),
    ]);
    expect(entries).toHaveLength(2);

    const { items, total } = toRejectionsWithTotal(entries);
    expect(total).toBe(2);
    expect(items.map((r) => r.code).sort()).toEqual(["ExceedsSandboxPerTxCap", "NOT_WHITELISTED"]);
    expect(items.find((r) => r.id === "r-1")?.source).toBe("contract");
    expect(items.find((r) => r.id === "r-1")?.amountUnits).toBe(1000n);
  });

  it("danh sách trống khi khóa chưa có dữ liệu; ném lỗi khi Upstash trả lỗi để route báo 503", async () => {
    await expect(readSyncedAudit(CONFIG, lrangeResponse(null) as unknown as typeof fetch)).resolves.toEqual([]);
    await expect(
      readSyncedAudit(CONFIG, vi.fn(async () => new Response("x", { status: 401 })) as unknown as typeof fetch),
    ).rejects.toThrow(/401/);
    await expect(
      readSyncedAudit(
        CONFIG,
        vi.fn(async () => new Response(JSON.stringify({ error: "WRONGPASS" }), { status: 200 })) as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/WRONGPASS/);
  });

  it("bộ đệm ngắn gộp các lượt đọc gần nhau, hết hạn thì đọc lại, lỗi thì không giữ trong bộ đệm", async () => {
    let t = 0;
    const fetchFn = lrangeResponse([JSON.stringify(SYNCED)]);
    const read = createCachedAuditReader(CONFIG, fetchFn as unknown as typeof fetch, 2_000, () => t);

    await read();
    t = 1_500;
    await read();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    t = 2_500;
    await read();
    expect(fetchFn).toHaveBeenCalledTimes(2);

    const failing = vi
      .fn()
      .mockResolvedValueOnce(new Response("x", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: [] }), { status: 200 }));
    const readFailing = createCachedAuditReader(CONFIG, failing as unknown as typeof fetch, 2_000, () => 0);
    await expect(readFailing()).rejects.toThrow(/500/);
    await expect(readFailing()).resolves.toEqual([]);
    expect(failing).toHaveBeenCalledTimes(2);
  });
});
