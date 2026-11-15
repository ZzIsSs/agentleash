import { describe, expect, it } from "vitest";
import { capsEqual, capsFromRaw, DEMO_CAPS_INPUT, parseUsdcInput, validateCaps } from "./caps";

describe("parseUsdcInput", () => {
  it("parse số USDC chuẩn (tối đa 6 chữ số thập phân)", () => {
    expect(parseUsdcInput("0.002")).toEqual({ ok: true, value: 2000n });
    expect(parseUsdcInput("0.0005")).toEqual({ ok: true, value: 500n });
    expect(parseUsdcInput("0.000001")).toEqual({ ok: true, value: 1n });
    expect(parseUsdcInput("1")).toEqual({ ok: true, value: 1_000_000n });
    expect(parseUsdcInput(" 1.50 ")).toEqual({ ok: true, value: 1_500_000n });
    expect(parseUsdcInput("0")).toEqual({ ok: true, value: 0n });
    expect(parseUsdcInput("0.000")).toEqual({ ok: true, value: 0n });
  });

  it("chặn chuỗi rỗng, dấu phẩy, số âm, chữ và dấu chấm lẻ", () => {
    expect(parseUsdcInput("")).toMatchObject({ ok: false });
    expect(parseUsdcInput("   ")).toMatchObject({ ok: false });
    expect(parseUsdcInput("0,002")).toEqual({
      ok: false,
      error: "Dùng dấu chấm (.) cho phần thập phân, ví dụ 0.002.",
    });
    expect(parseUsdcInput("-0.001")).toMatchObject({ ok: false });
    expect(parseUsdcInput("abc")).toMatchObject({ ok: false });
    expect(parseUsdcInput("1e-3")).toMatchObject({ ok: false });
    expect(parseUsdcInput(".5")).toMatchObject({ ok: false });
    expect(parseUsdcInput("1.")).toMatchObject({ ok: false });
    expect(parseUsdcInput("+0.002")).toMatchObject({ ok: false });
  });

  it("chặn quá 6 chữ số thập phân thay vì làm tròn âm thầm", () => {
    expect(parseUsdcInput("0.0000001")).toEqual({
      ok: false,
      error: "USDC chỉ hỗ trợ tối đa 6 chữ số thập phân (nhỏ nhất 0.000001).",
    });
    expect(parseUsdcInput("1.1234567")).toMatchObject({ ok: false });
  });
});

describe("validateCaps", () => {
  it("chấp nhận mặc định demo 0.002 / 0.003 / 0.0005 / 0.001", () => {
    const res = validateCaps(DEMO_CAPS_INPUT);
    expect(res).toEqual({
      ok: true,
      caps: {
        perTxCap: 2000n,
        dailyCap: 3000n,
        sandboxPerTxCap: 500n,
        sandboxDailyCap: 1000n,
      },
      fieldErrors: {},
      errors: [],
    });
  });

  it("chấp nhận biên bằng nhau và hạn mức bằng 0 (khóa Sandbox hoặc khóa toàn bộ)", () => {
    expect(
      validateCaps({
        perTxCap: "0.003",
        dailyCap: "0.003",
        sandboxPerTxCap: "0.003",
        sandboxDailyCap: "0.003",
      }),
    ).toMatchObject({
      ok: true,
      caps: { perTxCap: 3000n, dailyCap: 3000n, sandboxPerTxCap: 3000n, sandboxDailyCap: 3000n },
    });

    expect(
      validateCaps({
        perTxCap: "0.002",
        dailyCap: "0.003",
        sandboxPerTxCap: "0",
        sandboxDailyCap: "0",
      }),
    ).toMatchObject({
      ok: true,
      caps: { perTxCap: 2000n, dailyCap: 3000n, sandboxPerTxCap: 0n, sandboxDailyCap: 0n },
    });

    expect(
      validateCaps({
        perTxCap: "0",
        dailyCap: "0",
        sandboxPerTxCap: "0",
        sandboxDailyCap: "0",
      }),
    ).toMatchObject({ ok: true });
  });

  it("chặn perTxCap > dailyCap (khớp AgentPolicy.InvalidCaps)", () => {
    const res = validateCaps({
      perTxCap: "0.003001",
      dailyCap: "0.003",
      sandboxPerTxCap: "0.0005",
      sandboxDailyCap: "0.001",
    });
    expect(res.ok).toBe(false);
    expect(res.fieldErrors.perTxCap).toBe("Trần mỗi lần (Whitelist) phải ≤ trần chu kỳ chung.");
    expect(res.errors).toEqual(["Trần mỗi lần (Whitelist) phải ≤ trần chu kỳ chung."]);
  });

  it("chặn sandboxPerTxCap > sandboxDailyCap (khớp AgentPolicy.InvalidCaps)", () => {
    const res = validateCaps({
      perTxCap: "0.002",
      dailyCap: "0.003",
      sandboxPerTxCap: "0.001001",
      sandboxDailyCap: "0.001",
    });
    expect(res.ok).toBe(false);
    expect(res.fieldErrors.sandboxPerTxCap).toBe("Trần mỗi lần (Sandbox) phải ≤ trần chu kỳ Sandbox.");
  });

  it("chặn sandboxDailyCap > dailyCap (khớp AgentPolicy.InvalidCaps)", () => {
    const res = validateCaps({
      perTxCap: "0.002",
      dailyCap: "0.003",
      sandboxPerTxCap: "0.0005",
      sandboxDailyCap: "0.003001",
    });
    expect(res.ok).toBe(false);
    expect(res.fieldErrors.sandboxDailyCap).toBe("Trần chu kỳ Sandbox phải ≤ trần chu kỳ chung.");
  });

  it("gom nhiều lỗi cùng lúc khi cả format lẫn ràng buộc sai", () => {
    const formatErr = validateCaps({
      perTxCap: "",
      dailyCap: "0.003",
      sandboxPerTxCap: "abc",
      sandboxDailyCap: "0.001",
    });
    expect(formatErr.ok).toBe(false);
    expect(formatErr.fieldErrors.perTxCap).toBeTruthy();
    expect(formatErr.fieldErrors.sandboxPerTxCap).toBeTruthy();
    expect(formatErr.errors).toHaveLength(2);

    const multiConstraintErr = validateCaps({
      perTxCap: "0.004",
      dailyCap: "0.003",
      sandboxPerTxCap: "0.005",
      sandboxDailyCap: "0.004",
    });
    expect(multiConstraintErr.ok).toBe(false);
    expect(multiConstraintErr.errors).toHaveLength(3);
  });
});

describe("capsFromRaw & capsEqual", () => {
  it("chuyển từ bigint sang chuỗi USDC và so sánh 4 trường", () => {
    const raw = {
      perTxCap: 2000n,
      dailyCap: 3000n,
      sandboxPerTxCap: 500n,
      sandboxDailyCap: 1000n,
    };
    expect(capsFromRaw(raw)).toEqual(DEMO_CAPS_INPUT);
    expect(capsEqual(raw, { ...raw })).toBe(true);
    expect(capsEqual(raw, { ...raw, dailyCap: 4000n })).toBe(false);
  });
});
