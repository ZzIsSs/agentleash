import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  RuleEngine,
  RuleViolationError,
  getDefaultApiCatalog,
} from "../src/rules.ts";
import { readAuditLogs } from "../src/log.ts";

const WEATHER_PAY_TO = "0x9D014376C3296db41770015AF074CF4D14c075E1";
const RATES_PAY_TO = "0x8D299966B407e9f189C1920f5A7324F13a9a4110";

describe("RuleEngine & AuditLog", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir && existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  function createTempLogPath(): string {
    const dir = mkdtempSync(path.join(os.tmpdir(), "agentleash-test-"));
    tempDirs.push(dir);
    return path.join(dir, "audit.json");
  }

  it("1. Cho phép gọi API hợp lệ khi khớp catalog, payTo (không phân biệt hoa/thường) và giá 0.001 USDC", () => {
    const engine = new RuleEngine({ auditLogPath: null });

    expect(engine.validatePreRequest("weather", "Da Lat")).toEqual({ ok: true });
    expect(
      engine.validatePaymentRequirements("weather", WEATHER_PAY_TO.toLowerCase(), "1000"),
    ).toEqual({ ok: true });

    expect(engine.validatePreRequest("rates", "USD/VND")).toEqual({ ok: true });
    expect(
      engine.validatePaymentRequirements("rates", RATES_PAY_TO, 1000n),
    ).toEqual({ ok: true });
  });

  it("2. Chặn API chưa được đăng ký trong danh mục (UNREGISTERED_API)", () => {
    const engine = new RuleEngine({ auditLogPath: null });

    const preRes = engine.validatePreRequest("rogue_news_api", "breaking");
    expect(preRes.ok).toBe(false);
    expect(preRes.code).toBe("UNREGISTERED_API");
    expect(preRes.reason).toContain("chưa được đăng ký");

    const payRes = engine.validatePaymentRequirements("rogue_news_api", WEATHER_PAY_TO, "1000");
    expect(payRes.ok).toBe(false);
    expect(payRes.code).toBe("UNREGISTERED_API");
  });

  it("3. Chặn khi địa chỉ người nhận (payTo) không hợp lệ hoặc sai API (INVALID_PAY_TO)", () => {
    const engine = new RuleEngine({ auditLogPath: null });

    // Địa chỉ kẻ tấn công
    const rogueAddr = "0x1111111111111111111111111111111111111111";
    const res1 = engine.validatePaymentRequirements("weather", rogueAddr, "1000");
    expect(res1.ok).toBe(false);
    expect(res1.code).toBe("INVALID_PAY_TO");
    expect(res1.reason?.toLowerCase()).toContain("địa chỉ người nhận không hợp lệ");

    // Địa chỉ của rates gán nhầm cho weather
    const res2 = engine.validatePaymentRequirements("weather", RATES_PAY_TO, "1000");
    expect(res2.ok).toBe(false);
    expect(res2.code).toBe("INVALID_PAY_TO");

    // Địa chỉ không đúng định dạng EVM
    const res3 = engine.validatePaymentRequirements("rates", "not-an-address", "1000");
    expect(res3.ok).toBe(false);
    expect(res3.code).toBe("INVALID_PAY_TO");
  });

  it("4. Chặn khi giá trong phản hồi 402 lệch bảng giá niêm yết 0.001 USDC (PRICE_MISMATCH)", () => {
    const engine = new RuleEngine({ auditLogPath: null });

    // Tăng giá gấp đôi (0.002 USDC)
    const highRes = engine.validatePaymentRequirements("weather", WEATHER_PAY_TO, "2000");
    expect(highRes.ok).toBe(false);
    expect(highRes.code).toBe("PRICE_MISMATCH");
    expect(highRes.reason?.toLowerCase()).toContain("sai lệch bảng giá");

    // Giá = 0 hoặc sai định dạng
    const zeroRes = engine.validatePaymentRequirements("rates", RATES_PAY_TO, "0");
    expect(zeroRes.ok).toBe(false);
    expect(zeroRes.code).toBe("PRICE_MISMATCH");

    const nanRes = engine.validatePaymentRequirements("rates", RATES_PAY_TO, "abc");
    expect(nanRes.ok).toBe(false);
    expect(nanRes.code).toBe("PRICE_MISMATCH");
  });

  it("5. Giới hạn tần suất tối đa 5 lần/phút mỗi API và tự mở lại sau 60s (RATE_LIMIT_EXCEEDED)", () => {
    let now = 1_700_000_000_000;
    const engine = new RuleEngine({
      maxRequestsPerMinute: 5,
      rateWindowMs: 60_000,
      dedupWindowMs: 60_000,
      nowFn: () => now,
      auditLogPath: null,
    });

    // 5 lần gọi khác query cho weather trong vòng 10 giây -> đều hợp lệ
    for (let i = 1; i <= 5; i++) {
      const check = engine.validatePreRequest("weather", `City ${i}`);
      expect(check.ok).toBe(true);
      engine.recordExecution("weather", `City ${i}`);
      now += 1_000;
    }

    // Lần thứ 6 ở giây thứ 6 -> bị chặn vì vượt tần suất 5 lần/phút
    const blocked = engine.validatePreRequest("weather", "City 6");
    expect(blocked.ok).toBe(false);
    expect(blocked.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(blocked.reason?.toLowerCase()).toContain("vượt tần suất gọi");

    // API rates vẫn độc lập và gọi được bình thường
    expect(engine.validatePreRequest("rates", "USD/VND").ok).toBe(true);

    // Tua thời gian qua cửa sổ 60s tính từ lần gọi đầu tiên -> lại được phép gọi
    now += 56_000;
    expect(engine.validatePreRequest("weather", "City 6").ok).toBe(true);
  });

  it("6. Chống spam: chặn truy vấn trùng lặp trong 60s (chuẩn hóa hoa/thường & khoảng trắng) và mở lại sau 60s", () => {
    let now = 1_700_000_000_000;
    const engine = new RuleEngine({
      dedupWindowMs: 60_000,
      nowFn: () => now,
      auditLogPath: null,
    });

    expect(engine.validatePreRequest("weather", "Da Lat").ok).toBe(true);
    engine.recordExecution("weather", "Da Lat");

    // Sau 15 giây gọi lại "  da   lat  " -> bị chặn do trùng lặp
    now += 15_000;
    const dup = engine.validatePreRequest("weather", "  da   lat  ");
    expect(dup.ok).toBe(false);
    expect(dup.code).toBe("DUPLICATE_QUERY");
    expect(dup.reason?.toLowerCase()).toContain("trùng lặp");

    // Sau khi đủ 60s từ lần đầu -> cho phép mua lại
    now += 45_000;
    expect(engine.validatePreRequest("weather", "Da Lat").ok).toBe(true);
  });

  it("7. enforce* ném RuleViolationError và ghi Audit Log JSON đầy đủ cho Dashboard đọc", () => {
    const logPath = createTempLogPath();
    const engine = new RuleEngine({
      catalog: getDefaultApiCatalog(),
      auditLogPath: logPath,
    });

    // Vi phạm 1: Sai giá
    expect(() =>
      engine.enforcePaymentRequirements(
        "weather",
        "Da Lat",
        WEATHER_PAY_TO,
        "9000",
        "http://localhost:4021/api/weather?city=Da%20Lat",
      ),
    ).toThrow(RuleViolationError);

    // Vi phạm 2: API chưa đăng ký
    expect(() => engine.enforcePreRequest("unknown", "test")).toThrow(RuleViolationError);

    const logs = readAuditLogs(logPath);
    expect(logs).toHaveLength(2);
    expect(logs[0].status).toBe("REJECTED_OFFCHAIN");
    expect(logs[0].ruleCode).toBe("PRICE_MISMATCH");
    expect(logs[0].amountUnits).toBe("9000");
    expect(logs[0].amountUsdc).toBe("0.009");
    expect(logs[0].reason).toContain("Sai lệch bảng giá");

    expect(logs[1].status).toBe("REJECTED_OFFCHAIN");
    expect(logs[1].ruleCode).toBe("UNREGISTERED_API");
  });
});
