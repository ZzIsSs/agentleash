import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getAddress, isAddress } from "viem";
import { sanitizeCliSummary, validateDemoRunRequest } from "@/lib/demoRun";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(process.cwd(), "..");
const AGENT_DIR = path.join(REPO_ROOT, "agent");
const AGENT_ENTRY = path.join(AGENT_DIR, "src", "run.ts");
const ROOT_ENV = path.join(REPO_ROOT, ".env");

let running = false;

async function fileExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function probeService(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1_500) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  const [hasAgent, hasEnv, weather, facilitator, rates] = await Promise.all([
    fileExists(AGENT_ENTRY),
    fileExists(ROOT_ENV),
    probeService("http://127.0.0.1:4021/"),
    probeService("http://127.0.0.1:4022/supported"),
    probeService("http://127.0.0.1:4023/"),
  ]);

  const available = hasAgent && hasEnv;
  const servicesReady = weather && facilitator && rates;
  const reason = !hasAgent
    ? "Không thấy mã nguồn agent/ trên máy chủ (chế độ chỉ xem on-chain)."
    : !hasEnv
      ? "Chưa có tệp .env cấu hình ví agent."
      : !servicesReady
        ? "Một số dịch vụ local (4021/4022/4023) chưa chạy."
        : undefined;

  return Response.json({
    available,
    running,
    services: { weather, facilitator, rates },
    reason,
  });
}

export async function POST(req: Request) {
  const reqCheck = validateDemoRunRequest(req.headers);
  if (!reqCheck.ok) {
    return Response.json({ error: reqCheck.error }, { status: reqCheck.status });
  }

  if (running) {
    return Response.json({ error: "Đang có một lượt chạy agent chưa xong, vui lòng đợi." }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Dữ liệu yêu cầu không hợp lệ." }, { status: 400 });
  }

  const bypassRules = (body as { bypassRules?: unknown })?.bypassRules;
  const rawPolicy = (body as { policyAddress?: unknown })?.policyAddress;

  if (typeof bypassRules !== "boolean") {
    return Response.json({ error: "Tham số bypassRules phải là boolean." }, { status: 400 });
  }

  let policyAddress: string | undefined;
  if (typeof rawPolicy === "string" && rawPolicy.trim()) {
    if (!isAddress(rawPolicy.trim(), { strict: false })) {
      return Response.json({ error: "Địa chỉ policy không hợp lệ." }, { status: 400 });
    }
    policyAddress = getAddress(rawPolicy.trim());
  }

  const [hasAgent, hasEnv] = await Promise.all([fileExists(AGENT_ENTRY), fileExists(ROOT_ENV)]);
  if (!hasAgent || !hasEnv) {
    return Response.json(
      { error: "Chạy agent trực tiếp từ web chỉ hoạt động trên máy local có agent/ và .env." },
      { status: 503 },
    );
  }

  // Dùng mảng tham số cố định (shell: false), không nhận command tự do từ client.
  const args = bypassRules
    ? [
        "--env-file=../.env",
        "src/run.ts",
        "--bypass-rules",
        "--rogue-pay-to",
        "0x1111111111111111111111111111111111111111",
      ]
    : [
        "--env-file=../.env",
        "src/run.ts",
        "--mock-llm",
        "--prompt",
        "Tổng hợp thời tiết và tỷ giá cho chuyến đi Đà Lạt",
      ];

  running = true;
  try {
    const env = { ...process.env };
    if (policyAddress) {
      env.AGENT_POLICY_ADDRESS = policyAddress;
    }
    const { stdout, stderr } = await execFileAsync(process.execPath, args, {
      cwd: AGENT_DIR,
      env,
      timeout: 55_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    const summary = sanitizeCliSummary(stdout, stderr);
    return Response.json({ ok: true, bypassRules, policyAddress: policyAddress ?? null, summary });
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const summary = sanitizeCliSummary(e.stdout ?? "", e.stderr ?? "");
    return Response.json(
      {
        ok: false,
        bypassRules,
        error: summary.blockedLines[0] ?? "Chạy agent thất bại hoặc quá thời gian chờ.",
        summary,
      },
      { status: 500 },
    );
  } finally {
    running = false;
  }
}
