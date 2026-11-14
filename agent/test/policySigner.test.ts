import { BaseError, ContractFunctionRevertedError } from "viem";
import { describe, expect, it } from "vitest";
import {
  agentPolicyAbi,
  extractEip3009AuthParams,
  formatPolicyRevertReason,
  PolicyOnChainRejectedError,
} from "../src/policySigner.ts";
import { RuleViolationError } from "../src/rules.ts";
import { unwrapKnownError } from "../src/run.ts";

describe("PolicySigner helpers & revert decoder", () => {
  it("1. Trích xuất chính xác các tham số EIP-3009 để gọi AgentPolicy.authorize", () => {
    const nonce = ("0x" + "ab".repeat(32)) as `0x${string}`;
    const parsed = extractEip3009AuthParams({
      from: "0x7D49667A308161DD4810E6DDBEE5CBd67F4328AC",
      to: "0x9D014376C3296db41770015AF074CF4D14c075E1",
      value: "1000",
      validAfter: 0,
      validBefore: 1800000000,
      nonce,
    });

    expect(parsed.payTo).toBe("0x9D014376C3296db41770015AF074CF4D14c075E1");
    expect(parsed.amount).toBe(1000n);
    expect(parsed.validAfter).toBe(0n);
    expect(parsed.validBefore).toBe(1800000000n);
    expect(parsed.nonce).toBe(nonce);
  });

  it("2. Ném lỗi khi tham số EIP-3009 không hợp lệ (sai địa chỉ to hoặc nonce)", () => {
    expect(() =>
      extractEip3009AuthParams({
        to: "invalid-address",
        value: "1000",
        validAfter: 0,
        validBefore: 1800000000,
        nonce: "0x" + "11".repeat(32),
      }),
    ).toThrow("Invalid EIP-3009");

    expect(() =>
      extractEip3009AuthParams({
        to: "0x9D014376C3296db41770015AF074CF4D14c075E1",
        value: "1000",
        validAfter: 0,
        validBefore: 1800000000,
        nonce: "0x1234",
      }),
    ).toThrow("Invalid bytes32 nonce");
  });

  it("3. Giải mã ContractFunctionRevertedError từ AgentPolicy ABI sang tiếng Việt", () => {
    const revertErr = new ContractFunctionRevertedError({
      abi: agentPolicyAbi,
      functionName: "authorize",
      data: "0x",
    });
    // Gán data mô phỏng lỗi ExceedsDailyCap(4000, 3000) đã decode bởi viem
    (revertErr as unknown as { data: unknown }).data = {
      errorName: "ExceedsDailyCap",
      args: [4000n, 3000n],
      abiItem: { type: "error", name: "ExceedsDailyCap", inputs: [] },
    };
    const wrapped = new BaseError("Simulation failed", { cause: revertErr });

    const decoded = formatPolicyRevertReason(wrapped);
    expect(decoded.errorName).toBe("ExceedsDailyCap");
    expect(decoded.reason).toContain("Vượt hạn mức chi tiêu trong chu kỳ");
    expect(decoded.reason).toContain("0.004 USDC");
    expect(decoded.reason).toContain("0.003 USDC");
  });

  it("4. Giải mã các lỗi Sandbox & Kill Switch sang tiếng Việt rõ ràng", () => {
    const sandboxDetail = formatPolicyRevertReason(
      new Error("Execution reverted: ExceedsSandboxPerTxCap(1000, 500)"),
    );
    expect(sandboxDetail.errorName).toBe("ExceedsSandboxPerTxCap");
    expect(sandboxDetail.reason).toContain("Sandbox");

    const pausedDetail = formatPolicyRevertReason(new Error("reverted with PausedError()"));
    expect(pausedDetail.errorName).toBe("PausedError");
    expect(pausedDetail.reason).toContain("Kill Switch");

    const rejected = new PolicyOnChainRejectedError({
      errorName: "ExceedsPerTxCap",
      reason: "Vượt hạn mức mỗi giao dịch",
    });
    expect(formatPolicyRevertReason(rejected)).toEqual({
      errorName: "ExceedsPerTxCap",
      reason: "Vượt hạn mức mỗi giao dịch",
    });
  });

  it("5. Khôi phục được PolicyOnChainRejectedError và RuleViolationError khi @x402/fetch bọc lỗi không có cause", () => {
    const innerPolicyErr = new PolicyOnChainRejectedError({
      errorName: "ExceedsSandboxPerTxCap",
      reason: "Vượt trần Sandbox mỗi giao dịch",
    });
    const wrappedWithoutCause = new Error(
      `Failed to create payment payload: ${innerPolicyErr.message}`,
    );

    // Qua contextError
    const viaContext = unwrapKnownError(wrappedWithoutCause, innerPolicyErr);
    expect(viaContext).toBe(innerPolicyErr);

    // Qua fallback parse chuỗi message khi không có contextError
    const viaMessage = unwrapKnownError(wrappedWithoutCause);
    expect(viaMessage).toBeInstanceOf(PolicyOnChainRejectedError);
    expect((viaMessage as PolicyOnChainRejectedError).errorName).toBe("ExceedsSandboxPerTxCap");
    expect((viaMessage as PolicyOnChainRejectedError).reason).toContain("Vượt trần Sandbox");

    const innerRuleErr = new RuleViolationError("PRICE_MISMATCH", "Sai lệch bảng giá");
    const wrappedRule = new Error(`Failed to create payment payload: ${innerRuleErr.message}`);
    const recoveredRule = unwrapKnownError(wrappedRule);
    expect(recoveredRule).toBeInstanceOf(RuleViolationError);
    expect((recoveredRule as RuleViolationError).code).toBe("PRICE_MISMATCH");
  });
});
