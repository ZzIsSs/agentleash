import { isAddress, parseUnits, formatUnits } from "viem";
import { appendAuditLog, DEFAULT_AUDIT_LOG_PATH } from "./log.ts";

export type RuleErrorCode =
  | "UNREGISTERED_API"
  | "INVALID_PAY_TO"
  | "PRICE_MISMATCH"
  | "RATE_LIMIT_EXCEEDED"
  | "DUPLICATE_QUERY";

export interface ApiCatalogEntry {
  name: string;
  baseUrl: string;
  payTo: string;
  expectedPriceUnits: bigint;
}

export interface RuleValidationResult {
  ok: boolean;
  code?: RuleErrorCode;
  reason?: string;
}

export class RuleViolationError extends Error {
  readonly code: RuleErrorCode;
  readonly reason: string;

  constructor(code: RuleErrorCode, reason: string) {
    super(`[${code}] ${reason}`);
    this.name = "RuleViolationError";
    this.code = code;
    this.reason = reason;
  }
}

export interface RuleEngineOptions {
  catalog?: Record<string, ApiCatalogEntry>;
  maxRequestsPerMinute?: number;
  rateWindowMs?: number;
  dedupWindowMs?: number;
  nowFn?: () => number;
  auditLogPath?: string | null;
}

function buildDefaultCatalog(): Record<string, ApiCatalogEntry> {
  const weatherPort = process.env.WEATHER_API_PORT || "4021";
  const weatherPayTo =
    process.env.WEATHER_PAY_TO || "0x9D014376C3296db41770015AF074CF4D14c075E1";
  const weatherPrice = process.env.WEATHER_PRICE_USDC || "0.001";

  const ratesPort = process.env.RATES_API_PORT || "4023";
  const ratesPayTo =
    process.env.RATES_PAY_TO || "0x8D299966B407e9f189C1920f5A7324F13a9a4110";
  const ratesPrice = process.env.RATES_PRICE_USDC || "0.001";

  return {
    weather: {
      name: "weather",
      baseUrl: `http://localhost:${weatherPort}/api/weather`,
      payTo: weatherPayTo,
      expectedPriceUnits: parseUnits(weatherPrice, 6),
    },
    rates: {
      name: "rates",
      baseUrl: `http://localhost:${ratesPort}/api/rates`,
      payTo: ratesPayTo,
      expectedPriceUnits: parseUnits(ratesPrice, 6),
    },
  };
}

export function getDefaultApiCatalog(): Record<string, ApiCatalogEntry> {
  return buildDefaultCatalog();
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Off-chain Rule Engine guarding agent spending before any on-chain transaction is submitted.
 */
export class RuleEngine {
  private readonly catalog: Record<string, ApiCatalogEntry>;
  private readonly maxRequestsPerMinute: number;
  private readonly rateWindowMs: number;
  private readonly dedupWindowMs: number;
  private readonly nowFn: () => number;
  private readonly auditLogPath: string | null;

  private readonly apiCallTimestamps = new Map<string, number[]>();
  private readonly queryHistory = new Map<string, number>();

  constructor(options: RuleEngineOptions = {}) {
    this.catalog = options.catalog ?? buildDefaultCatalog();
    this.maxRequestsPerMinute = options.maxRequestsPerMinute ?? 5;
    this.rateWindowMs = options.rateWindowMs ?? 60_000;
    this.dedupWindowMs = options.dedupWindowMs ?? 60_000;
    this.nowFn = options.nowFn ?? (() => Date.now());
    this.auditLogPath =
      options.auditLogPath === undefined
        ? DEFAULT_AUDIT_LOG_PATH
        : options.auditLogPath;
  }

  getApiEntry(api: string): ApiCatalogEntry | undefined {
    return this.catalog[api];
  }

  private pruneHistory(now: number): void {
    for (const [api, timestamps] of this.apiCallTimestamps.entries()) {
      const fresh = timestamps.filter((ts) => now - ts < this.rateWindowMs);
      this.apiCallTimestamps.set(api, fresh);
    }
    for (const [key, ts] of this.queryHistory.entries()) {
      if (now - ts >= this.dedupWindowMs) {
        this.queryHistory.delete(key);
      }
    }
  }

  /**
   * Validates request-level rules (API registration, rate limit, anti-spam deduplication)
   * before calling the seller endpoint.
   */
  validatePreRequest(api: string, query: string): RuleValidationResult {
    const entry = this.catalog[api];
    if (!entry) {
      return {
        ok: false,
        code: "UNREGISTERED_API",
        reason: `API chưa được đăng ký trong danh mục cho phép: "${api}"`,
      };
    }

    const now = this.nowFn();
    this.pruneHistory(now);

    const recentCalls = this.apiCallTimestamps.get(api) ?? [];
    if (recentCalls.length >= this.maxRequestsPerMinute) {
      return {
        ok: false,
        code: "RATE_LIMIT_EXCEEDED",
        reason: `Vượt tần suất gọi API "${api}" (tối đa ${this.maxRequestsPerMinute} lần/phút)`,
      };
    }

    const dedupKey = `${api}::${normalizeQuery(query)}`;
    const lastExecutedAt = this.queryHistory.get(dedupKey);
    if (lastExecutedAt !== undefined && now - lastExecutedAt < this.dedupWindowMs) {
      const waitSeconds = Math.ceil((this.dedupWindowMs - (now - lastExecutedAt)) / 1000);
      return {
        ok: false,
        code: "DUPLICATE_QUERY",
        reason: `Truy vấn trùng lặp trong thời gian ngắn cho API "${api}" ("${query.trim()}"), vui lòng thử lại sau ${waitSeconds}s`,
      };
    }

    return { ok: true };
  }

  /**
   * Validates the x402 402 payment requirements (recipient payTo and exact price)
   * before signing or submitting AgentPolicy.authorize on-chain.
   */
  validatePaymentRequirements(
    api: string,
    payTo: string,
    amountUnits: string | bigint,
  ): RuleValidationResult {
    const entry = this.catalog[api];
    if (!entry) {
      return {
        ok: false,
        code: "UNREGISTERED_API",
        reason: `API chưa được đăng ký trong danh mục cho phép: "${api}"`,
      };
    }

    if (!isAddress(payTo) || payTo.toLowerCase() !== entry.payTo.toLowerCase()) {
      return {
        ok: false,
        code: "INVALID_PAY_TO",
        reason: `Địa chỉ người nhận không hợp lệ cho API "${api}": nhận ${payTo}, kỳ vọng ${entry.payTo}`,
      };
    }

    let parsedAmount: bigint;
    try {
      parsedAmount = typeof amountUnits === "bigint" ? amountUnits : BigInt(amountUnits);
    } catch {
      return {
        ok: false,
        code: "PRICE_MISMATCH",
        reason: `Sai lệch bảng giá cho API "${api}": số tiền "${String(amountUnits)}" không hợp lệ`,
      };
    }

    if (parsedAmount !== entry.expectedPriceUnits) {
      const gotUsdc = formatUnits(parsedAmount, 6);
      const expectedUsdc = formatUnits(entry.expectedPriceUnits, 6);
      return {
        ok: false,
        code: "PRICE_MISMATCH",
        reason: `Sai lệch bảng giá cho API "${api}": yêu cầu ${gotUsdc} USDC (${parsedAmount} units), bảng giá niêm yết ${expectedUsdc} USDC (${entry.expectedPriceUnits} units)`,
      };
    }

    return { ok: true };
  }

  /**
   * Records a successful (or initiated) API call into rate-limit & deduplication windows.
   */
  recordExecution(api: string, query: string): void {
    const now = this.nowFn();
    this.pruneHistory(now);

    const calls = this.apiCallTimestamps.get(api) ?? [];
    calls.push(now);
    this.apiCallTimestamps.set(api, calls);

    const dedupKey = `${api}::${normalizeQuery(query)}`;
    this.queryHistory.set(dedupKey, now);
  }

  /**
   * Enforces pre-request rules, appending an audit log entry and throwing RuleViolationError if blocked.
   */
  enforcePreRequest(api: string, query: string, endpoint?: string): void {
    const res = this.validatePreRequest(api, query);
    if (!res.ok && res.code && res.reason) {
      if (this.auditLogPath) {
        appendAuditLog(
          {
            status: "REJECTED_OFFCHAIN",
            api,
            endpoint: endpoint ?? this.catalog[api]?.baseUrl ?? api,
            query,
            ruleCode: res.code,
            reason: res.reason,
          },
          this.auditLogPath,
        );
      }
      throw new RuleViolationError(res.code, res.reason);
    }
  }

  /**
   * Enforces 402 payment requirements, appending an audit log entry and throwing RuleViolationError if blocked.
   */
  enforcePaymentRequirements(
    api: string,
    query: string,
    payTo: string,
    amountUnits: string | bigint,
    endpoint?: string,
  ): void {
    const res = this.validatePaymentRequirements(api, payTo, amountUnits);
    if (!res.ok && res.code && res.reason) {
      if (this.auditLogPath) {
        let amountUsdc: string | undefined;
        try {
          const units = typeof amountUnits === "bigint" ? amountUnits : BigInt(amountUnits);
          amountUsdc = formatUnits(units, 6);
        } catch {
          amountUsdc = undefined;
        }
        appendAuditLog(
          {
            status: "REJECTED_OFFCHAIN",
            api,
            endpoint: endpoint ?? this.catalog[api]?.baseUrl ?? api,
            query,
            payTo,
            amountUnits: String(amountUnits),
            amountUsdc,
            ruleCode: res.code,
            reason: res.reason,
          },
          this.auditLogPath,
        );
      }
      throw new RuleViolationError(res.code, res.reason);
    }
  }
}
