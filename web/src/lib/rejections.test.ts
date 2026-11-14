import { describe, expect, it } from "vitest";
import { rejectionFromJson, rejectionToJson, toRejections } from "./rejections";

// Rút gọn từ agent/logs/audit.json của demo 13/11.
const AUDIT = [
  {
    id: "a",
    timestamp: "2026-11-13T10:06:11.966Z",
    status: "REJECTED_ONCHAIN",
    api: "rogue_api",
    payTo: "0x1111111111111111111111111111111111111111",
    amountUnits: "1000",
    ruleCode: "ExceedsSandboxPerTxCap",
    reason: "Vượt trần Sandbox mỗi giao dịch (yêu cầu 0.001 USDC > trần 0.0005 USDC)",
    bypassRules: true,
  },
  { id: "b", timestamp: "2026-11-13T10:06:47.655Z", status: "SETTLED", api: "weather", amountUnits: "1000" },
  { id: "c", timestamp: "2026-11-13T10:07:00.000Z", status: "ALLOWED", api: "rates" },
  {
    id: "d",
    timestamp: "2026-11-13T13:43:59.510Z",
    status: "REJECTED_ONCHAIN",
    api: "rates",
    amountUnits: "1000",
    ruleCode: "ExceedsDailyCap",
    reason: "Vượt hạn mức chi tiêu trong chu kỳ (tổng yêu cầu 0.004 USDC > trần chu kỳ 0.003 USDC)",
    bypassRules: false,
  },
  {
    id: "e",
    timestamp: "2026-11-13T12:00:00.000Z",
    status: "REJECTED_OFFCHAIN",
    api: "weather",
    ruleCode: "PRICE_MISMATCH",
    reason: "Giá 0.002 USDC khác bảng giá 0.001 USDC",
  },
];

describe("toRejections", () => {
  it("chỉ lấy các lần bị chặn, mới nhất lên trên", () => {
    const r = toRejections(AUDIT);
    expect(r.map((x) => x.id)).toEqual(["d", "e", "a"]);
  });

  it("phân biệt nguồn chặn: rule engine hay contract", () => {
    const r = toRejections(AUDIT);
    expect(r.find((x) => x.id === "e")?.source).toBe("rule-engine");
    expect(r.find((x) => x.id === "d")?.source).toBe("contract");
  });

  it("gắn câu tiếng Việt theo mã lỗi, giữ chi tiết agent ghi", () => {
    const d = toRejections(AUDIT).find((x) => x.id === "d")!;
    expect(d.title).toBe("Vượt hạn mức chung của chu kỳ");
    expect(d.detail).toContain("0.004 USDC");
    expect(d.amountUnits).toBe(1000n);
  });

  it("đánh dấu chế độ agent bị chiếm (bỏ qua rule engine)", () => {
    const a = toRejections(AUDIT).find((x) => x.id === "a")!;
    expect(a.bypassRules).toBe(true);
    expect(a.title).toBe("Vượt trần Sandbox mỗi giao dịch (địa chỉ lạ)");
  });

  it("PausedError khi chủ đã bấm khóa", () => {
    const [p] = toRejections([
      { id: "p", timestamp: "2026-11-15T09:00:00Z", status: "REJECTED_ONCHAIN", api: "weather", ruleCode: "PausedError" },
    ]);
    expect(p.title).toBe("Policy đang bị khóa khẩn cấp");
    expect(p.detail).toBe("");
  });

  it("mã lạ thì dùng lý do agent ghi; không có lý do thì câu chung", () => {
    const r = toRejections([
      { id: "x", timestamp: "2026-11-15T09:00:00Z", status: "REJECTED_ONCHAIN", ruleCode: "Weird", reason: "Lý do gốc" },
      { id: "y", timestamp: "2026-11-15T08:00:00Z", status: "REJECTED_OFFCHAIN" },
    ]);
    expect(r[0].title).toBe("Lý do gốc");
    expect(r[1].title).toBe("Rule engine chặn");
    expect(r[1].code).toBe("UNKNOWN");
  });

  it("chịu được file hỏng hoặc rỗng", () => {
    expect(toRejections(null)).toEqual([]);
    expect(toRejections({})).toEqual([]);
    expect(toRejections([null, 1, "x", { status: "REJECTED_ONCHAIN", amountUnits: "abc" }])).toHaveLength(1);
    expect(toRejections({ entries: AUDIT })).toHaveLength(3);
  });

  it("giới hạn số dòng", () => {
    expect(toRejections(AUDIT, 2)).toHaveLength(2);
  });

  it("đi qua JSON của API route không mất số tiền", () => {
    const [d] = toRejections(AUDIT);
    const back = rejectionFromJson(JSON.parse(JSON.stringify(rejectionToJson(d))));
    expect(back).toEqual(d);
  });
});
