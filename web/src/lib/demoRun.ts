import { getAddress, isAddress } from "viem";

export type DemoRunResult = {
  successCount: number | null;
  blockedCount: number | null;
  txHashes: string[];
  blockedLines: string[];
  balanceUsdc: string | null;
  paused: boolean | null;
};

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

/** Tạo lệnh CLI tương ứng với công tắc "Bỏ qua Rule Engine" để hiển thị/copy dự phòng. */
export function buildDemoCliCommand(bypassRules: boolean, policyAddress?: string): string {
  const base = bypassRules ? "cd agent && npm run demo:bypass" : "cd agent && npm run demo:mock";
  if (!policyAddress || !isAddress(policyAddress, { strict: false })) {
    return base;
  }
  const normalized = getAddress(policyAddress);
  return `AGENT_POLICY_ADDRESS=${normalized} ${base.replace("cd agent && ", "")}  # trong thư mục agent/`;
}

/** Rút gọn stdout từ agent/src/run.ts thành thông tin an toàn (không lọt biến môi trường hay đường dẫn nhạy cảm). */
export function sanitizeCliSummary(stdout: string, stderr = ""): DemoRunResult {
  const combined = `${stdout}\n${stderr}`.replace(ANSI_PATTERN, "");
  const lines = combined.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const txSet = new Set<string>();
  const blockedLines: string[] = [];
  let lineOkCount = 0;
  let successCount: number | null = null;
  let blockedCount: number | null = null;
  let balanceUsdc: string | null = null;
  let paused: boolean | null = null;

  for (const line of lines) {
    const hashMatches = line.match(/0x[0-9a-fA-F]{64}/g);
    if (hashMatches) {
      for (const h of hashMatches) txSet.add(h);
    }
    if (line.startsWith("[SUCCESS 200 OK]")) {
      lineOkCount += 1;
    }
    if (line.startsWith("[BLOCKED ON-CHAIN]") || line.startsWith("[BLOCKED OFF-CHAIN]")) {
      blockedLines.push(line);
    }
    const counts = line.match(/Thành công:\s*(\d+)\s*\|\s*Bị chặn\/lỗi:\s*(\d+)/);
    if (counts) {
      successCount = Number(counts[1]);
      blockedCount = Number(counts[2]);
    }
    const bal = line.match(/^USDC Balance\s*:\s*([0-9.]+)\s*USDC\s*\|\s*Paused:\s*(true|false)/);
    if (bal) {
      balanceUsdc = bal[1];
      paused = bal[2] === "true";
    }
  }

  // Kịch bản --rogue-pay-to thoát sớm trước vòng LLM nên chưa in dòng tổng hợp; suy ra từ log dòng.
  if (successCount === null && (lineOkCount > 0 || blockedLines.length > 0)) {
    successCount = lineOkCount;
    blockedCount = blockedLines.length;
  }

  return {
    successCount,
    blockedCount,
    txHashes: [...txSet],
    blockedLines: blockedLines.slice(0, 6),
    balanceUsdc,
    paused,
  };
}
