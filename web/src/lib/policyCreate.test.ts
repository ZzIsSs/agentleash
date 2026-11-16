import { describe, expect, it } from "vitest";
import { buildPolicyOptions, resolveActivePolicy, validateCreatePolicyInput } from "./policyCreate";

const AGENT = "0x0f8de357042e53bf0e647066f0bb1a446133ef9d";
const POLICY_1 = "0x1111111111111111111111111111111111111111" as const;
const POLICY_2 = "0x2222222222222222222222222222222222222222" as const;
const DEMO = "0x62Ea5e422b3ef66174B6Dd6Aa855F1f036894177" as const;

describe("validateCreatePolicyInput", () => {
  it("chấp nhận địa chỉ EVM hợp lệ và chu kỳ trong ngưỡng", () => {
    const res = validateCreatePolicyInput({ agent: ` ${AGENT} `, periodSeconds: "120" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.parsed.agent).toBe("0x0F8de357042E53bF0E647066F0Bb1a446133ef9D");
      expect(res.parsed.periodSeconds).toBe(120n);
    }
  });

  it("từ chối địa chỉ 0, sai định dạng, hoặc chu kỳ ngoài ngưỡng", () => {
    const zero = validateCreatePolicyInput({ agent: "0x0000000000000000000000000000000000000000", periodSeconds: "10" });
    expect(zero.ok).toBe(false);
    if (!zero.ok) {
      expect(zero.fieldErrors.agent).toContain("0x000");
      expect(zero.fieldErrors.periodSeconds).toContain("30");
    }

    const bad = validateCreatePolicyInput({ agent: "not-an-address", periodSeconds: "12.5" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.fieldErrors.agent).toBeDefined();
      expect(bad.fieldErrors.periodSeconds).toBeDefined();
    }
  });
});

describe("buildPolicyOptions & resolveActivePolicy", () => {
  it("xếp policy mới nhất lên đầu, không lặp policy demo khi chủ sở hữu nó", () => {
    const opts = buildPolicyOptions([POLICY_1, DEMO], DEMO);
    expect(opts.map((o) => o.address)).toEqual([DEMO, POLICY_1]);
    expect(opts[0].isDemo).toBe(true);
    expect(opts[0].isOwned).toBe(true);
    expect(opts[1].isDemo).toBe(false);
  });

  it("thêm policy demo ở cuối nếu chủ chưa sở hữu policy demo", () => {
    const opts = buildPolicyOptions([POLICY_1, POLICY_2], DEMO);
    expect(opts.map((o) => o.address)).toEqual([POLICY_2, POLICY_1, DEMO]);
    expect(opts[2].isOwned).toBe(false);
  });

  it("resolveActivePolicy ưu tiên lựa chọn hợp lệ và fallback về policy mới nhất của chủ", () => {
    expect(resolveActivePolicy(POLICY_1, [POLICY_1, POLICY_2], DEMO)).toBe(POLICY_1);
    expect(resolveActivePolicy(null, [POLICY_1, POLICY_2], DEMO)).toBe(POLICY_2);
    expect(resolveActivePolicy(null, [], DEMO)).toBe(DEMO);
  });
});
