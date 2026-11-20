import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { formatUnits, isAddress, parseUnits, type Address, type Hex } from "viem";
import { z } from "zod";
import { loadRepoEnv, REPO_ENV_PATH } from "./envFile.ts";
import { appendAuditLog, DEFAULT_AUDIT_LOG_PATH } from "./log.ts";
import {
  createAgentPolicySigner,
  DEFAULT_FUJI_RPC,
  DEFAULT_FUJI_USDC,
  formatPolicyRevertReason,
  isAddressWhitelisted,
  PolicyOnChainRejectedError,
  readPolicyStatus,
  simulatePolicyAuthorize,
  type AgentPolicyStatus,
  type PolicyAuthorizationEvent,
  type SimulateAuthorizeResult,
} from "./policySigner.ts";
import {
  getDefaultApiCatalog,
  RuleEngine,
  RuleViolationError,
  type ApiCatalogEntry,
} from "./rules.ts";
import { unwrapKnownError } from "./run.ts";

const NETWORK_ID = "eip155:43113";
const SNOWSCAN_EXPLORER = "https://testnet.snowtrace.io";
export const DEFAULT_DASHBOARD_URL = "http://localhost:3000";

export interface McpPaymentContext {
  api: string;
  query: string;
  endpointUrl: string;
  payTo?: string;
  amountUnits?: string;
  lastAuthorized?: PolicyAuthorizationEvent;
  lastError?: RuleViolationError | PolicyOnChainRejectedError | McpGatewayRuleError;
}

export class McpGatewayRuleError extends Error {
  readonly code: string;
  readonly reason: string;

  constructor(code: string, reason: string) {
    super(`[${code}] ${reason}`);
    this.name = "McpGatewayRuleError";
    this.code = code;
    this.reason = reason;
  }
}

export interface TestUnknownApiInput {
  url?: string;
  payTo?: string;
  query?: string;
  apiName?: string;
  amountUsdc?: string;
}

export interface CallTrustedApiInput {
  api?: string;
  query?: string;
  url?: string;
  payTo?: string;
  days?: number;
  from?: string;
  to?: string;
}

export type McpToolOutcome =
  | {
      ok: true;
      tier: "sandbox" | "trusted" | "free";
      simulated?: boolean;
      settled?: boolean;
      api: string;
      query: string;
      endpoint: string;
      payTo?: string;
      amountUsdc?: string;
      txHash?: string;
      snowscanUrl?: string;
      data: unknown;
    }
  | {
      ok: false;
      blockedBy: "rule-engine" | "contract" | "http" | "input";
      code: string;
      reason: string;
      api: string;
      query: string;
      endpoint: string;
      payTo?: string;
      amountUsdc?: string;
      hint?: string;
    };

export interface McpGatewayConfig {
  policyAddress: Address;
  agentPrivateKey?: Hex;
  usdcAddress?: Address;
  rpcUrl?: string;
  maxPriceUsdc?: string;
  auditLogPath?: string | null;
  catalog?: Record<string, ApiCatalogEntry>;
  dashboardUrl?: string;
}

export type PayingFetchFactory = (options: {
  getContext: () => McpPaymentContext;
  onBeforePayment: (asked: { payTo: string; amount: string }) => Promise<void> | void;
}) => (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface McpGatewayDeps {
  ruleEngine?: RuleEngine;
  fetchFn?: typeof fetch;
  createPayingFetch?: PayingFetchFactory;
  checkWhitelist?: (payTo: Address) => Promise<boolean>;
  getPolicyStatus?: () => Promise<AgentPolicyStatus>;
  simulateAuthorize?: (params: {
    payTo: Address;
    amountUnits: bigint;
  }) => Promise<SimulateAuthorizeResult>;
}

const BLOCKED_METADATA_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "metadata.goog",
]);

/**
 * Validates URL safety for Side-A API calls (HTTP/HTTPS only, blocks cloud metadata SSRF).
 */
export function validateApiUrl(
  rawUrl: string,
): { ok: true; url: URL } | { ok: false; code: string; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return {
      ok: false,
      code: "UNSAFE_URL",
      reason: `URL không hợp lệ: "${rawUrl}"`,
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      code: "UNSAFE_URL",
      reason: `Chỉ hỗ trợ giao thức http/https (nhận ${parsed.protocol})`,
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_METADATA_HOSTS.has(host) || host.startsWith("169.254.")) {
    return {
      ok: false,
      code: "UNSAFE_URL",
      reason: `URL bị chặn vì thuộc dải metadata nội bộ không an toàn (${host})`,
    };
  }

  return { ok: true, url: parsed };
}

function inferApiNameFromUrl(parsed: URL): string {
  const pathPart = parsed.pathname.replace(/^\/+|\/+$/g, "").replace(/\//g, "_") || "root";
  return `${parsed.hostname}_${pathPart}`.slice(0, 64);
}

function toUnitsString(usdc: string): string {
  return parseUnits(String(usdc), 6).toString();
}

function recordAudit(
  auditLogPath: string | null,
  input: Parameters<typeof appendAuditLog>[0],
): void {
  if (!auditLogPath) return;
  appendAuditLog(input, auditLogPath);
}

function normalizeDashboardUrl(raw?: string): string {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_DASHBOARD_URL;
  return trimmed.replace(/\/+$/, "");
}

function buildErrorHint(options: {
  code: string;
  dashboardUrl: string;
  payTo?: string;
  hintForPromote?: boolean;
  includeContractFallback?: boolean;
}): string | undefined {
  const { code, dashboardUrl, payTo, hintForPromote, includeContractFallback } = options;
  const targetNote = payTo ? ` cho ${payTo}` : "";

  switch (code) {
    case "PausedError":
      return `Agent đang bị khóa bởi Kill Switch. Mở Dashboard (${dashboardUrl}) và bấm "Mở khóa" (unpause) để tiếp tục chi tiêu.`;

    case "ExceedsSandboxPerTxCap":
      return `Địa chỉ ${payTo || "lạ"} đã được ghi nhận vào mục Bị từ chối. Mở Dashboard (${dashboardUrl}) để bấm "Chuyển thành API quen" (\`setWhitelist\`) nếu tin cậy, hoặc tăng trần Sandbox qua \`setCaps\`, rồi gọi lại qua \`call_trusted_api\`.`;

    case "ExceedsSandboxDailyCap":
      return `Đã chạm trần Sandbox trong chu kỳ. Mở Dashboard (${dashboardUrl}) để bấm "Chuyển thành API quen" (\`setWhitelist\`)${targetNote} nếu tin cậy, chỉnh hạn mức Sandbox qua \`setCaps\`, hoặc chờ sang chu kỳ mới.`;

    case "ExceedsDailyCap":
      return `Đã chạm hạn mức chi tiêu chu kỳ (dailyCap). Mở Dashboard (${dashboardUrl}) để tăng hạn mức qua \`setCaps\` hoặc chờ sang chu kỳ mới.`;

    case "ExceedsPerTxCap":
      return `Khoản chi vượt trần mỗi giao dịch Trusted (perTxCap). Mở Dashboard (${dashboardUrl}) để điều chỉnh hạn mức qua \`setCaps\`.`;

    case "NOT_WHITELISTED":
      return `Hãy thử bằng \`test_unknown_api\` hoặc mở Dashboard (${dashboardUrl}) để bấm "Chuyển thành API quen" (\`setWhitelist\`)${targetNote} rồi gọi lại.`;

    case "UNREGISTERED_API":
      return `Dùng \`weather\`/\`rates\`, hoặc mở Dashboard (${dashboardUrl}) bấm "Chuyển thành API quen" rồi truyền \`url\` của API đó.`;

    case "LOOP_DETECTED":
      return `Mở Dashboard (${dashboardUrl}) để xử lý nguyên nhân bị chặn (bấm "Chuyển thành API quen", chỉnh \`setCaps\` hoặc mở khóa Kill Switch), rồi thử lại sau khi hết thời gian chờ.`;

    case "Unauthorized":
      return `Ví agent không khớp địa chỉ agent của policy. Mở Dashboard (${dashboardUrl}) để kiểm tra cấu hình policy.`;

    default:
      if (hintForPromote && payTo) {
        return `Địa chỉ ${payTo} vừa được ghi nhận vào mục Bị từ chối trên Dashboard (${dashboardUrl}). Nếu tin cậy API này, chủ ví có thể mở Dashboard bấm "Chuyển thành API quen" rồi gọi lại qua \`call_trusted_api\`.`;
      }
      if (includeContractFallback) {
        return `Mở Dashboard (${dashboardUrl}) để kiểm tra trạng thái AgentPolicy, hạn mức (\`setCaps\`), whitelist hoặc Kill Switch.`;
      }
      return undefined;
  }
}

function formatErrorOutcome(
  err: unknown,
  ctx: McpPaymentContext,
  auditLogPath: string | null,
  dashboardUrl: string,
  hintForPromote?: boolean,
): McpToolOutcome {
  const gatewayRuleError =
    ctx.lastError instanceof McpGatewayRuleError
      ? ctx.lastError
      : err instanceof McpGatewayRuleError
        ? err
        : undefined;
  if (gatewayRuleError) {
    return {
      ok: false,
      blockedBy: "rule-engine",
      code: gatewayRuleError.code,
      reason: gatewayRuleError.reason,
      api: ctx.api,
      query: ctx.query,
      endpoint: ctx.endpointUrl,
      payTo: ctx.payTo,
      amountUsdc: ctx.amountUnits ? formatUnits(BigInt(ctx.amountUnits), 6) : undefined,
      hint: buildErrorHint({
        code: gatewayRuleError.code,
        dashboardUrl,
        payTo: ctx.payTo,
        hintForPromote,
      }),
    };
  }

  const known = unwrapKnownError(err, ctx.lastError instanceof McpGatewayRuleError ? undefined : ctx.lastError);

  if (known instanceof RuleViolationError) {
    return {
      ok: false,
      blockedBy: "rule-engine",
      code: known.code,
      reason: known.reason,
      api: ctx.api,
      query: ctx.query,
      endpoint: ctx.endpointUrl,
      payTo: ctx.payTo,
      amountUsdc: ctx.amountUnits ? formatUnits(BigInt(ctx.amountUnits), 6) : undefined,
      hint: buildErrorHint({
        code: known.code,
        dashboardUrl,
        payTo: ctx.payTo,
        hintForPromote,
      }),
    };
  }

  if (known instanceof PolicyOnChainRejectedError) {
    recordAudit(auditLogPath, {
      status: "REJECTED_ONCHAIN",
      api: ctx.api,
      endpoint: ctx.endpointUrl,
      query: ctx.query,
      payTo: ctx.payTo,
      amountUnits: ctx.amountUnits,
      amountUsdc: ctx.amountUnits ? formatUnits(BigInt(ctx.amountUnits), 6) : undefined,
      ruleCode: known.errorName,
      reason: known.reason,
      bypassRules: false,
    });
    return {
      ok: false,
      blockedBy: "contract",
      code: known.errorName,
      reason: known.reason,
      api: ctx.api,
      query: ctx.query,
      endpoint: ctx.endpointUrl,
      payTo: ctx.payTo,
      amountUsdc: ctx.amountUnits ? formatUnits(BigInt(ctx.amountUnits), 6) : undefined,
      hint: buildErrorHint({
        code: known.errorName,
        dashboardUrl,
        payTo: ctx.payTo,
        hintForPromote,
        includeContractFallback: true,
      }),
    };
  }

  const detail = formatPolicyRevertReason(err);
  const message = (err as Error)?.message || String(err);
  const isNetworkOrGeneric = detail.errorName === "ContractRevert" && !message.includes("revert");
  if (!isNetworkOrGeneric) {
    recordAudit(auditLogPath, {
      status: "REJECTED_ONCHAIN",
      api: ctx.api,
      endpoint: ctx.endpointUrl,
      query: ctx.query,
      payTo: ctx.payTo,
      amountUnits: ctx.amountUnits,
      amountUsdc: ctx.amountUnits ? formatUnits(BigInt(ctx.amountUnits), 6) : undefined,
      ruleCode: detail.errorName,
      reason: detail.reason,
      bypassRules: false,
    });
    return {
      ok: false,
      blockedBy: "contract",
      code: detail.errorName,
      reason: detail.reason,
      api: ctx.api,
      query: ctx.query,
      endpoint: ctx.endpointUrl,
      payTo: ctx.payTo,
      amountUsdc: ctx.amountUnits ? formatUnits(BigInt(ctx.amountUnits), 6) : undefined,
      hint: buildErrorHint({
        code: detail.errorName,
        dashboardUrl,
        payTo: ctx.payTo,
        hintForPromote,
        includeContractFallback: true,
      }),
    };
  }

  return {
    ok: false,
    blockedBy: "http",
    code: "REQUEST_FAILED",
    reason: `Không gọi được API: ${message}`,
    api: ctx.api,
    query: ctx.query,
    endpoint: ctx.endpointUrl,
    payTo: ctx.payTo,
    amountUsdc: ctx.amountUnits ? formatUnits(BigInt(ctx.amountUnits), 6) : undefined,
  };
}

/**
 * Builds the AgentLeash MCP gateway handlers wrapping RuleEngine, PolicySigner,
 * x402 payment fetch, and audit logging.
 */
export function createMcpGateway(config: McpGatewayConfig, deps: McpGatewayDeps = {}) {
  const usdcAddress = config.usdcAddress ?? DEFAULT_FUJI_USDC;
  const rpcUrl = config.rpcUrl ?? DEFAULT_FUJI_RPC;
  const maxPriceUsdc = config.maxPriceUsdc ?? "0.01";
  const maxPriceUnits = parseUnits(maxPriceUsdc, 6);
  const dashboardUrl = normalizeDashboardUrl(config.dashboardUrl);
  const auditLogPath =
    config.auditLogPath === undefined ? DEFAULT_AUDIT_LOG_PATH : config.auditLogPath;
  const catalog = config.catalog ?? getDefaultApiCatalog();
  const ruleEngine =
    deps.ruleEngine ?? new RuleEngine({ catalog, auditLogPath });
  const fetchFn = deps.fetchFn ?? fetch;

  function toRuleViolationOutcome(
    err: RuleViolationError,
    params: { api: string; query: string; endpoint: string; payTo?: string; hintForPromote?: boolean },
  ): McpToolOutcome {
    const hint = buildErrorHint({
      code: err.code,
      dashboardUrl,
      payTo: params.payTo,
      hintForPromote: params.hintForPromote,
    });
    return {
      ok: false,
      blockedBy: "rule-engine",
      code: err.code,
      reason: err.reason,
      api: params.api,
      query: params.query,
      endpoint: params.endpoint,
      payTo: params.payTo,
      ...(hint ? { hint } : {}),
    };
  }

  const checkWhitelist =
    deps.checkWhitelist ??
    ((payTo: Address) => isAddressWhitelisted(config.policyAddress, payTo, rpcUrl));

  const getPolicyStatus =
    deps.getPolicyStatus ??
    (() => readPolicyStatus(config.policyAddress, usdcAddress, rpcUrl));

  const simulateAuthorize =
    deps.simulateAuthorize ??
    (({ payTo, amountUnits }: { payTo: Address; amountUnits: bigint }) => {
      if (!config.agentPrivateKey || !/^0x[0-9a-fA-F]{64}$/.test(config.agentPrivateKey)) {
        throw new Error("Thiếu AGENT_PRIVATE_KEY hợp lệ để mô phỏng AgentPolicy.authorize.");
      }
      return simulatePolicyAuthorize({
        policyAddress: config.policyAddress,
        agentPrivateKey: config.agentPrivateKey,
        payTo,
        amountUnits,
        rpcUrl,
      });
    });

  const createPayingFetch: PayingFetchFactory =
    deps.createPayingFetch ??
    (({ getContext, onBeforePayment }) => {
      if (!config.agentPrivateKey || !/^0x[0-9a-fA-F]{64}$/.test(config.agentPrivateKey)) {
        throw new Error("Thiếu AGENT_PRIVATE_KEY hợp lệ để ký AgentPolicy.authorize.");
      }
      const signer = createAgentPolicySigner({
        policyAddress: config.policyAddress,
        agentPrivateKey: config.agentPrivateKey,
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
              maxAmountPerPayment: toUnitsString(maxPriceUsdc),
            },
          ],
        },
      });

      client.onBeforePaymentCreation(async ({ selectedRequirements: asked }) => {
        const ctx = getContext();
        ctx.payTo = asked.payTo;
        ctx.amountUnits = asked.amount;
        await onBeforePayment({ payTo: asked.payTo, amount: asked.amount });
      });

      return wrapFetchWithPayment(fetchFn, client);
    });

  async function executePaidRequest(options: {
    ctx: McpPaymentContext;
    tier: "sandbox" | "trusted";
    recordKey: string;
    loopKey?: string;
    dedupTarget?: string;
    onBeforePayment: (asked: { payTo: string; amount: string }) => Promise<void> | void;
    hintForPromote?: boolean;
  }): Promise<McpToolOutcome> {
    const { ctx, tier, recordKey, loopKey, dedupTarget, onBeforePayment, hintForPromote } = options;

    try {
      const payingFetch = createPayingFetch({
        getContext: () => ctx,
        onBeforePayment,
      });

      const response = await payingFetch(ctx.endpointUrl);

      if (response.status === 402) {
        ruleEngine.recordAttempt(recordKey);
        const reqHeader = response.headers.get("PAYMENT-REQUIRED");
        const decoded = reqHeader ? decodePaymentRequiredHeader(reqHeader) : null;
        const reason = `Server từ chối thanh toán (402): ${decoded?.error || "Payment required"}`;
        recordAudit(auditLogPath, {
          status: "REJECTED_ONCHAIN",
          api: ctx.api,
          endpoint: ctx.endpointUrl,
          query: ctx.query,
          payTo: ctx.payTo,
          amountUnits: ctx.amountUnits,
          amountUsdc: ctx.amountUnits ? formatUnits(BigInt(ctx.amountUnits), 6) : undefined,
          ruleCode: "HTTP_402_REFUSED",
          reason,
          txHash: ctx.lastAuthorized?.txHash,
          bypassRules: false,
        });
        return {
          ok: false,
          blockedBy: "http",
          code: "HTTP_402_REFUSED",
          reason,
          api: ctx.api,
          query: ctx.query,
          endpoint: ctx.endpointUrl,
          payTo: ctx.payTo,
          amountUsdc: ctx.amountUnits ? formatUnits(BigInt(ctx.amountUnits), 6) : undefined,
        };
      }

      if (!response.ok) {
        ruleEngine.recordAttempt(recordKey);
        const text = await response.text();
        return {
          ok: false,
          blockedBy: "http",
          code: `HTTP_${response.status}`,
          reason: `API trả lỗi HTTP ${response.status}: ${text.slice(0, 300)}`,
          api: ctx.api,
          query: ctx.query,
          endpoint: ctx.endpointUrl,
          payTo: ctx.payTo,
        };
      }

      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      const receiptHeader = response.headers.get("PAYMENT-RESPONSE");
      const receipt = receiptHeader ? decodePaymentResponseHeader(receiptHeader) : null;
      const settledTx = receipt?.transaction;
      const authTx = ctx.lastAuthorized?.txHash;

      let resolvedTier: "sandbox" | "trusted" = tier;
      if (tier === "sandbox") {
        if (ctx.lastAuthorized?.isSandbox === false) {
          resolvedTier = "trusted";
        } else if (ctx.lastAuthorized?.isSandbox === undefined && deps.checkWhitelist && ctx.payTo && isAddress(ctx.payTo)) {
          if (await checkWhitelist(ctx.payTo as Address)) {
            resolvedTier = "trusted";
          }
        }
      }

      ruleEngine.recordExecution(recordKey, ctx.query, loopKey, dedupTarget);

      if (settledTx) {
        recordAudit(auditLogPath, {
          status: "SETTLED",
          api: ctx.api,
          endpoint: ctx.endpointUrl,
          query: ctx.query,
          payTo: ctx.payTo,
          amountUnits: ctx.amountUnits,
          amountUsdc: ctx.amountUnits ? formatUnits(BigInt(ctx.amountUnits), 6) : undefined,
          txHash: settledTx,
          bypassRules: false,
        });
        return {
          ok: true,
          tier: resolvedTier,
          settled: true,
          api: ctx.api,
          query: ctx.query,
          endpoint: ctx.endpointUrl,
          payTo: ctx.payTo,
          amountUsdc: ctx.amountUnits ? formatUnits(BigInt(ctx.amountUnits), 6) : undefined,
          txHash: settledTx,
          snowscanUrl: `${SNOWSCAN_EXPLORER}/tx/${settledTx}`,
          data,
        };
      }

      if (ctx.amountUnits || authTx) {
        recordAudit(auditLogPath, {
          status: "ALLOWED",
          api: ctx.api,
          endpoint: ctx.endpointUrl,
          query: ctx.query,
          payTo: ctx.payTo,
          amountUnits: ctx.amountUnits,
          amountUsdc: ctx.amountUnits ? formatUnits(BigInt(ctx.amountUnits), 6) : undefined,
          txHash: authTx,
          reason: "API trả 200 OK sau bước authorize nhưng không có header PAYMENT-RESPONSE xác nhận settle USDC.",
          bypassRules: false,
        });
        return {
          ok: true,
          tier: resolvedTier,
          settled: false,
          api: ctx.api,
          query: ctx.query,
          endpoint: ctx.endpointUrl,
          payTo: ctx.payTo,
          amountUsdc: ctx.amountUnits ? formatUnits(BigInt(ctx.amountUnits), 6) : undefined,
          txHash: authTx,
          snowscanUrl: authTx ? `${SNOWSCAN_EXPLORER}/tx/${authTx}` : undefined,
          data,
        };
      }

      recordAudit(auditLogPath, {
        status: "ALLOWED",
        api: ctx.api,
        endpoint: ctx.endpointUrl,
        query: ctx.query,
        bypassRules: false,
      });

      return {
        ok: true,
        tier: "free",
        settled: false,
        api: ctx.api,
        query: ctx.query,
        endpoint: ctx.endpointUrl,
        amountUsdc: "0",
        data,
      };
    } catch (err) {
      const outcome = formatErrorOutcome(err, ctx, auditLogPath, dashboardUrl, hintForPromote);
      if (!outcome.ok && (outcome.blockedBy === "rule-engine" || outcome.blockedBy === "contract")) {
        ruleEngine.recordFailure(recordKey, loopKey, outcome.code);
      } else {
        ruleEngine.recordAttempt(recordKey);
      }
      return outcome;
    }
  }

  /**
   * Tool 1: Tests an unknown/untrusted API through Sandbox protection, RuleEngine
   * (URL safety, rate-limit, dedup, max price cap) and on-chain AgentPolicy.
   */
  async function handleTestUnknownApi(input: TestUnknownApiInput): Promise<McpToolOutcome> {
    const query = (input.query ?? "sandbox-test").trim() || "sandbox-test";
    const rawUrl = input.url?.trim();
    const rawPayTo = input.payTo?.trim();

    if (!rawUrl && !rawPayTo) {
      return {
        ok: false,
        blockedBy: "input",
        code: "MISSING_TARGET",
        reason: "Cần truyền ít nhất `url` hoặc địa chỉ `payTo` để thử nghiệm API lạ.",
        api: input.apiName ?? "unknown_api",
        query,
        endpoint: "",
      };
    }

    if (rawPayTo && !isAddress(rawPayTo)) {
      const reason = `Địa chỉ payTo không hợp lệ: "${rawPayTo}"`;
      recordAudit(auditLogPath, {
        status: "REJECTED_OFFCHAIN",
        api: input.apiName ?? "unknown_api",
        endpoint: rawUrl ?? rawPayTo,
        query,
        payTo: rawPayTo,
        ruleCode: "INVALID_PAY_TO",
        reason,
      });
      return {
        ok: false,
        blockedBy: "rule-engine",
        code: "INVALID_PAY_TO",
        reason,
        api: input.apiName ?? "unknown_api",
        query,
        endpoint: rawUrl ?? rawPayTo,
        payTo: rawPayTo,
      };
    }

    let endpointUrl = rawUrl ?? "";
    let apiName = input.apiName?.trim() || "unknown_api";

    if (rawUrl) {
      const urlCheck = validateApiUrl(rawUrl);
      if (!urlCheck.ok) {
        recordAudit(auditLogPath, {
          status: "REJECTED_OFFCHAIN",
          api: apiName,
          endpoint: rawUrl,
          query,
          payTo: rawPayTo,
          ruleCode: urlCheck.code,
          reason: urlCheck.reason,
        });
        return {
          ok: false,
          blockedBy: "rule-engine",
          code: urlCheck.code,
          reason: urlCheck.reason,
          api: apiName,
          query,
          endpoint: rawUrl,
          payTo: rawPayTo,
        };
      }
      if (!input.apiName?.trim()) {
        apiName = inferApiNameFromUrl(urlCheck.url);
      }
    }

    let probeAmountUnits = "1000";
    if (input.amountUsdc) {
      try {
        probeAmountUnits = toUnitsString(input.amountUsdc);
      } catch {
        return {
          ok: false,
          blockedBy: "input",
          code: "INVALID_AMOUNT",
          reason: `Số tiền amountUsdc không hợp lệ: "${input.amountUsdc}"`,
          api: apiName,
          query,
          endpoint: endpointUrl || rawPayTo || "",
        };
      }
    }

    const loopKey = `sandbox:${(rawPayTo || endpointUrl || apiName).toLowerCase()}`;

    if (!rawUrl && rawPayTo) {
      endpointUrl = `onchain-simulation://${rawPayTo}`;

      try {
        ruleEngine.enforceRateAndDedup(apiName, query, endpointUrl, loopKey, rawPayTo);
      } catch (err) {
        if (err instanceof RuleViolationError) {
          return toRuleViolationOutcome(err, {
            api: apiName,
            query,
            endpoint: endpointUrl,
            payTo: rawPayTo,
            hintForPromote: true,
          });
        }
        throw err;
      }

      const probeUnits = BigInt(probeAmountUnits);
      if (probeUnits > maxPriceUnits) {
        const reason = `API lạ đòi ${formatUnits(probeUnits, 6)} USDC, vượt trần an toàn ngoài chuỗi ${maxPriceUsdc} USDC`;
        ruleEngine.recordFailure(apiName, loopKey, "PRICE_MISMATCH");
        recordAudit(auditLogPath, {
          status: "REJECTED_OFFCHAIN",
          api: apiName,
          endpoint: endpointUrl,
          query,
          payTo: rawPayTo,
          amountUnits: probeAmountUnits,
          amountUsdc: formatUnits(probeUnits, 6),
          ruleCode: "PRICE_MISMATCH",
          reason,
        });
        return {
          ok: false,
          blockedBy: "rule-engine",
          code: "PRICE_MISMATCH",
          reason,
          api: apiName,
          query,
          endpoint: endpointUrl,
          payTo: rawPayTo,
          amountUsdc: formatUnits(probeUnits, 6),
        };
      }

      const ctx: McpPaymentContext = {
        api: apiName,
        query,
        endpointUrl,
        payTo: rawPayTo,
        amountUnits: probeAmountUnits,
      };

      try {
        const sim = await simulateAuthorize({
          payTo: rawPayTo as Address,
          amountUnits: probeUnits,
        });
        const resolvedTier: "sandbox" | "trusted" = sim.isSandbox ? "sandbox" : "trusted";
        ruleEngine.recordExecution(apiName, query, loopKey, rawPayTo);
        recordAudit(auditLogPath, {
          status: "ALLOWED",
          api: apiName,
          endpoint: endpointUrl,
          query,
          payTo: rawPayTo,
          amountUnits: probeAmountUnits,
          amountUsdc: formatUnits(probeUnits, 6),
          reason: `Mô phỏng AgentPolicy.authorize (${resolvedTier}) thành công (0 gas, chưa chuyển USDC thật).`,
          bypassRules: false,
        });
        return {
          ok: true,
          tier: resolvedTier,
          simulated: true,
          settled: false,
          api: apiName,
          query,
          endpoint: endpointUrl,
          payTo: rawPayTo,
          amountUsdc: formatUnits(probeUnits, 6),
          data: {
            simulated: true,
            settled: false,
            payTo: rawPayTo,
            amountUnits: probeAmountUnits,
            tier: resolvedTier,
            note: "Mô phỏng AgentPolicy.authorize thành công trên chuỗi (0 gas, không trừ hạn mức, chưa chuyển USDC thật).",
          },
        };
      } catch (err) {
        const outcome = formatErrorOutcome(err, ctx, auditLogPath, dashboardUrl, true);
        if (!outcome.ok && (outcome.blockedBy === "rule-engine" || outcome.blockedBy === "contract")) {
          ruleEngine.recordFailure(apiName, loopKey, outcome.code);
        } else {
          ruleEngine.recordAttempt(apiName);
        }
        return outcome;
      }
    }

    try {
      ruleEngine.enforceRateAndDedup(apiName, query, endpointUrl, loopKey, rawPayTo);
    } catch (err) {
      if (err instanceof RuleViolationError) {
        return toRuleViolationOutcome(err, {
          api: apiName,
          query,
          endpoint: endpointUrl,
          payTo: rawPayTo,
          hintForPromote: true,
        });
      }
      throw err;
    }

    const ctx: McpPaymentContext = {
      api: apiName,
      query,
      endpointUrl,
      payTo: rawPayTo,
    };

    return executePaidRequest({
      ctx,
      tier: "sandbox",
      recordKey: apiName,
      loopKey,
      dedupTarget: rawPayTo || endpointUrl,
      hintForPromote: true,
      onBeforePayment: async (asked) => {
        if (!isAddress(asked.payTo)) {
          const err = new McpGatewayRuleError(
            "INVALID_PAY_TO",
            `Địa chỉ nhận tiền từ 402 không hợp lệ: "${asked.payTo}"`,
          );
          ctx.lastError = err;
          recordAudit(auditLogPath, {
            status: "REJECTED_OFFCHAIN",
            api: ctx.api,
            endpoint: ctx.endpointUrl,
            query: ctx.query,
            payTo: asked.payTo,
            amountUnits: asked.amount,
            ruleCode: err.code,
            reason: err.reason,
          });
          throw err;
        }

        if (rawPayTo && asked.payTo.toLowerCase() !== rawPayTo.toLowerCase()) {
          const err = new McpGatewayRuleError(
            "INVALID_PAY_TO",
            `Địa chỉ nhận tiền 402 (${asked.payTo}) không khớp địa chỉ dự kiến (${rawPayTo})`,
          );
          ctx.lastError = err;
          recordAudit(auditLogPath, {
            status: "REJECTED_OFFCHAIN",
            api: ctx.api,
            endpoint: ctx.endpointUrl,
            query: ctx.query,
            payTo: asked.payTo,
            amountUnits: asked.amount,
            amountUsdc: formatUnits(BigInt(asked.amount), 6),
            ruleCode: err.code,
            reason: err.reason,
          });
          throw err;
        }

        const askedUnits = BigInt(asked.amount);
        if (askedUnits > maxPriceUnits) {
          const err = new McpGatewayRuleError(
            "PRICE_MISMATCH",
            `API lạ đòi ${formatUnits(askedUnits, 6)} USDC, vượt trần an toàn ngoài chuỗi ${maxPriceUsdc} USDC`,
          );
          ctx.lastError = err;
          recordAudit(auditLogPath, {
            status: "REJECTED_OFFCHAIN",
            api: ctx.api,
            endpoint: ctx.endpointUrl,
            query: ctx.query,
            payTo: asked.payTo,
            amountUnits: asked.amount,
            amountUsdc: formatUnits(askedUnits, 6),
            ruleCode: err.code,
            reason: err.reason,
          });
          throw err;
        }
      },
    });
  }

  /**
   * Tool 2: Calls a Trusted API (from catalog or promoted on-chain via Dashboard
   * "Chuyển thành API quen") using Trusted limits on AgentPolicy.
   */
  async function handleCallTrustedApi(input: CallTrustedApiInput): Promise<McpToolOutcome> {
    const apiKey = input.api?.trim() || "";
    const catalogEntry = apiKey ? ruleEngine.getApiEntry(apiKey) : undefined;

    let apiName = apiKey || "trusted_custom";
    let queryLabel = (input.query ?? "").trim();
    let endpointUrl = input.url?.trim() ?? "";
    let expectedPayTo: Address | undefined =
      input.payTo && isAddress(input.payTo) ? (input.payTo as Address) : undefined;

    if (input.payTo && !isAddress(input.payTo)) {
      const reason = `Địa chỉ payTo không hợp lệ: "${input.payTo}"`;
      recordAudit(auditLogPath, {
        status: "REJECTED_OFFCHAIN",
        api: apiName,
        endpoint: endpointUrl || input.payTo,
        query: queryLabel || "trusted-call",
        payTo: input.payTo,
        ruleCode: "INVALID_PAY_TO",
        reason,
      });
      return {
        ok: false,
        blockedBy: "rule-engine",
        code: "INVALID_PAY_TO",
        reason,
        api: apiName,
        query: queryLabel,
        endpoint: endpointUrl || input.payTo,
        payTo: input.payTo,
      };
    }

    if (catalogEntry) {
      apiName = catalogEntry.name;
      expectedPayTo = catalogEntry.payTo as Address;
      if (catalogEntry.name === "weather") {
        const city = queryLabel || "Da Lat";
        const days = Math.min(Math.max(Number(input.days ?? 3), 1), 3);
        queryLabel = city;
        endpointUrl =
          endpointUrl ||
          `${catalogEntry.baseUrl}?city=${encodeURIComponent(city)}&days=${days}`;
      } else if (catalogEntry.name === "rates") {
        const pair =
          input.from && input.to
            ? `${input.from.trim().toUpperCase()}/${input.to.trim().toUpperCase()}`
            : queryLabel || "USD/VND";
        queryLabel = pair;
        endpointUrl =
          endpointUrl || `${catalogEntry.baseUrl}?pair=${encodeURIComponent(pair)}`;
      } else {
        queryLabel = queryLabel || "default";
        endpointUrl = endpointUrl || catalogEntry.baseUrl;
      }
    } else {
      if (!endpointUrl) {
        const reason = `API "${apiName}" không có trong danh mục Trusted mặc định và chưa truyền \`url\`.`;
        recordAudit(auditLogPath, {
          status: "REJECTED_OFFCHAIN",
          api: apiName,
          endpoint: apiName,
          query: queryLabel || "trusted-call",
          ruleCode: "UNREGISTERED_API",
          reason,
        });
        return {
          ok: false,
          blockedBy: "rule-engine",
          code: "UNREGISTERED_API",
          reason,
          api: apiName,
          query: queryLabel,
          endpoint: apiName,
          hint: buildErrorHint({ code: "UNREGISTERED_API", dashboardUrl }),
        };
      }

      const urlCheck = validateApiUrl(endpointUrl);
      if (!urlCheck.ok) {
        recordAudit(auditLogPath, {
          status: "REJECTED_OFFCHAIN",
          api: apiName,
          endpoint: endpointUrl,
          query: queryLabel || "trusted-call",
          payTo: expectedPayTo,
          ruleCode: urlCheck.code,
          reason: urlCheck.reason,
        });
        return {
          ok: false,
          blockedBy: "rule-engine",
          code: urlCheck.code,
          reason: urlCheck.reason,
          api: apiName,
          query: queryLabel,
          endpoint: endpointUrl,
        };
      }

      if (!apiKey) {
        apiName = inferApiNameFromUrl(urlCheck.url);
      }
      queryLabel = queryLabel || urlCheck.url.search || "trusted-call";
    }

    const ctx: McpPaymentContext = {
      api: apiName,
      query: queryLabel,
      endpointUrl,
      payTo: expectedPayTo,
    };

    const trustedLoopKey = `trusted:${(expectedPayTo ?? apiName).toLowerCase()}`;
    const dedupTarget = expectedPayTo || endpointUrl;

    let preCheckedWhitelist: boolean | undefined;
    if (expectedPayTo && ruleEngine.hasFailureCode(trustedLoopKey, "NOT_WHITELISTED")) {
      preCheckedWhitelist = await checkWhitelist(expectedPayTo);
      if (preCheckedWhitelist) {
        ruleEngine.resetFailures(trustedLoopKey);
      }
    }

    try {
      if (catalogEntry) {
        ruleEngine.enforcePreRequest(catalogEntry.name, queryLabel, endpointUrl, trustedLoopKey);
      } else {
        ruleEngine.enforceRateAndDedup(apiName, queryLabel, endpointUrl, trustedLoopKey, expectedPayTo);
      }
    } catch (err) {
      if (err instanceof RuleViolationError) {
        return toRuleViolationOutcome(err, {
          api: apiName,
          query: queryLabel,
          endpoint: endpointUrl,
          payTo: expectedPayTo,
        });
      }
      throw err;
    }

    if (expectedPayTo) {
      const whitelisted = preCheckedWhitelist ?? (await checkWhitelist(expectedPayTo));
      if (!whitelisted) {
        ruleEngine.recordFailure(
          catalogEntry ? catalogEntry.name : apiName,
          trustedLoopKey,
          "NOT_WHITELISTED",
        );
        const reason = `Địa chỉ ${expectedPayTo} chưa nằm trong Whitelist trên AgentPolicy.`;
        recordAudit(auditLogPath, {
          status: "REJECTED_OFFCHAIN",
          api: apiName,
          endpoint: endpointUrl,
          query: queryLabel,
          payTo: expectedPayTo,
          ruleCode: "NOT_WHITELISTED",
          reason,
        });
        return {
          ok: false,
          blockedBy: "rule-engine",
          code: "NOT_WHITELISTED",
          reason,
          api: apiName,
          query: queryLabel,
          endpoint: endpointUrl,
          payTo: expectedPayTo,
          hint: buildErrorHint({
            code: "NOT_WHITELISTED",
            dashboardUrl,
            payTo: expectedPayTo,
          }),
        };
      }
    }

    return executePaidRequest({
      ctx,
      tier: "trusted",
      recordKey: catalogEntry ? catalogEntry.name : apiName,
      loopKey: trustedLoopKey,
      dedupTarget,
      onBeforePayment: async (asked) => {
        if (catalogEntry) {
          try {
            ruleEngine.enforcePaymentRequirements(
              catalogEntry.name,
              ctx.query,
              asked.payTo,
              asked.amount,
              ctx.endpointUrl,
            );
          } catch (err) {
            if (err instanceof RuleViolationError) {
              ctx.lastError = err;
            }
            throw err;
          }
          return;
        }

        if (!isAddress(asked.payTo)) {
          const err = new McpGatewayRuleError(
            "INVALID_PAY_TO",
            `Địa chỉ nhận tiền từ 402 không hợp lệ: "${asked.payTo}"`,
          );
          ctx.lastError = err;
          recordAudit(auditLogPath, {
            status: "REJECTED_OFFCHAIN",
            api: ctx.api,
            endpoint: ctx.endpointUrl,
            query: ctx.query,
            payTo: asked.payTo,
            amountUnits: asked.amount,
            ruleCode: err.code,
            reason: err.reason,
          });
          throw err;
        }

        if (expectedPayTo && asked.payTo.toLowerCase() !== expectedPayTo.toLowerCase()) {
          const err = new McpGatewayRuleError(
            "INVALID_PAY_TO",
            `Địa chỉ nhận tiền 402 (${asked.payTo}) không khớp payTo đã chỉ định (${expectedPayTo})`,
          );
          ctx.lastError = err;
          recordAudit(auditLogPath, {
            status: "REJECTED_OFFCHAIN",
            api: ctx.api,
            endpoint: ctx.endpointUrl,
            query: ctx.query,
            payTo: asked.payTo,
            amountUnits: asked.amount,
            amountUsdc: formatUnits(BigInt(asked.amount), 6),
            ruleCode: err.code,
            reason: err.reason,
          });
          throw err;
        }

        const whitelisted = await checkWhitelist(asked.payTo as Address);
        if (!whitelisted) {
          const err = new McpGatewayRuleError(
            "NOT_WHITELISTED",
            `Địa chỉ ${asked.payTo} chưa nằm trong Whitelist on-chain, không thể gọi qua call_trusted_api.`,
          );
          ctx.lastError = err;
          recordAudit(auditLogPath, {
            status: "REJECTED_OFFCHAIN",
            api: ctx.api,
            endpoint: ctx.endpointUrl,
            query: ctx.query,
            payTo: asked.payTo,
            amountUnits: asked.amount,
            amountUsdc: formatUnits(BigInt(asked.amount), 6),
            ruleCode: err.code,
            reason: err.reason,
          });
          throw err;
        }

        const askedUnits = BigInt(asked.amount);
        if (askedUnits > maxPriceUnits) {
          const err = new McpGatewayRuleError(
            "PRICE_MISMATCH",
            `API đòi ${formatUnits(askedUnits, 6)} USDC, vượt trần an toàn ngoài chuỗi ${maxPriceUsdc} USDC`,
          );
          ctx.lastError = err;
          recordAudit(auditLogPath, {
            status: "REJECTED_OFFCHAIN",
            api: ctx.api,
            endpoint: ctx.endpointUrl,
            query: ctx.query,
            payTo: asked.payTo,
            amountUnits: asked.amount,
            amountUsdc: formatUnits(askedUnits, 6),
            ruleCode: err.code,
            reason: err.reason,
          });
          throw err;
        }
      },
    });
  }

  /**
   * Optional read-only status helper so Side A can inspect current remaining caps and trusted APIs.
   */
  async function handleGetPolicyStatus() {
    const status = await getPolicyStatus();
    return {
      ok: true,
      policyAddress: status.policyAddress,
      dashboardUrl,
      paused: status.paused,
      usdcBalance: `${formatUnits(status.usdcBalanceUnits, 6)} USDC`,
      trustedCaps: {
        perTx: `${formatUnits(status.perTxCapUnits, 6)} USDC`,
        daily: `${formatUnits(status.dailyCapUnits, 6)} USDC`,
        remainingDaily: `${formatUnits(status.remainingDailyUnits, 6)} USDC`,
      },
      sandboxCaps: {
        perTx: `${formatUnits(status.sandboxPerTxCapUnits, 6)} USDC`,
        daily: `${formatUnits(status.sandboxDailyCapUnits, 6)} USDC`,
        remainingDaily: `${formatUnits(status.remainingSandboxDailyUnits, 6)} USDC`,
      },
      catalogApis: Object.values(catalog).map((entry) => ({
        name: entry.name,
        baseUrl: entry.baseUrl,
        payTo: entry.payTo,
        expectedPriceUsdc: formatUnits(entry.expectedPriceUnits, 6),
      })),
    };
  }

  return {
    handleTestUnknownApi,
    handleCallTrustedApi,
    handleGetPolicyStatus,
  };
}

export type McpGateway = ReturnType<typeof createMcpGateway>;

/**
 * Registers AgentLeash MCP tools on a standard McpServer instance.
 */
export function createAgentLeashMcpServer(gateway: McpGateway): McpServer {
  const server = new McpServer({
    name: "agentleash-gateway",
    version: "0.1.0",
  });

  server.registerTool(
    "test_unknown_api",
    {
      title: "Thử API lạ qua Sandbox AgentLeash",
      description:
        "Thử gọi một API lạ (chưa whitelist) qua lớp bảo vệ Sandbox + RuleEngine + AgentPolicy trên Avalanche Fuji. Trả dữ liệu nếu lọt ngưỡng Sandbox, hoặc lý do bị chặn tiếng Việt (cả off-chain và on-chain như ExceedsSandboxPerTxCap / PausedError) và ghi audit.json cho Dashboard.",
      inputSchema: {
        url: z.string().optional().describe("URL endpoint HTTP/HTTPS của API lạ cần thử nghiệm."),
        payTo: z
          .string()
          .optional()
          .describe("Địa chỉ ví nhận tiền EVM dự kiến (nếu không truyền url, server sẽ mô phỏng AgentPolicy.authorize bằng simulateContract — 0 gas, không trừ hạn mức)."),
        query: z.string().optional().describe("Chuỗi truy vấn thử nghiệm (dùng cho dedup & audit log)."),
        apiName: z.string().optional().describe("Tên gợi nhớ của API lạ trong audit log."),
        amountUsdc: z
          .string()
          .optional()
          .describe("Số USDC giả lập (mặc định 0.001) khi mô phỏng chỉ bằng payTo không có url."),
      },
    },
    async (args) => {
      const result = await gateway.handleTestUnknownApi(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !result.ok,
      };
    },
  );

  server.registerTool(
    "call_trusted_api",
    {
      title: "Gọi API quen (Trusted / Whitelist)",
      description:
        "Gọi API trong danh mục Trusted (weather, rates) hoặc API đã được chủ ví bấm 'Chuyển thành API quen' (whitelist on-chain) với hạn mức Trusted trên AgentPolicy, trả về dữ liệu và mã/link tx x402 trên Snowscan.",
      inputSchema: {
        api: z
          .string()
          .optional()
          .describe("Tên API trong danh mục ('weather', 'rates') hoặc tên API đã được whitelist."),
        query: z.string().optional().describe("Truy vấn (vd: 'Da Lat' cho weather, 'USD/VND' cho rates)."),
        url: z
          .string()
          .optional()
          .describe("URL cụ thể (bắt buộc nếu là API ngoài catalog đã được chủ ví bấm Chuyển thành API quen)."),
        payTo: z
          .string()
          .optional()
          .describe("Địa chỉ ví nhận tiền (tùy chọn để kiểm tra chéo whitelist trước khi gọi)."),
        days: z.number().int().min(1).max(3).optional().describe("Số ngày dự báo (1-3) khi gọi weather."),
        from: z.string().optional().describe("Mã tiền tệ nguồn (vd: USD) khi gọi rates."),
        to: z.string().optional().describe("Mã tiền tệ đích (vd: VND) khi gọi rates."),
      },
    },
    async (args) => {
      const result = await gateway.handleCallTrustedApi(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !result.ok,
      };
    },
  );

  server.registerTool(
    "get_policy_status",
    {
      title: "Xem hạn mức & danh mục AgentPolicy",
      description:
        "Đọc trạng thái AgentPolicy hiện tại trên Avalanche Fuji: số dư USDC, hạn mức Trusted/Sandbox còn lại, trạng thái Kill Switch và danh mục API mặc định.",
    },
    async () => {
      const status = await gateway.handleGetPolicyStatus();
      return {
        content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      };
    },
  );

  return server;
}

async function main() {
  // Bảo vệ luồng stdio JSON-RPC: mọi console.log từ signer/x402 đi qua stderr.
  console.log = (...args: unknown[]) => console.error(...args);
  console.info = (...args: unknown[]) => console.error(...args);

  // Tự nạp .env của repo để cấu hình MCP của mọi agent chỉ cần `node <đường dẫn>/mcp.ts`.
  loadRepoEnv();

  const policyAddress = (process.env.AGENT_POLICY_ADDRESS || "") as Address;
  const agentPrivateKey = (process.env.AGENT_PRIVATE_KEY || "") as Hex;
  const usdcAddress = (process.env.USDC_ADDRESS || DEFAULT_FUJI_USDC) as Address;
  const rpcUrl = process.env.FUJI_RPC_URL || DEFAULT_FUJI_RPC;
  const maxPriceUsdc = process.env.MAX_PRICE_USDC || "0.01";
  const dashboardUrl = normalizeDashboardUrl(process.env.DASHBOARD_URL);

  if (!isAddress(policyAddress)) {
    throw new Error(`Thiếu AGENT_POLICY_ADDRESS hợp lệ trong ${REPO_ENV_PATH}.`);
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(agentPrivateKey)) {
    throw new Error(`Thiếu AGENT_PRIVATE_KEY hợp lệ trong ${REPO_ENV_PATH}.`);
  }

  const gateway = createMcpGateway({
    policyAddress,
    agentPrivateKey,
    usdcAddress,
    rpcUrl,
    maxPriceUsdc,
    dashboardUrl,
    auditLogPath: DEFAULT_AUDIT_LOG_PATH,
  });

  const server = createAgentLeashMcpServer(gateway);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[AgentLeash MCP] Gateway stdio ready (policy ${policyAddress})`);
}

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  main().catch((err) => {
    console.error("[AgentLeash MCP Fatal]", err?.message || err);
    process.exit(1);
  });
}
