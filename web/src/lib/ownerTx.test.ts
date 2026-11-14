import { ContractFunctionExecutionError, ContractFunctionRevertedError, encodeErrorResult, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { policyOwnerAbi } from "./abi";
import { describeTxError, isBusy, txReducer, type TxState } from "./ownerTx";

const HASH = ("0x" + "aa".repeat(32)) as Hex;

describe("txReducer", () => {
  it("đi đủ 3 bước: đang ký → đang chờ → xong", () => {
    let s: TxState = { phase: "idle" };
    s = txReducer(s, { type: "start", label: "Khóa khẩn cấp" });
    expect(s).toEqual({ phase: "signing", label: "Khóa khẩn cấp" });
    expect(isBusy(s)).toBe(true);
    s = txReducer(s, { type: "sent", hash: HASH });
    expect(s).toEqual({ phase: "pending", label: "Khóa khẩn cấp", hash: HASH });
    s = txReducer(s, { type: "confirmed" });
    expect(s).toEqual({ phase: "done", label: "Khóa khẩn cấp", hash: HASH });
    expect(isBusy(s)).toBe(false);
  });

  it("lỗi lúc ký thì không có hash; lỗi lúc chờ thì giữ hash để mở Snowscan", () => {
    const signing = txReducer({ phase: "idle" }, { type: "start", label: "x" });
    expect(txReducer(signing, { type: "failed", message: "hủy" })).toEqual({ phase: "error", label: "x", message: "hủy" });
    const pending = txReducer(signing, { type: "sent", hash: HASH });
    expect(txReducer(pending, { type: "failed", message: "revert" })).toEqual({
      phase: "error",
      label: "x",
      message: "revert",
      hash: HASH,
    });
  });

  it("bỏ qua sự kiện sai thứ tự", () => {
    const idle: TxState = { phase: "idle" };
    expect(txReducer(idle, { type: "sent", hash: HASH })).toBe(idle);
    expect(txReducer(idle, { type: "confirmed" })).toBe(idle);
    expect(txReducer(idle, { type: "failed", message: "x" })).toBe(idle);
    const done: TxState = { phase: "done", label: "x", hash: HASH };
    expect(txReducer(done, { type: "reset" })).toEqual({ phase: "idle" });
  });
});

function revert(errorName: "Unauthorized" | "PausedError" | "NotPausedError", functionName = "pause") {
  const cause = new ContractFunctionRevertedError({
    abi: policyOwnerAbi,
    data: encodeErrorResult({ abi: policyOwnerAbi, errorName }),
    functionName,
  });
  return new ContractFunctionExecutionError(cause, {
    abi: policyOwnerAbi,
    functionName,
    contractAddress: "0x2acc0af39b9892529c052d7192ac03664f079671",
  });
}

describe("describeTxError", () => {
  it("ví không phải chủ (Unauthorized)", () => {
    expect(describeTxError(revert("Unauthorized"))).toBe("Ví đang đăng nhập không phải chủ policy này.");
  });

  it("khóa khi đã khóa, mở khi đang mở", () => {
    expect(describeTxError(revert("PausedError"))).toBe("Policy đã ở trạng thái khóa.");
    expect(describeTxError(revert("NotPausedError", "unpause"))).toBe("Policy đang không khóa, không cần mở.");
  });

  it("người dùng hủy ký", () => {
    expect(describeTxError(Object.assign(new Error("User rejected the request."), { code: 4001 }))).toBe(
      "Bạn đã hủy, chưa ký giao dịch.",
    );
  });

  it("thiếu AVAX trả gas", () => {
    expect(describeTxError(new Error("insufficient funds for gas * price + value"))).toContain("không đủ AVAX");
  });

  it("lỗi lạ có câu chung", () => {
    expect(describeTxError("???")).toBe("Giao dịch thất bại. Mở console để xem chi tiết.");
  });
});
