import http from "node:http";
import { pathToFileURL } from "node:url";
import { formatUnits, isAddress, parseUnits, type Address, type Hex } from "viem";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import {
  decodePaymentResponseHeader,
  wrapFetchWithPayment,
  x402Client,
} from "@x402/fetch";
import { appendAuditLog, DEFAULT_AUDIT_LOG_PATH } from "./log.ts";
import { runLlmAgentLoop, type AgentToolCall, type ToolExecutionOutcome } from "./llm.ts";
import { createMockLlmClient } from "./mockLlm.ts";
import {
  createAgentPolicySigner,
  DEFAULT_FUJI_RPC,
  DEFAULT_FUJI_USDC,
  formatPolicyRevertReason,
  PolicyOnChainRejectedError,
  readPolicyStatus,
  type PolicyAuthorizationEvent,
} from "./policySigner.ts";
import {
  getDefaultApiCatalog,
  RuleEngine,
  RuleViolationError,
  type RuleErrorCode,
} from "./rules.ts";

const NETWORK_ID = "eip155:43113";
const EXPLORER = "https://testnet.snowtrace.io";
const DEFAULT_PROMPT = "Tổng hợp thời tiết và tỷ giá cho chuyến đi Đà Lạt";

const RULE_CODES = new Set<string>([
  "UNREGISTERED_API",
  "INVALID_PAY_TO",
  "PRICE_MISMATCH",
  "RATE_LIMIT_EXCEEDED",
  "DUPLICATE_QUERY",
]);

interface CliOptions {
  prompt: string;
  bypassRules: boolean;
  roguePayTo?: Address;
  replayPlan: boolean;
  /** Dùng LLM giả lập (src/mockLlm.ts) thay Gemini: bật bằng --mock-llm hoặc LLM_MODE=mock. */
  mockLlm: boolean;
}

function parseCliArgs(argv: string[]): CliOptions {
  let prompt = "";
  let bypassRules = false;
  let roguePayTo: Address | undefined;
  let replayPlan = false;
  let mockLlm = process.env.LLM_MODE === "mock";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--bypass-rules") {
      bypassRules = true;
    } else if (arg === "--replay-plan") {
      replayPlan = true;
    } else if (arg === "--mock-llm") {
      mockLlm = true;
    } else if (arg === "--prompt" && argv[i + 1]) {
      prompt = argv[i + 1];
      i += 1;
    } else if (arg === "--rogue-pay-to" && argv[i + 1]) {
      const candidate = argv[i + 1];
      if (!isAddress(candidate)) {
        throw new Error(`Địa chỉ --rogue-pay-to không hợp lệ: ${candidate}`);
      }
      roguePayTo = candidate as Address;
      i += 1;
    } else if (!arg.startsWith("--") && !prompt) {
      prompt = arg;
    }
  }

  return {
    prompt: prompt || DEFAULT_PROMPT,
    bypassRules,
    roguePayTo,
    replayPlan,
    mockLlm,
  };
}

/**
 * Recovers RuleViolationError or PolicyOnChainRejectedError even when @x402/fetch
 * wraps inner errors into `new Error("Failed to create payment payload: ...")` without `cause`.
 */
export function unwrapKnownError(
  err: unknown,
  contextError?: RuleViolationError | PolicyOnChainRejectedError,
): RuleViolationError | PolicyOnChainRejectedError | null {
  if (contextError) return contextError;

  let current: unknown = err;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (current instanceof RuleViolationError) return current;
    if (current instanceof PolicyOnChainRejectedError) return current;
    current = (current as { cause?: unknown })?.cause;
  }

  const msg = String((err as { message?: string })?.message || err || "");
  const policyMatch = msg.match(/\[OnChainPolicy:([A-Za-z0-9_]+)\]\s*(.+)$/);
  if (policyMatch) {
    return new PolicyOnChainRejectedError(
      { errorName: policyMatch[1], reason: policyMatch[2] },
      err,
    );
  }

  const ruleMatch = msg.match(/\[([A-Z0-9_]+)\]\s*(.+)$/);
  if (ruleMatch && RULE_CODES.has(ruleMatch[1])) {
    return new RuleViolationError(ruleMatch[1] as RuleErrorCode, ruleMatch[2]);
  }

  return null;
}

function toUnits(usdc: string): string {
  return parseUnits(String(usdc), 6).toString();
}

function formatCapSummary(label: string, units: bigint): string {
  return `${label}: ${formatUnits(units, 6)} USDC (${units.toString()} units)`;
}

async function printPolicySnapshot(
  title: string,
  policyAddress: Address,
  usdcAddress: Address,
  rpcUrl: string,
): Promise<void> {
  try {
    const status = await readPolicyStatus(policyAddress, usdcAddress, rpcUrl);
    console.log(`\n=== ${title} ===`);
    console.log(`Policy Contract : ${status.policyAddress}`);
    console.log(
      `USDC Balance    : ${formatUnits(status.usdcBalanceUnits, 6)} USDC | Paused: ${status.paused}`,
    );
    console.log(
      `Trusted Caps    : ${formatCapSummary("perTx", status.perTxCapUnits)} | ${formatCapSummary("daily", status.dailyCapUnits)}`,
    );
    console.log(
      `Sandbox Caps    : ${formatCapSummary("perTx", status.sandboxPerTxCapUnits)} | ${formatCapSummary("daily", status.sandboxDailyCapUnits)}`,
    );
    console.log(
      `Remaining Budget: ${formatCapSummary("daily", status.remainingDailyUnits)} | ${formatCapSummary("sandbox", status.remainingSandboxDailyUnits)}`,
    );
  } catch (err) {
    console.warn(`[PolicyStatus] Không thể đọc trạng thái contract:`, (err as Error)?.message || err);
  }
}

interface PaymentContext {
  api: string;
  query: string;
  endpointUrl: string;
  payTo?: string;
  amountUnits?: string;
  lastAuthorized?: PolicyAuthorizationEvent;
  lastError?: RuleViolationError | PolicyOnChainRejectedError;
}

function recordOnChainRejection(
  ctx: PaymentContext,
  ruleCode: string,
  reason: string,
  bypassRules: boolean,
  txHash?: string,
): void {
  appendAuditLog(
    {
      status: "REJECTED_ONCHAIN",
      api: ctx.api,
      endpoint: ctx.endpointUrl,
      query: ctx.query,
      payTo: ctx.payTo,
      amountUnits: ctx.amountUnits,
      amountUsdc: ctx.amountUnits ? formatUnits(BigInt(ctx.amountUnits), 6) : undefined,
      ruleCode,
      reason,
      txHash,
      bypassRules,
    },
    DEFAULT_AUDIT_LOG_PATH,
  );
}

function createPayingFetchClient(
  policyAddress: Address,
  agentPrivateKey: Hex,
  usdcAddress: Address,
  maxPriceUsdc: string,
  rpcUrl: string,
  ruleEngine: RuleEngine,
  bypassRules: boolean,
  getContext: () => PaymentContext,
) {
  const signer = createAgentPolicySigner({
    policyAddress,
    agentPrivateKey,
    rpcUrl,
    onAuthorized: (event) => {
      getContext().lastAuthorized = event;
    },
    onRejected: (rejected) => {
      getContext().lastError = rejected;
    },
  });

  const client = x402Client.fromConfig({
    schemes: [{ network: NETWORK_ID, client: new ExactEvmScheme(signer) }],
    spendControls: {
      allowedAssets: [
        {
          network: NETWORK_ID,
          asset: usdcAddress,
          maxAmountPerPayment: toUnits(maxPriceUsdc),
        },
      ],
    },
  });

  client.onBeforePaymentCreation(async ({ selectedRequirements: asked }) => {
    const ctx = getContext();
    ctx.payTo = asked.payTo;
    ctx.amountUnits = asked.amount;

    console.log(
      `[x402] 402 Payment Required -> ${formatUnits(BigInt(asked.amount), 6)} USDC to ${asked.payTo} (${ctx.api})`,
    );

    if (bypassRules) {
      console.warn(
        `[RuleEngine] BYPASS MODE ENABLED — Bỏ qua kiểm tra off-chain cho ${ctx.api} -> ${asked.payTo}`,
      );
      return;
    }

    try {
      ruleEngine.enforcePaymentRequirements(
        ctx.api,
        ctx.query,
        asked.payTo,
        asked.amount,
        ctx.endpointUrl,
      );
      console.log(`[RuleEngine] Passed 402 payment check for ${ctx.api}`);
    } catch (err) {
      if (err instanceof RuleViolationError) {
        ctx.lastError = err;
      }
      throw err;
    }
  });

  return {
    signer,
    payingFetch: wrapFetchWithPayment(fetch, client),
  };
}

/**
 * Simulates a compromised agent calling an untrusted/non-whitelisted payTo address
 * via a real local x402 402 endpoint so the full pipeline (RuleEngine bypass -> AgentPolicy.authorize)
 * executes on-chain on Avalanche Fuji.
 */
async function runRoguePayToScenario(
  roguePayTo: Address,
  usdcAddress: Address,
  ruleEngine: RuleEngine,
  bypassRules: boolean,
  setContext: (ctx: PaymentContext) => void,
  payingFetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
): Promise<void> {
  const server = http.createServer((req, res) => {
    const payload = {
      x402Version: 2,
      error: "Payment required",
      resource: {
        url: `http://127.0.0.1${req.url || "/api/rogue"}`,
        description: "Untrusted rogue API requesting 0.001 USDC",
        mimeType: "application/json",
      },
      accepts: [
        {
          scheme: "exact",
          network: NETWORK_ID,
          amount: "1000",
          asset: usdcAddress,
          payTo: roguePayTo,
          maxTimeoutSeconds: 300,
          extra: { name: "USD Coin", version: "2" },
        },
      ],
    };

    const encoded = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
    res.writeHead(402, {
      "Content-Type": "application/json",
      "PAYMENT-REQUIRED": encoded,
    });
    res.end(JSON.stringify({ error: "Payment required" }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addressInfo = server.address();
  const port = typeof addressInfo === "object" && addressInfo ? addressInfo.port : 0;
  const rogueUrl = `http://127.0.0.1:${port}/api/rogue?target=secret`;

  console.log(`\n=== KỊCH BẢN GIẢ LẬP AGENT BỊ CHIẾM MÃ (--rogue-pay-to) ===`);
  console.log(`Target URL  : ${rogueUrl}`);
  console.log(`Rogue PayTo : ${roguePayTo} (Ngoài whitelist)`);
  console.log(`Bypass Rules: ${bypassRules}`);

  const ctx: PaymentContext = {
    api: "rogue_api",
    query: "secret",
    endpointUrl: rogueUrl,
    payTo: roguePayTo,
    amountUnits: "1000",
  };
  setContext(ctx);

  try {
    if (!bypassRules) {
      ruleEngine.enforcePreRequest(ctx.api, ctx.query, ctx.endpointUrl);
    }
    const resp = await payingFetch(rogueUrl);
    console.log(`[RogueScenario] Unexpected status ${resp.status}`);
  } catch (err) {
    const known = unwrapKnownError(err, ctx.lastError);
    if (known instanceof RuleViolationError) {
      console.log(`[BLOCKED OFF-CHAIN] ${known.code}: ${known.reason}`);
    } else if (known instanceof PolicyOnChainRejectedError) {
      console.log(`[BLOCKED ON-CHAIN] ${known.errorName}: ${known.reason}`);
      recordOnChainRejection(ctx, known.errorName, known.reason, bypassRules);
    } else {
      const detail = formatPolicyRevertReason(err);
      console.log(`[BLOCKED] ${detail.errorName}: ${detail.reason}`);
      recordOnChainRejection(ctx, detail.errorName, detail.reason, bypassRules);
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function main() {
  const cli = parseCliArgs(process.argv.slice(2));

  const policyAddress = (process.env.AGENT_POLICY_ADDRESS || "") as Address;
  const agentPrivateKey = (process.env.AGENT_PRIVATE_KEY || "") as Hex;
  const usdcAddress = (process.env.USDC_ADDRESS || DEFAULT_FUJI_USDC) as Address;
  const rpcUrl = process.env.FUJI_RPC_URL || DEFAULT_FUJI_RPC;
  const maxPriceUsdc = process.env.MAX_PRICE_USDC || "0.01";

  if (!isAddress(policyAddress)) {
    throw new Error("Thiếu AGENT_POLICY_ADDRESS hợp lệ trong .env.");
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(agentPrivateKey)) {
    throw new Error("Thiếu AGENT_PRIVATE_KEY hợp lệ trong .env.");
  }

  const catalog = getDefaultApiCatalog();
  const ruleEngine = new RuleEngine({
    catalog,
    auditLogPath: DEFAULT_AUDIT_LOG_PATH,
  });

  let activeContext: PaymentContext = {
    api: "unknown",
    query: "",
    endpointUrl: "",
  };

  const { signer, payingFetch } = createPayingFetchClient(
    policyAddress,
    agentPrivateKey,
    usdcAddress,
    maxPriceUsdc,
    rpcUrl,
    ruleEngine,
    cli.bypassRules,
    () => activeContext,
  );

  console.log(`\n🤖 AgentLeash Runner (Agent EOA: ${signer.agentAddress})`);
  if (cli.bypassRules) {
    console.warn("⚠️  CẢNH BÁO: Chế độ --bypass-rules đang BẬT (bỏ qua Rule Engine off-chain).");
  }

  await printPolicySnapshot("TRẠNG THÁI AGENTPOLICY ĐẦU PHIÊN", policyAddress, usdcAddress, rpcUrl);

  if (cli.roguePayTo) {
    await runRoguePayToScenario(
      cli.roguePayTo,
      usdcAddress,
      ruleEngine,
      cli.bypassRules,
      (ctx) => {
        activeContext = ctx;
      },
      payingFetch,
    );
    await printPolicySnapshot("TRẠNG THÁI AGENTPOLICY CUỐI PHIÊN", policyAddress, usdcAddress, rpcUrl);
    return;
  }

  console.log(`\n📝 Prompt: "${cli.prompt}"`);

  const executeTool = async (call: AgentToolCall): Promise<ToolExecutionOutcome> => {
    let api = call.name;
    let queryLabel = "";
    let endpointUrl = "";

    if (call.name === "fetch_weather") {
      api = "weather";
      const city = String(call.arguments.city || "Da Lat").trim();
      const days = Math.min(Math.max(Number(call.arguments.days || 3), 1), 3);
      queryLabel = city;
      endpointUrl = `${catalog.weather.baseUrl}?city=${encodeURIComponent(city)}&days=${days}`;
    } else if (call.name === "fetch_exchange_rate") {
      api = "rates";
      const from = String(call.arguments.from || "USD").trim().toUpperCase();
      const to = String(call.arguments.to || "VND").trim().toUpperCase();
      const pair = `${from}/${to}`;
      queryLabel = pair;
      endpointUrl = `${catalog.rates.baseUrl}?pair=${encodeURIComponent(pair)}`;
    } else {
      queryLabel = JSON.stringify(call.arguments);
      endpointUrl = call.name;
    }

    activeContext = {
      api,
      query: queryLabel,
      endpointUrl,
    };

    console.log(`\n--- Thực thi Tool Call: ${call.name}(${JSON.stringify(call.arguments)}) ---`);

    try {
      if (!cli.bypassRules) {
        ruleEngine.enforcePreRequest(api, queryLabel, endpointUrl);
      }

      const response = await payingFetch(endpointUrl);

      if (response.status === 402) {
        const reqHeader = response.headers.get("PAYMENT-REQUIRED");
        const decoded = reqHeader ? decodePaymentRequiredHeader(reqHeader) : null;
        const reason = `Server từ chối thanh toán (402): ${decoded?.error || "Payment required"}`;
        recordOnChainRejection(
          activeContext,
          "HTTP_402_REFUSED",
          reason,
          cli.bypassRules,
          activeContext.lastAuthorized?.txHash,
        );
        return { ok: false, error: reason };
      }

      if (!response.ok) {
        const text = await response.text();
        return { ok: false, error: `HTTP ${response.status}: ${text}` };
      }

      const data = await response.json();
      const receiptHeader = response.headers.get("PAYMENT-RESPONSE");
      const receipt = receiptHeader ? decodePaymentResponseHeader(receiptHeader) : null;
      const settleTx = receipt?.transaction || activeContext.lastAuthorized?.txHash;

      if (!cli.bypassRules) {
        ruleEngine.recordExecution(api, queryLabel);
      }

      appendAuditLog(
        {
          status: "SETTLED",
          api,
          endpoint: endpointUrl,
          query: queryLabel,
          payTo: activeContext.payTo,
          amountUnits: activeContext.amountUnits,
          amountUsdc: activeContext.amountUnits
            ? formatUnits(BigInt(activeContext.amountUnits), 6)
            : undefined,
          txHash: settleTx,
          bypassRules: cli.bypassRules,
        },
        DEFAULT_AUDIT_LOG_PATH,
      );

      console.log(
        `[SUCCESS 200 OK] Nhận dữ liệu từ ${api}. ${settleTx ? `Snowtrace: ${EXPLORER}/tx/${settleTx}` : ""}`,
      );
      return { ok: true, data };
    } catch (err) {
      const known = unwrapKnownError(err, activeContext.lastError);

      if (known instanceof RuleViolationError) {
        console.warn(`[BLOCKED OFF-CHAIN] ${known.code}: ${known.reason}`);
        return { ok: false, error: known.reason };
      }

      if (known instanceof PolicyOnChainRejectedError) {
        console.error(`[BLOCKED ON-CHAIN] ${known.errorName}: ${known.reason}`);
        recordOnChainRejection(activeContext, known.errorName, known.reason, cli.bypassRules);
        return { ok: false, error: known.reason };
      }

      const message = (err as Error)?.message || String(err);
      console.error(`[ERROR] ${message}`);
      return { ok: false, error: message };
    }
  };

  if (cli.replayPlan) {
    console.log("\n[Replay Mode] Thực thi kế hoạch 4 tool calls Đà Lạt trực tiếp qua RuleEngine + x402 + AgentPolicy (không gọi Gemini API):");
    const plan: AgentToolCall[] = [
      { id: "replay-1", name: "fetch_weather", arguments: { city: "Da Lat", days: 3 } },
      { id: "replay-2", name: "fetch_exchange_rate", arguments: { from: "USD", to: "VND" } },
      { id: "replay-3", name: "fetch_exchange_rate", arguments: { from: "AVAX", to: "USD" } },
      { id: "replay-4", name: "fetch_exchange_rate", arguments: { from: "USDC", to: "VND" } },
    ];
    let okCount = 0;
    let failCount = 0;
    for (const call of plan) {
      const outcome = await executeTool(call);
      if (outcome.ok) okCount += 1;
      else failCount += 1;
    }
    console.log(`\nTổng tool calls: ${plan.length} | Thành công: ${okCount} | Bị chặn/lỗi: ${failCount}`);
    await printPolicySnapshot("TRẠNG THÁI AGENTPOLICY CUỐI PHIÊN", policyAddress, usdcAddress, rpcUrl);
    return;
  }

  if (cli.mockLlm) {
    console.warn(
      "⚠️  CHẾ ĐỘ LLM GIẢ LẬP (--mock-llm / LLM_MODE=mock): không gọi Gemini, tool call lấy từ kịch bản cố định. Thanh toán x402 và AgentPolicy trên Fuji vẫn là thật.",
    );
  }

  const loopResult = await runLlmAgentLoop({
    prompt: cli.prompt,
    executeTool,
    client: cli.mockLlm ? createMockLlmClient() : undefined,
    onModelTurn: (turn, calls) => {
      console.log(
        `\n[${cli.mockLlm ? "Mock LLM" : "Gemini"} Turn ${turn}] Model đề xuất ${calls.length} tool call(s)${calls.length > 0 ? `: ${calls.map((c) => c.name).join(", ")}` : "."}`,
      );
    },
  });

  console.log(`\n================ BÁO CÁO TỔNG HỢP CỦA AGENT ================`);
  console.log(loopResult.finalText);
  console.log(`============================================================`);
  console.log(
    `Tổng lượt LLM: ${loopResult.turns} | Tổng tool calls: ${loopResult.toolCallsExecuted.length} | Thành công: ${loopResult.toolCallsExecuted.filter((x) => x.outcome.ok).length} | Bị chặn/lỗi: ${loopResult.toolCallsExecuted.filter((x) => !x.outcome.ok).length}`,
  );

  await printPolicySnapshot("TRẠNG THÁI AGENTPOLICY CUỐI PHIÊN", policyAddress, usdcAddress, rpcUrl);
}

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  main().catch((err) => {
    console.error("[Fatal Error]", err?.message || err);
    process.exit(1);
  });
}
