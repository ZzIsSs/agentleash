import { describe, expect, it } from "vitest";
import { buildDemoCliCommand, sanitizeCliSummary } from "./demoRun";

describe("demoRun helpers", () => {
  it("sinh lệnh CLI đúng chế độ rule engine hoặc bypass", () => {
    expect(buildDemoCliCommand(false)).toBe("cd agent && npm run demo:mock");
    expect(buildDemoCliCommand(true)).toBe("cd agent && npm run demo:bypass");
    expect(buildDemoCliCommand(true, "0x62Ea5e422b3ef66174B6Dd6Aa855F1f036894177")).toContain(
      "AGENT_POLICY_ADDRESS=0x62Ea5e422b3ef66174B6Dd6Aa855F1f036894177",
    );
  });

  it("sanitizeCliSummary trích đúng số lượng thành công, bị chặn và tx hash", () => {
    const sample = `
[PolicySigner] Authorized on-chain in block 123 (tx: 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa)
[SUCCESS 200 OK] Nhận dữ liệu từ weather. Snowtrace: https://testnet.snowtrace.io/tx/0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
[BLOCKED ON-CHAIN] ExceedsSandboxPerTxCap: Vượt trần Sandbox
Tổng lượt LLM: 2 | Tổng tool calls: 4 | Thành công: 3 | Bị chặn/lỗi: 1
USDC Balance    : 0.051 USDC | Paused: false
`;
    const summary = sanitizeCliSummary(sample);
    expect(summary.successCount).toBe(3);
    expect(summary.blockedCount).toBe(1);
    expect(summary.txHashes).toHaveLength(2);
    expect(summary.blockedLines).toEqual(["[BLOCKED ON-CHAIN] ExceedsSandboxPerTxCap: Vượt trần Sandbox"]);
    expect(summary.balanceUsdc).toBe("0.051");
    expect(summary.paused).toBe(false);
  });

  it("suy ra successCount = 0 và blockedCount = 1 cho kịch bản --rogue-pay-to không in dòng tổng hợp", () => {
    const rogue = `
=== KỊCH BẢN GIẢ LẬP AGENT BỊ CHIẾM MÃ (--rogue-pay-to) ===
[BLOCKED ON-CHAIN] ExceedsSandboxPerTxCap: Vượt trần Sandbox
USDC Balance    : 0.051 USDC | Paused: false
`;
    const summary = sanitizeCliSummary(rogue);
    expect(summary.successCount).toBe(0);
    expect(summary.blockedCount).toBe(1);
    expect(summary.blockedLines).toHaveLength(1);
  });
});
