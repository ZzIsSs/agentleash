import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUDIT_SYNC_MAX_ENTRIES,
  DEFAULT_AUDIT_SYNC_KEY,
  flushAuditSync,
  pushAuditEntry,
  queueAuditSync,
  resolveAuditSyncConfig,
  toSyncedRejection,
  type AuditSyncConfig,
} from "../src/auditSync.ts";
import type { AuditLogEntry } from "../src/log.ts";

const CONFIG: AuditSyncConfig = {
  url: "https://example-redis.upstash.io",
  token: "test-token",
  key: DEFAULT_AUDIT_SYNC_KEY,
};

const REJECTED: AuditLogEntry = {
  id: "r-1",
  timestamp: "2026-11-18T15:00:00.000Z",
  status: "REJECTED_ONCHAIN",
  api: "smoke-unknown",
  endpoint: "onchain-simulation://0x1111111111111111111111111111111111111111",
  query: "truy vấn riêng của người dùng",
  payTo: "0x1111111111111111111111111111111111111111",
  amountUnits: "1000",
  amountUsdc: "0.001",
  ruleCode: "ExceedsSandboxPerTxCap",
  reason: "Vượt trần Sandbox",
  bypassRules: false,
};

const okFetch = () =>
  vi.fn(async () => new Response(JSON.stringify([{ result: 1 }, { result: "OK" }]), { status: 200 }));

describe("auditSync — đồng bộ mục Bị từ chối lên Upstash", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("chỉ bật khi đủ URL + token, nhận cả tên Upstash lẫn tên Vercel KV, bỏ qua khi chạy vitest", () => {
    expect(resolveAuditSyncConfig({})).toBeNull();
    expect(resolveAuditSyncConfig({ UPSTASH_REDIS_REST_URL: "https://a.upstash.io" })).toBeNull();
    expect(
      resolveAuditSyncConfig({ VITEST: "true", UPSTASH_REDIS_REST_URL: "https://a.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" }),
    ).toBeNull();

    expect(
      resolveAuditSyncConfig({ UPSTASH_REDIS_REST_URL: "https://a.upstash.io/", UPSTASH_REDIS_REST_TOKEN: " t1 " }),
    ).toEqual({ url: "https://a.upstash.io", token: "t1", key: DEFAULT_AUDIT_SYNC_KEY });

    expect(
      resolveAuditSyncConfig({ KV_REST_API_URL: "https://kv.upstash.io", KV_REST_API_TOKEN: "t2", AUDIT_SYNC_KEY: "k" }),
    ).toEqual({ url: "https://kv.upstash.io", token: "t2", key: "k" });
  });

  it("chỉ rút gọn lượt bị chặn và không mang query / endpoint lên cloud (Luật 5)", () => {
    expect(toSyncedRejection({ ...REJECTED, status: "ALLOWED" })).toBeNull();
    expect(toSyncedRejection({ ...REJECTED, status: "SETTLED" })).toBeNull();

    const synced = toSyncedRejection(REJECTED);
    expect(synced).toEqual({
      id: "r-1",
      timestamp: "2026-11-18T15:00:00.000Z",
      status: "REJECTED_ONCHAIN",
      api: "smoke-unknown",
      payTo: "0x1111111111111111111111111111111111111111",
      amountUnits: "1000",
      ruleCode: "ExceedsSandboxPerTxCap",
      reason: "Vượt trần Sandbox",
      bypassRules: false,
    });
    expect(synced).not.toHaveProperty("query");
    expect(synced).not.toHaveProperty("endpoint");
  });

  it("đẩy LPUSH + LTRIM qua pipeline REST kèm Bearer token", async () => {
    const fetchFn = okFetch();
    await expect(pushAuditEntry(REJECTED, CONFIG, fetchFn as unknown as typeof fetch)).resolves.toBe(true);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example-redis.upstash.io/pipeline");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    const body = JSON.parse(init.body as string) as string[][];
    expect(body[0][0]).toBe("LPUSH");
    expect(body[0][1]).toBe(DEFAULT_AUDIT_SYNC_KEY);
    expect(JSON.parse(body[0][2])).toMatchObject({ id: "r-1", ruleCode: "ExceedsSandboxPerTxCap" });
    expect(body[1]).toEqual(["LTRIM", DEFAULT_AUDIT_SYNC_KEY, "0", String(AUDIT_SYNC_MAX_ENTRIES - 1)]);
  });

  it("không gọi mạng với lượt được duyệt, và nuốt mọi lỗi mạng / HTTP / Upstash (chỉ ghi stderr)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const neverCalled = okFetch();
    await expect(
      pushAuditEntry({ ...REJECTED, status: "ALLOWED" }, CONFIG, neverCalled as unknown as typeof fetch),
    ).resolves.toBe(false);
    expect(neverCalled).not.toHaveBeenCalled();

    const http500 = vi.fn(async () => new Response("boom", { status: 500 }));
    await expect(pushAuditEntry(REJECTED, CONFIG, http500 as unknown as typeof fetch)).resolves.toBe(false);

    const offline = vi.fn(async () => {
      throw new Error("ENOTFOUND");
    });
    await expect(pushAuditEntry(REJECTED, CONFIG, offline as unknown as typeof fetch)).resolves.toBe(false);

    const redisError = vi.fn(
      async () => new Response(JSON.stringify([{ error: "WRONGTYPE" }, { result: "OK" }]), { status: 200 }),
    );
    await expect(pushAuditEntry(REJECTED, CONFIG, redisError as unknown as typeof fetch)).resolves.toBe(false);

    expect(errSpy).toHaveBeenCalledTimes(3);
    for (const call of errSpy.mock.calls) {
      expect(String(call[0])).not.toContain("test-token");
    }
  });

  it("queueAuditSync chạy nền và flushAuditSync chờ xong; không có cấu hình thì không làm gì", async () => {
    const fetchFn = okFetch();
    queueAuditSync(REJECTED, null, fetchFn as unknown as typeof fetch);
    await flushAuditSync();
    expect(fetchFn).not.toHaveBeenCalled();

    queueAuditSync(REJECTED, CONFIG, fetchFn as unknown as typeof fetch);
    queueAuditSync({ ...REJECTED, id: "r-2", status: "REJECTED_OFFCHAIN", ruleCode: "NOT_WHITELISTED" }, CONFIG, fetchFn as unknown as typeof fetch);
    await flushAuditSync();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
