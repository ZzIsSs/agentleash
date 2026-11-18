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

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function extractHostname(hostOrAuthority: string): string {
  const trimmed = hostOrAuthority.trim().toLowerCase();
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return end >= 0 ? trimmed.slice(0, end + 1) : trimmed;
  }
  const colon = trimmed.indexOf(":");
  return colon >= 0 ? trimmed.slice(0, colon) : trimmed;
}

/** Chặn request cross-site, thiếu JSON content-type hoặc đi qua IP LAN tới POST /api/demo-run. */
export function validateDemoRunRequest(headers: Headers): { ok: true } | { ok: false; status: number; error: string } {
  const host = headers.get("host");
  if (!host || !LOOPBACK_HOSTS.has(extractHostname(host))) {
    return { ok: false, status: 403, error: "Chỉ cho phép gọi /api/demo-run từ localhost." };
  }

  const secFetchSite = headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return { ok: false, status: 403, error: "Từ chối yêu cầu cross-site tới /api/demo-run." };
  }

  const origin = headers.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      const hostname = parsed.hostname.toLowerCase();
      if (!LOOPBACK_HOSTS.has(hostname) || parsed.host.toLowerCase() !== host.trim().toLowerCase()) {
        return { ok: false, status: 403, error: "Origin không khớp với localhost của Dashboard." };
      }
    } catch {
      return { ok: false, status: 403, error: "Origin không hợp lệ." };
    }
  } else {
    const referer = headers.get("referer");
    if (referer) {
      try {
        const parsed = new URL(referer);
        if (!LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase()) || parsed.host.toLowerCase() !== host.trim().toLowerCase()) {
          return { ok: false, status: 403, error: "Referer không khớp với localhost của Dashboard." };
        }
      } catch {
        return { ok: false, status: 403, error: "Referer không hợp lệ." };
      }
    }
  }

  const contentType = headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return { ok: false, status: 415, error: "Yêu cầu bắt buộc Content-Type: application/json." };
  }

  return { ok: true };
}

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
