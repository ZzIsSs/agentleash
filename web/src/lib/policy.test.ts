import { describe, expect, it } from "vitest";
import { deriveOverview, formatCountdown, formatPeriod, formatUsdc, type PolicyRaw } from "./policy";

// Caps của policy demo 0x2acc…9671: setCaps(2000, 3000, 500, 1000), chu kỳ 120s.
const base: PolicyRaw = {
  owner: "0xd30CcDd472372f92f9DeDFaafDeD9615136b75CB",
  agent: "0x0000000000000000000000000000000000000001",
  paused: false,
  period: 120n,
  perTxCap: 2000n,
  dailyCap: 3000n,
  sandboxPerTxCap: 500n,
  sandboxDailyCap: 1000n,
  remainingDaily: 3000n,
  remainingSandboxDaily: 1000n,
  currentPeriodStart: 1_000n,
  balance: 7000n,
  blockNumber: 1n,
};

describe("deriveOverview", () => {
  it("chu kỳ mới: còn đủ cả hai tầng", () => {
    const o = deriveOverview(base, 1_000);
    expect(o.status).toBe("active");
    expect(o.trusted).toMatchObject({ cap: 3000n, spent: 0n, remaining: 3000n, usedRatio: 0 });
    expect(o.sandbox).toMatchObject({ cap: 1000n, spent: 0n, remaining: 1000n, usedRatio: 0 });
    expect(o.spendableNow).toBe(3000n);
    expect(o.secondsToReset).toBe(120);
  });

  it("đã chi 3 lần x 1000 ở whitelist: tầng 1 hết, sandbox cũng hết theo trần chung", () => {
    const o = deriveOverview({ ...base, remainingDaily: 0n }, 1_036);
    expect(o.trusted).toMatchObject({ spent: 3000n, remaining: 0n, usedRatio: 1 });
    // sandboxSpent vẫn 0 nhưng không chi thêm được vì dailyCap là trần chung.
    expect(o.sandbox).toMatchObject({ spent: 0n, remaining: 0n, usedRatio: 1 });
    expect(o.spendableNow).toBe(0n);
    expect(o.secondsToReset).toBe(84);
  });

  it("chi Sandbox tính vào cả hai tầng", () => {
    const o = deriveOverview({ ...base, remainingDaily: 2500n, remainingSandboxDaily: 500n }, 1_000);
    expect(o.trusted.spent).toBe(500n);
    expect(o.sandbox).toMatchObject({ spent: 500n, remaining: 500n, usedRatio: 0.5 });
  });

  it("chung còn ít hơn sandbox còn: sandbox bị giới hạn bởi chung", () => {
    const o = deriveOverview({ ...base, remainingDaily: 200n, remainingSandboxDaily: 1000n }, 1_000);
    expect(o.sandbox.remaining).toBe(200n);
    expect(o.sandbox.usedRatio).toBe(0.8);
  });

  it("số dư ít hơn hạn mức: chi được ngay bị giới hạn bởi số dư", () => {
    expect(deriveOverview({ ...base, balance: 1200n }, 1_000).spendableNow).toBe(1200n);
  });

  it("paused: trạng thái khóa và không chi được gì", () => {
    const o = deriveOverview({ ...base, paused: true }, 1_000);
    expect(o.status).toBe("paused");
    expect(o.spendableNow).toBe(0n);
  });

  it("đếm ngược không âm khi chu kỳ đã hết, không vượt độ dài chu kỳ khi đồng hồ máy chậm", () => {
    expect(deriveOverview(base, 5_000).secondsToReset).toBe(0);
    expect(deriveOverview(base, 900).secondsToReset).toBe(120);
  });

  it("dailyCap = 0 không chia cho 0", () => {
    const o = deriveOverview({ ...base, dailyCap: 0n, remainingDaily: 0n, sandboxDailyCap: 0n, remainingSandboxDaily: 0n }, 1_000);
    expect(o.trusted.usedRatio).toBe(0);
    expect(o.sandbox.usedRatio).toBe(0);
  });
});

describe("định dạng", () => {
  it("USDC 6 chữ số thập phân", () => {
    expect(formatUsdc(2000n)).toBe("0.002");
    expect(formatUsdc(7000n)).toBe("0.007");
    expect(formatUsdc(10_000n)).toBe("0.01");
    expect(formatUsdc(0n)).toBe("0");
    expect(formatUsdc(1_500_000n)).toBe("1.5");
  });

  it("đếm ngược phút:giây", () => {
    expect(formatCountdown(84)).toBe("01:24");
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5)).toBe("00:00");
    expect(formatCountdown(119.7)).toBe("01:59");
  });

  it("độ dài chu kỳ", () => {
    expect(formatPeriod(120)).toBe("120 giây");
    expect(formatPeriod(86_400)).toBe("1 ngày");
    expect(formatPeriod(3_600)).toBe("1 giờ");
  });
});
