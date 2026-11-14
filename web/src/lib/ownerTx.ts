import { BaseError, ContractFunctionRevertedError, type Hex } from "viem";

/**
 * Trạng thái một lệnh chủ ký (pause, unpause, setWhitelist, createPolicy):
 * idle → signing (chờ ví ký) → pending (đã gửi, chờ xác nhận) → done | error.
 */
export type TxState =
  | { phase: "idle" }
  | { phase: "signing"; label: string }
  | { phase: "pending"; label: string; hash: Hex }
  | { phase: "done"; label: string; hash: Hex }
  | { phase: "error"; label: string; message: string; hash?: Hex };

export type TxEvent =
  | { type: "start"; label: string }
  | { type: "sent"; hash: Hex }
  | { type: "confirmed" }
  | { type: "failed"; message: string }
  | { type: "reset" };

export function txReducer(state: TxState, event: TxEvent): TxState {
  switch (event.type) {
    case "start":
      return { phase: "signing", label: event.label };
    case "sent":
      return state.phase === "signing" ? { phase: "pending", label: state.label, hash: event.hash } : state;
    case "confirmed":
      return state.phase === "pending" ? { phase: "done", label: state.label, hash: state.hash } : state;
    case "failed":
      if (state.phase === "signing") return { phase: "error", label: state.label, message: event.message };
      if (state.phase === "pending")
        return { phase: "error", label: state.label, message: event.message, hash: state.hash };
      return state;
    case "reset":
      return { phase: "idle" };
  }
}

export const isBusy = (s: TxState) => s.phase === "signing" || s.phase === "pending";

const OWNER_ERRORS: Record<string, string> = {
  Unauthorized: "Ví đang đăng nhập không phải chủ policy này.",
  PausedError: "Policy đã ở trạng thái khóa.",
  NotPausedError: "Policy đang không khóa, không cần mở.",
  ZeroAddress: "Địa chỉ không hợp lệ (0x0).",
  InvalidCaps:
    "Hạn mức không hợp lệ: trần mỗi lần phải ≤ trần chu kỳ (cả hai tầng), và trần Sandbox chu kỳ phải ≤ trần chung.",
  InvalidPeriod: "Chu kỳ phải lớn hơn 0 giây.",
};

/** Lỗi giao dịch → một câu tiếng Việt cho người dùng. */
export function describeTxError(err: unknown): string {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name && OWNER_ERRORS[name]) return OWNER_ERRORS[name];
      if (name) return `Contract từ chối: ${name}.`;
      return "Contract từ chối giao dịch.";
    }
  }

  const text = (err instanceof Error ? `${err.message} ${(err as { details?: string }).details ?? ""}` : String(err))
    .toLowerCase();
  const code = (err as { code?: unknown })?.code;

  if (code === 4001 || text.includes("user rejected") || text.includes("user denied") || text.includes("rejected the request"))
    return "Bạn đã hủy, chưa ký giao dịch.";
  if (text.includes("insufficient funds") || text.includes("exceeds the balance"))
    return "Ví chủ không đủ AVAX test để trả gas. Lấy ở faucet Fuji rồi thử lại.";
  if (text.includes("timeout") || text.includes("timed out"))
    return "Quá lâu chưa thấy xác nhận. Kiểm tra lại trên Snowscan.";
  if (text.includes("network") || text.includes("fetch failed") || text.includes("failed to fetch"))
    return "Mất kết nối tới Fuji RPC. Thử lại sau vài giây.";
  return "Giao dịch thất bại. Mở console để xem chi tiết.";
}
