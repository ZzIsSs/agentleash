/**
 * Gộp các lần agent bị chặn từ agent/logs/audit.json (agent/src/log.ts).
 * - REJECTED_OFFCHAIN: rule engine chặn trước khi gọi contract (không tốn gas).
 * - REJECTED_ONCHAIN: contract từ chối `authorize` (viem ước lượng gas thấy revert nên giao dịch không lên chuỗi).
 *   ruleCode lúc này là tên custom error của AgentPolicy.
 */

export type RejectionSource = "rule-engine" | "contract";

export type Rejection = {
  id: string;
  /** ms Unix, để sắp xếp và hiển thị. */
  time: number;
  source: RejectionSource;
  code: string;
  /** Câu ngắn tiếng Việt theo mã lỗi. */
  title: string;
  /** Chi tiết tiếng Việt do agent ghi (có số tiền, trần), có thể rỗng. */
  detail: string;
  api: string;
  payTo: string | null;
  amountUnits: bigint | null;
  /** Chế độ "agent bị chiếm": gọi thẳng contract, bỏ qua rule engine. */
  bypassRules: boolean;
};

export const REJECTION_TITLES: Record<string, string> = {
  // Rule engine (agent/src/rules.ts)
  UNREGISTERED_API: "API không có trong danh sách được phép",
  INVALID_PAY_TO: "Địa chỉ nhận tiền không khớp với API",
  PRICE_MISMATCH: "Giá API đòi khác bảng giá",
  RATE_LIMIT_EXCEEDED: "Gọi API quá nhanh, vượt giới hạn tần suất",
  DUPLICATE_QUERY: "Mua trùng dữ liệu vừa mua",
  LOOP_DETECTED: "Phát hiện vòng lặp gọi API bất thường",
  NOT_WHITELISTED: "API chưa nằm trong Whitelist (Tầng 1)",
  UNSAFE_URL: "URL không hợp lệ hoặc có rủi ro SSRF",
  HTTP_402_REFUSED: "Server từ chối thanh toán x402 (HTTP 402)",
  MISSING_TARGET: "Thiếu URL hoặc địa chỉ nhận thanh toán",
  INVALID_AMOUNT: "Số tiền yêu cầu không hợp lệ",
  // Contract (contracts/src/AgentPolicy.sol)
  ExceedsDailyCap: "Vượt hạn mức chung của chu kỳ",
  ExceedsPerTxCap: "Vượt trần mỗi giao dịch (Whitelist)",
  ExceedsSandboxPerTxCap: "Vượt trần Sandbox mỗi giao dịch (địa chỉ lạ)",
  ExceedsSandboxDailyCap: "Vượt hạn mức Sandbox của chu kỳ (địa chỉ lạ)",
  PausedError: "Policy đang bị khóa khẩn cấp",
  Unauthorized: "Ví gọi không phải ví agent của policy",
  InvalidTimeBounds: "Thời hạn thanh toán không hợp lệ",
  AlreadyApproved: "Khoản này đã được duyệt trước đó",
  ZeroAmount: "Số tiền bằng 0",
  TransactionReverted: "Giao dịch duyệt bị revert trên chuỗi",
};

type AuditLike = {
  id?: unknown;
  timestamp?: unknown;
  status?: unknown;
  api?: unknown;
  payTo?: unknown;
  amountUnits?: unknown;
  ruleCode?: unknown;
  reason?: unknown;
  bypassRules?: unknown;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

const units = (v: unknown): bigint | null => {
  if (typeof v !== "string" && typeof v !== "number") return null;
  try {
    return BigInt(v);
  } catch {
    return null;
  }
};

export type RejectionsResult = {
  items: Rejection[];
  /** Tổng số lượt bị chặn trong nhật ký trước khi cắt theo `limit`. */
  total: number;
};

/** Nhận nội dung audit.json (mảng, hoặc object có `entries`), trả về danh sách đã cắt theo `limit` cùng tổng số `total`. */
export function toRejectionsWithTotal(input: unknown, limit = 50): RejectionsResult {
  const list: unknown[] = Array.isArray(input)
    ? input
    : input && typeof input === "object" && Array.isArray((input as { entries?: unknown }).entries)
      ? (input as { entries: unknown[] }).entries
      : [];

  const out: Rejection[] = [];
  list.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return;
    const e = raw as AuditLike;
    const source: RejectionSource | null =
      e.status === "REJECTED_OFFCHAIN" ? "rule-engine" : e.status === "REJECTED_ONCHAIN" ? "contract" : null;
    if (!source) return;

    const time = Date.parse(str(e.timestamp) ?? "");
    const code = str(e.ruleCode) ?? "UNKNOWN";
    const detail = str(e.reason) ?? "";
    out.push({
      id: str(e.id) ?? `entry-${index}`,
      time: Number.isNaN(time) ? 0 : time,
      source,
      code,
      title: REJECTION_TITLES[code] ?? (detail || (source === "contract" ? "Contract từ chối" : "Rule engine chặn")),
      detail,
      api: str(e.api) ?? "không rõ",
      payTo: str(e.payTo),
      amountUnits: units(e.amountUnits),
      bypassRules: e.bypassRules === true,
    });
  });

  const sorted = out.sort((a, b) => b.time - a.time);
  return {
    items: sorted.slice(0, limit),
    total: sorted.length,
  };
}

/** Nhận nội dung audit.json (mảng, hoặc object có `entries`), trả về các lần bị chặn, mới nhất lên trên. */
export function toRejections(input: unknown, limit = 50): Rejection[] {
  return toRejectionsWithTotal(input, limit).items;
}

/** Dạng JSON gửi từ API route (bigint không qua được JSON). */
export type RejectionJson = Omit<Rejection, "amountUnits"> & { amountUnits: string | null };

export const rejectionToJson = (r: Rejection): RejectionJson => ({
  ...r,
  amountUnits: r.amountUnits === null ? null : r.amountUnits.toString(),
});

export const rejectionFromJson = (r: RejectionJson): Rejection => ({
  ...r,
  amountUnits: r.amountUnits === null ? null : BigInt(r.amountUnits),
});
