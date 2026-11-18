import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { getAddress, type Address, type Hex } from "viem";
import { readAuditLogs } from "../src/log.ts";
import {
  createAgentLeashMcpServer,
  createMcpGateway,
  DEFAULT_DASHBOARD_URL,
  validateApiUrl,
  type PayingFetchFactory,
} from "../src/mcp.ts";
import { PolicyOnChainRejectedError } from "../src/policySigner.ts";
import { RuleEngine, getDefaultApiCatalog } from "../src/rules.ts";

const POLICY_ADDR = "0x62Ea5e422b3ef66174B6Dd6Aa855F1f036894177" as Address;
const WEATHER_PAY_TO = "0x9D014376C3296db41770015AF074CF4D14c075E1" as Address;
const UNKNOWN_PAY_TO = "0x1111111111111111111111111111111111111111" as Address;
const SAMPLE_TX = ("0x" + "ab".repeat(32)) as Hex;

function encodePaymentResponse(txHash: Hex): string {
  return Buffer.from(
    JSON.stringify({ success: true, transaction: txHash, network: "eip155:43113" }),
    "utf-8",
  ).toString("base64");
}

function makeMockPayingFetch(behavior: {
  payTo: string;
  amount: string;
  txHash?: Hex;
  omitPaymentResponse?: boolean;
  isSandbox?: boolean;
  data?: unknown;
  status?: number;
  onAuthorizeError?: Error;
}): PayingFetchFactory {
  return ({ getContext, onBeforePayment }) =>
    async () => {
      const ctx = getContext();
      ctx.payTo = behavior.payTo;
      ctx.amountUnits = behavior.amount;

      await onBeforePayment({ payTo: behavior.payTo, amount: behavior.amount });

      if (behavior.onAuthorizeError) {
        if (behavior.onAuthorizeError instanceof PolicyOnChainRejectedError) {
          ctx.lastError = behavior.onAuthorizeError;
        }
        throw new Error(`Failed to create payment payload: ${behavior.onAuthorizeError.message}`);
      }

      if (behavior.txHash) {
        ctx.lastAuthorized = {
          txHash: behavior.txHash,
          payTo: behavior.payTo as Address,
          amount: BigInt(behavior.amount),
          validAfter: 0n,
          validBefore: 1_900_000_000n,
          nonce: ("0x" + "cc".repeat(32)) as Hex,
          blockNumber: 123n,
          isSandbox: behavior.isSandbox,
        };
      }

      return new Response(JSON.stringify(behavior.data ?? { ok: true }), {
        status: behavior.status ?? 200,
        headers: {
          "Content-Type": "application/json",
          ...(behavior.txHash && !behavior.omitPaymentResponse
            ? { "PAYMENT-RESPONSE": encodePaymentResponse(behavior.txHash) }
            : {}),
        },
      });
    };
}

describe("AgentLeash MCP Gateway", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir && existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  function createTempAuditPath(): string {
    const dir = mkdtempSync(path.join(os.tmpdir(), "agentleash-mcp-test-"));
    tempDirs.push(dir);
    return path.join(dir, "audit.json");
  }

  it("1. validateApiUrl cho phép http/https hợp lệ và chặn giao thức nguy hiểm / metadata SSRF", () => {
    expect(validateApiUrl("http://localhost:4021/api/weather?city=Da%20Lat").ok).toBe(true);
    expect(validateApiUrl("https://api.example.com/v1/price").ok).toBe(true);

    const fileRes = validateApiUrl("file:///etc/passwd");
    expect(fileRes.ok).toBe(false);
    if (!fileRes.ok) expect(fileRes.code).toBe("UNSAFE_URL");

    const ssrfRes = validateApiUrl("http://169.254.169.254/latest/meta-data");
    expect(ssrfRes.ok).toBe(false);
    if (!ssrfRes.ok) expect(ssrfRes.code).toBe("UNSAFE_URL");
  });

  it("2. test_unknown_api chặn off-chain URL không an toàn, sai payTo và giá vượt trần", async () => {
    const auditLogPath = createTempAuditPath();
    const gw = createMcpGateway(
      { policyAddress: POLICY_ADDR, maxPriceUsdc: "0.005", auditLogPath },
      {
        createPayingFetch: makeMockPayingFetch({
          payTo: UNKNOWN_PAY_TO,
          amount: "6000", // 0.006 > 0.005
          txHash: SAMPLE_TX,
        }),
      },
    );

    const unsafe = await gw.handleTestUnknownApi({ url: "http://169.254.169.254/secret", query: "q1" });
    expect(unsafe.ok).toBe(false);
    if (!unsafe.ok) {
      expect(unsafe.blockedBy).toBe("rule-engine");
      expect(unsafe.code).toBe("UNSAFE_URL");
    }

    const badPayTo = await gw.handleTestUnknownApi({ url: "https://example.com/api", payTo: "not-hex", query: "q2" });
    expect(badPayTo.ok).toBe(false);
    if (!badPayTo.ok) {
      expect(badPayTo.code).toBe("INVALID_PAY_TO");
    }

    const overPrice = await gw.handleTestUnknownApi({
      url: "https://example.com/expensive",
      payTo: UNKNOWN_PAY_TO,
      query: "q3",
    });
    expect(overPrice.ok).toBe(false);
    if (!overPrice.ok) {
      expect(overPrice.blockedBy).toBe("rule-engine");
      expect(overPrice.code).toBe("PRICE_MISMATCH");
      expect(overPrice.reason).toContain("0.006 USDC");
    }

    const logs = readAuditLogs(auditLogPath);
    expect(logs).toHaveLength(3);
    expect(logs.every((l) => l.status === "REJECTED_OFFCHAIN")).toBe(true);
  });

  it("3. test_unknown_api bắt revert on-chain (ExceedsSandboxPerTxCap, PausedError) và ghi audit.json cho Dashboard", async () => {
    const auditLogPath = createTempAuditPath();
    const gwCap = createMcpGateway(
      { policyAddress: POLICY_ADDR, maxPriceUsdc: "0.01", auditLogPath },
      {
        createPayingFetch: makeMockPayingFetch({
          payTo: UNKNOWN_PAY_TO,
          amount: "1000",
          onAuthorizeError: new PolicyOnChainRejectedError({
            errorName: "ExceedsSandboxPerTxCap",
            reason: "Vượt trần Sandbox mỗi giao dịch cho địa chỉ ngoài whitelist (sandboxPerTxCap)",
          }),
        }),
      },
    );

    const blockedCap = await gwCap.handleTestUnknownApi({
      url: "https://unknown-seller.example/data",
      query: "probe-1",
    });
    expect(blockedCap.ok).toBe(false);
    if (!blockedCap.ok) {
      expect(blockedCap.blockedBy).toBe("contract");
      expect(blockedCap.code).toBe("ExceedsSandboxPerTxCap");
      expect(blockedCap.reason).toContain("Sandbox");
      expect(blockedCap.payTo).toBe(UNKNOWN_PAY_TO);
      expect(blockedCap.hint).toContain("Chuyển thành API quen");
    }

    const gwPaused = createMcpGateway(
      { policyAddress: POLICY_ADDR, maxPriceUsdc: "0.01", auditLogPath },
      {
        createPayingFetch: makeMockPayingFetch({
          payTo: UNKNOWN_PAY_TO,
          amount: "500",
          onAuthorizeError: new PolicyOnChainRejectedError({
            errorName: "PausedError",
            reason: "Agent đang bị khóa khẩn cấp bởi Kill Switch (paused = true)",
          }),
        }),
      },
    );
    const blockedPaused = await gwPaused.handleTestUnknownApi({
      url: "https://unknown-seller.example/data2",
      query: "probe-2",
    });
    expect(blockedPaused.ok).toBe(false);
    if (!blockedPaused.ok) {
      expect(blockedPaused.blockedBy).toBe("contract");
      expect(blockedPaused.code).toBe("PausedError");
      expect(blockedPaused.reason).toContain("Kill Switch");
    }

    const logs = readAuditLogs(auditLogPath);
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      status: "REJECTED_ONCHAIN",
      payTo: UNKNOWN_PAY_TO,
      amountUnits: "1000",
      ruleCode: "ExceedsSandboxPerTxCap",
    });
    expect(logs[1]).toMatchObject({
      status: "REJECTED_ONCHAIN",
      ruleCode: "PausedError",
    });
  });

  it("4. test_unknown_api mô phỏng simulateContract khi chỉ truyền payTo (không ghi SETTLED), ghi SETTLED khi có url + PAYMENT-RESPONSE và chống lặp", async () => {
    const auditLogPath = createTempAuditPath();
    let now = 1_700_000_000_000;
    const ruleEngine = new RuleEngine({ auditLogPath, nowFn: () => now });

    const gwSim = createMcpGateway(
      { policyAddress: POLICY_ADDR, auditLogPath },
      {
        ruleEngine,
        simulateAuthorize: async ({ payTo, amountUnits }) => ({
          payTo,
          amountUnits,
          isSandbox: true,
        }),
      },
    );

    const passed = await gwSim.handleTestUnknownApi({
      payTo: UNKNOWN_PAY_TO,
      amountUsdc: "0.0005",
      apiName: "probe_unknown",
      query: "check-quality",
    });
    expect(passed.ok).toBe(true);
    if (passed.ok) {
      expect(passed.tier).toBe("sandbox");
      expect(passed.simulated).toBe(true);
      expect(passed.settled).toBe(false);
      expect(passed.amountUsdc).toBe("0.0005");
      expect(passed.txHash).toBeUndefined();
    }

    // Gọi lại cùng query trong 60s -> RuleEngine chặn DUPLICATE_QUERY
    now += 5_000;
    const dup = await gwSim.handleTestUnknownApi({
      payTo: UNKNOWN_PAY_TO,
      apiName: "probe_unknown",
      query: "check-quality",
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) {
      expect(dup.blockedBy).toBe("rule-engine");
      expect(dup.code).toBe("DUPLICATE_QUERY");
    }

    // Gọi URL thật không có PAYMENT-RESPONSE -> không ghi SETTLED (chỉ ALLOWED)
    const gwNoReceipt = createMcpGateway(
      { policyAddress: POLICY_ADDR, auditLogPath },
      {
        ruleEngine,
        createPayingFetch: makeMockPayingFetch({
          payTo: UNKNOWN_PAY_TO,
          amount: "500",
          txHash: SAMPLE_TX,
          omitPaymentResponse: true,
          isSandbox: true,
          data: { forecast: "Sunny" },
        }),
      },
    );
    const noReceiptRes = await gwNoReceipt.handleTestUnknownApi({
      url: "https://mock-402.example/data",
      query: "no-receipt",
    });
    expect(noReceiptRes.ok).toBe(true);
    if (noReceiptRes.ok) {
      expect(noReceiptRes.settled).toBe(false);
    }

    // Gọi URL thật đã whitelist (isSandbox=false) kèm PAYMENT-RESPONSE -> tier="trusted" và ghi SETTLED
    const gwTrustedUrl = createMcpGateway(
      { policyAddress: POLICY_ADDR, auditLogPath },
      {
        ruleEngine,
        createPayingFetch: makeMockPayingFetch({
          payTo: UNKNOWN_PAY_TO,
          amount: "1000",
          txHash: SAMPLE_TX,
          isSandbox: false,
          data: { forecast: "Clear" },
        }),
      },
    );
    const trustedViaUnknown = await gwTrustedUrl.handleTestUnknownApi({
      url: "https://promoted-seller.example/data",
      query: "after-promote",
    });
    expect(trustedViaUnknown.ok).toBe(true);
    if (trustedViaUnknown.ok) {
      expect(trustedViaUnknown.tier).toBe("trusted");
      expect(trustedViaUnknown.settled).toBe(true);
    }

    const logs = readAuditLogs(auditLogPath);
    expect(logs.map((l) => l.status)).toEqual(["ALLOWED", "REJECTED_OFFCHAIN", "ALLOWED", "SETTLED"]);
  });

  it("4b. test_unknown_api ngắt LOOP_DETECTED khi bị chặn liên tiếp cùng payTo", async () => {
    const auditLogPath = createTempAuditPath();
    const ruleEngine = new RuleEngine({ auditLogPath, maxConsecutiveFailures: 3, maxRequestsPerMinute: 10 });
    const gw = createMcpGateway(
      { policyAddress: POLICY_ADDR, auditLogPath },
      {
        ruleEngine,
        simulateAuthorize: async () => {
          throw new PolicyOnChainRejectedError({
            errorName: "ExceedsSandboxPerTxCap",
            reason: "Vượt trần Sandbox mỗi giao dịch",
          });
        },
      },
    );

    for (let i = 0; i < 3; i += 1) {
      const blocked = await gw.handleTestUnknownApi({
        payTo: UNKNOWN_PAY_TO,
        query: "same-probe",
      });
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.code).toBe("ExceedsSandboxPerTxCap");
      }
    }

    const looped = await gw.handleTestUnknownApi({
      payTo: UNKNOWN_PAY_TO,
      query: "same-probe",
    });
    expect(looped.ok).toBe(false);
    if (!looped.ok) {
      expect(looped.blockedBy).toBe("rule-engine");
      expect(looped.code).toBe("LOOP_DETECTED");
    }

    const logs = readAuditLogs(auditLogPath);
    expect(logs.map((l) => l.ruleCode)).toEqual([
      "ExceedsSandboxPerTxCap",
      "ExceedsSandboxPerTxCap",
      "ExceedsSandboxPerTxCap",
      "LOOP_DETECTED",
    ]);
  });

  it("5. call_trusted_api gọi được API catalog (weather) lẫn API vừa được Chuyển thành API quen và chặn API chưa whitelist", async () => {
    const auditLogPath = createTempAuditPath();
    const whitelistSet = new Set<string>([WEATHER_PAY_TO.toLowerCase()]);

    const gw = createMcpGateway(
      { policyAddress: POLICY_ADDR, auditLogPath, catalog: getDefaultApiCatalog() },
      {
        checkWhitelist: async (addr) => whitelistSet.has(addr.toLowerCase()),
        createPayingFetch: makeMockPayingFetch({
          payTo: WEATHER_PAY_TO,
          amount: "1000",
          txHash: SAMPLE_TX,
          data: { city: "Da Lat", temperatureC: 19 },
        }),
      },
    );

    // Gọi catalog API weather đã whitelist
    const weatherRes = await gw.handleCallTrustedApi({ api: "weather", query: "Da Lat", days: 2 });
    expect(weatherRes.ok).toBe(true);
    if (weatherRes.ok) {
      expect(weatherRes.tier).toBe("trusted");
      expect(weatherRes.txHash).toBe(SAMPLE_TX);
      expect(weatherRes.snowscanUrl).toContain(SAMPLE_TX);
      expect(weatherRes.data).toEqual({ city: "Da Lat", temperatureC: 19 });
    }

    // Gọi custom API khi chưa whitelist -> bị chặn NOT_WHITELISTED
    const notWhitelisted = await gw.handleCallTrustedApi({
      api: "custom_partner",
      url: "https://partner.example/api",
      payTo: UNKNOWN_PAY_TO,
      query: "btc",
    });
    expect(notWhitelisted.ok).toBe(false);
    if (!notWhitelisted.ok) {
      expect(notWhitelisted.code).toBe("NOT_WHITELISTED");
      expect(notWhitelisted.hint).toContain("Chuyển thành API quen");
    }

    // Giả lập user bấm "Chuyển thành API quen" on-chain -> whitelistSet thêm UNKNOWN_PAY_TO
    whitelistSet.add(UNKNOWN_PAY_TO.toLowerCase());
    const gwPromoted = createMcpGateway(
      { policyAddress: POLICY_ADDR, auditLogPath, catalog: getDefaultApiCatalog() },
      {
        checkWhitelist: async (addr) => whitelistSet.has(addr.toLowerCase()),
        createPayingFetch: makeMockPayingFetch({
          payTo: UNKNOWN_PAY_TO,
          amount: "1500",
          txHash: SAMPLE_TX,
          data: { partnerResult: "ok" },
        }),
      },
    );
    const promotedRes = await gwPromoted.handleCallTrustedApi({
      api: "custom_partner",
      url: "https://partner.example/api",
      payTo: UNKNOWN_PAY_TO,
      query: "btc",
    });
    expect(promotedRes.ok).toBe(true);
    if (promotedRes.ok) {
      expect(promotedRes.tier).toBe("trusted");
      expect(promotedRes.amountUsdc).toBe("0.0015");
      expect(promotedRes.txHash).toBe(SAMPLE_TX);
    }
  });

  it("6. McpServer expose đầy đủ tool qua giao thức MCP (InMemoryTransport)", async () => {
    const gateway = createMcpGateway(
      { policyAddress: POLICY_ADDR, auditLogPath: null },
      {
        checkWhitelist: async () => true,
        getPolicyStatus: async () => ({
          policyAddress: POLICY_ADDR,
          usdcBalanceUnits: 50_000n,
          perTxCapUnits: 2_000n,
          dailyCapUnits: 3_000n,
          sandboxPerTxCapUnits: 500n,
          sandboxDailyCapUnits: 1_000n,
          remainingDailyUnits: 3_000n,
          remainingSandboxDailyUnits: 1_000n,
          currentPeriodStart: 1_700_000_000n,
          paused: false,
        }),
        createPayingFetch: makeMockPayingFetch({
          payTo: WEATHER_PAY_TO,
          amount: "1000",
          txHash: SAMPLE_TX,
          data: { city: "Da Lat" },
        }),
      },
    );

    const server = createAgentLeashMcpServer(gateway);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const listed = await client.listTools();
    const names = listed.tools.map((t) => t.name);
    expect(names).toContain("test_unknown_api");
    expect(names).toContain("call_trusted_api");
    expect(names).toContain("get_policy_status");

    const statusResult = await client.callTool({ name: "get_policy_status", arguments: {} });
    expect(statusResult.isError).toBeFalsy();
    const statusContent = statusResult.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(statusContent[0].text).usdcBalance).toBe("0.05 USDC");

    const trustedResult = await client.callTool({
      name: "call_trusted_api",
      arguments: { api: "weather", query: "Da Lat" },
    });
    expect(trustedResult.isError).toBeFalsy();
    const trustedContent = trustedResult.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(trustedContent[0].text).txHash).toBe(SAMPLE_TX);

    await Promise.all([client.close(), server.close()]);
  });

  it("7. NEW-01: REQUEST_FAILED và HTTP_5xx không khóa LOOP_DETECTED (vẫn tính rate limit), và mở khóa sau loopWindowMs", async () => {
    const auditLogPath = createTempAuditPath();
    let now = 1_700_000_000_000;
    const targetAddr = "0x4444444444444444444444444444444444444444" as Address;

    // 7a. 3 lần REQUEST_FAILED khi API sập -> lần 4 bật API vẫn gọi được; 3 lần lỗi vẫn tính vào rate limit
    const ruleNet = new RuleEngine({
      auditLogPath,
      maxRequestsPerMinute: 5,
      maxConsecutiveFailures: 3,
      loopWindowMs: 60_000,
      nowFn: () => now,
    });
    let apiDown = true;
    let httpStatus = 200;
    const gwNet = createMcpGateway(
      { policyAddress: POLICY_ADDR, auditLogPath },
      {
        ruleEngine: ruleNet,
        checkWhitelist: async () => true,
        createPayingFetch: ({ getContext, onBeforePayment }) => async () => {
          if (apiDown) {
            throw new TypeError("fetch failed");
          }
          const ctx = getContext();
          ctx.payTo = targetAddr;
          ctx.amountUnits = "1000";
          await onBeforePayment({ payTo: targetAddr, amount: "1000" });
          if (httpStatus !== 200) {
            return new Response("upstream error", { status: httpStatus });
          }
          ctx.lastAuthorized = {
            txHash: SAMPLE_TX,
            payTo: targetAddr,
            amount: 1000n,
            validAfter: 0n,
            validBefore: 1_900_000_000n,
            nonce: ("0x" + "cc".repeat(32)) as Hex,
            blockNumber: 123n,
            isSandbox: false,
          };
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "PAYMENT-RESPONSE": encodePaymentResponse(SAMPLE_TX),
            },
          });
        },
      },
    );

    for (let i = 1; i <= 3; i += 1) {
      const failRes = await gwNet.handleCallTrustedApi({
        api: "partner_4444",
        url: "https://partner-4444.example/data",
        payTo: targetAddr,
        query: `q-${i}`,
      });
      expect(failRes.ok).toBe(false);
      if (!failRes.ok) {
        expect(failRes.blockedBy).toBe("http");
        expect(failRes.code).toBe("REQUEST_FAILED");
      }
      now += 1_000;
    }

    // Bật lại API -> không bị LOOP_DETECTED
    apiDown = false;
    const recovered = await gwNet.handleCallTrustedApi({
      api: "partner_4444",
      url: "https://partner-4444.example/data",
      payTo: targetAddr,
      query: "q-4",
    });
    expect(recovered.ok).toBe(true);

    // Thử thêm 1 lần HTTP 503 -> không tính loop, nhưng đủ 5 lần/phút nên lần 6 bị RATE_LIMIT_EXCEEDED
    httpStatus = 503;
    const http503 = await gwNet.handleCallTrustedApi({
      api: "partner_4444",
      url: "https://partner-4444.example/data",
      payTo: targetAddr,
      query: "q-5",
    });
    expect(http503.ok).toBe(false);
    if (!http503.ok) expect(http503.code).toBe("HTTP_503");

    httpStatus = 200;
    const rateBlocked = await gwNet.handleCallTrustedApi({
      api: "partner_4444",
      url: "https://partner-4444.example/data",
      payTo: targetAddr,
      query: "q-6",
    });
    expect(rateBlocked.ok).toBe(false);
    if (!rateBlocked.ok) expect(rateBlocked.code).toBe("RATE_LIMIT_EXCEEDED");

    // 7b. Contract chặn payTo=0x1111 3 lần -> lượt 4 bị LOOP_DETECTED, qua cửa sổ 60s -> gọi lại được
    const ruleContract = new RuleEngine({
      auditLogPath,
      maxRequestsPerMinute: 10,
      maxConsecutiveFailures: 3,
      loopWindowMs: 60_000,
      nowFn: () => now,
    });
    const gwContract = createMcpGateway(
      { policyAddress: POLICY_ADDR, auditLogPath },
      {
        ruleEngine: ruleContract,
        simulateAuthorize: async () => {
          throw new PolicyOnChainRejectedError({
            errorName: "ExceedsSandboxPerTxCap",
            reason: "Vượt trần Sandbox mỗi giao dịch",
          });
        },
      },
    );
    for (let i = 0; i < 3; i += 1) {
      const res = await gwContract.handleTestUnknownApi({ payTo: UNKNOWN_PAY_TO, query: "probe" });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe("ExceedsSandboxPerTxCap");
      now += 1_000;
    }
    const looped = await gwContract.handleTestUnknownApi({ payTo: UNKNOWN_PAY_TO, query: "probe" });
    expect(looped.ok).toBe(false);
    if (!looped.ok) {
      expect(looped.code).toBe("LOOP_DETECTED");
      expect(looped.reason).toContain(UNKNOWN_PAY_TO);
      expect(looped.reason).toContain("thử lại sau");
    }

    now += 60_000;
    const afterWindow = await gwContract.handleTestUnknownApi({ payTo: UNKNOWN_PAY_TO, query: "probe" });
    expect(afterWindow.ok).toBe(false);
    if (!afterWindow.ok) {
      // Đã qua cửa sổ loopWindowMs nên đi tiếp xuống contract thay vì LOOP_DETECTED
      expect(afterWindow.code).toBe("ExceedsSandboxPerTxCap");
    }
  });

  it("8. NEW-01: call_trusted_api tự reset khóa trusted:<payTo> khi NOT_WHITELISTED chuyển sang whitelist = true", async () => {
    const auditLogPath = createTempAuditPath();
    const whitelistSet = new Set<string>();
    const ruleEngine = new RuleEngine({
      auditLogPath,
      maxRequestsPerMinute: 10,
      maxConsecutiveFailures: 3,
      loopWindowMs: 60_000,
    });

    const gw = createMcpGateway(
      { policyAddress: POLICY_ADDR, auditLogPath },
      {
        ruleEngine,
        checkWhitelist: async (addr) => whitelistSet.has(addr.toLowerCase()),
        createPayingFetch: makeMockPayingFetch({
          payTo: UNKNOWN_PAY_TO,
          amount: "1000",
          txHash: SAMPLE_TX,
          data: { promoted: true },
        }),
      },
    );

    // 3 lần bị chặn NOT_WHITELISTED
    for (let i = 0; i < 3; i += 1) {
      const blocked = await gw.handleCallTrustedApi({
        api: "custom_partner",
        url: "https://partner.example/api",
        payTo: UNKNOWN_PAY_TO,
        query: "btc",
      });
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) expect(blocked.code).toBe("NOT_WHITELISTED");
    }

    // Chủ ví bấm Chuyển thành API quen -> checkWhitelist trả true -> call_trusted_api đi tiếp
    whitelistSet.add(UNKNOWN_PAY_TO.toLowerCase());
    const promoted = await gw.handleCallTrustedApi({
      api: "custom_partner",
      url: "https://partner.example/api",
      payTo: UNKNOWN_PAY_TO,
      query: "btc",
    });
    expect(promoted.ok).toBe(true);
    if (promoted.ok) {
      expect(promoted.tier).toBe("trusted");
      expect(promoted.data).toEqual({ promoted: true });
    }
  });

  it("9. NEW-02: test_unknown_api và call_trusted_api phân biệt dedup theo payTo khi dùng query mặc định", async () => {
    const auditLogPath = createTempAuditPath();
    const addrC = "0xcccccccccccccccccccccccccccccccccccccccc" as Address;
    const addrD = "0xdddddddddddddddddddddddddddddddddddddddd" as Address;
    const gw = createMcpGateway(
      { policyAddress: POLICY_ADDR, auditLogPath },
      {
        checkWhitelist: async () => true,
        simulateAuthorize: async ({ payTo, amountUnits }) => ({
          payTo,
          amountUnits,
          isSandbox: true,
        }),
        createPayingFetch: ({ getContext, onBeforePayment }) => async (input) => {
          const url = String(input);
          const payTo = url.includes("partner-c") ? addrC : addrD;
          const ctx = getContext();
          ctx.payTo = payTo;
          ctx.amountUnits = "1000";
          await onBeforePayment({ payTo, amount: "1000" });
          return new Response(JSON.stringify({ ok: true, payTo }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        },
      },
    );

    // Hai payTo khác nhau không truyền query -> cả hai đều qua ở test_unknown_api
    const simC = await gw.handleTestUnknownApi({ payTo: addrC });
    const simD = await gw.handleTestUnknownApi({ payTo: addrD });
    expect(simC.ok).toBe(true);
    expect(simD.ok).toBe(true);

    // Gọi lại đúng payTo addrC (dạng checksum hỗn hợp hoa/thường) không truyền query trong 60s -> DUPLICATE_QUERY
    const simCDup = await gw.handleTestUnknownApi({ payTo: getAddress(addrC) });
    expect(simCDup.ok).toBe(false);
    if (!simCDup.ok) expect(simCDup.code).toBe("DUPLICATE_QUERY");

    // call_trusted_api với hai payTo khác nhau dùng cùng apiName và query mặc định -> đều qua
    const trustedC = await gw.handleCallTrustedApi({
      api: "shared_partner",
      url: "https://partner-c.example/api",
      payTo: addrC,
    });
    const trustedD = await gw.handleCallTrustedApi({
      api: "shared_partner",
      url: "https://partner-d.example/api",
      payTo: addrD,
    });
    expect(trustedC.ok).toBe(true);
    expect(trustedD.ok).toBe(true);

    const trustedCDup = await gw.handleCallTrustedApi({
      api: "shared_partner",
      url: "https://partner-c.example/api",
      payTo: addrC,
    });
    expect(trustedCDup.ok).toBe(false);
    if (!trustedCDup.ok) expect(trustedCDup.code).toBe("DUPLICATE_QUERY");
  });

  it("10. hint trả về đúng dashboardUrl (mặc định và custom) ở NOT_WHITELISTED, vượt hạn mức và PausedError", async () => {
    const auditLogPath = createTempAuditPath();
    const customDashboardUrl = "https://agentleash-demo.vercel.app";

    // 10a. Mặc định dùng DEFAULT_DASHBOARD_URL (http://localhost:3000)
    const gwDefault = createMcpGateway(
      { policyAddress: POLICY_ADDR, auditLogPath },
      {
        checkWhitelist: async () => false,
        getPolicyStatus: async () => ({
          policyAddress: POLICY_ADDR,
          usdcBalanceUnits: 50_000n,
          perTxCapUnits: 2_000n,
          dailyCapUnits: 3_000n,
          sandboxPerTxCapUnits: 500n,
          sandboxDailyCapUnits: 1_000n,
          remainingDailyUnits: 3_000n,
          remainingSandboxDailyUnits: 1_000n,
          currentPeriodStart: 1_700_000_000n,
          paused: false,
        }),
        simulateAuthorize: async () => {
          throw new PolicyOnChainRejectedError({
            errorName: "ExceedsSandboxPerTxCap",
            reason: "Vượt trần Sandbox mỗi giao dịch cho địa chỉ ngoài whitelist (sandboxPerTxCap)",
          });
        },
        createPayingFetch: makeMockPayingFetch({
          payTo: UNKNOWN_PAY_TO,
          amount: "1000",
          onAuthorizeError: new PolicyOnChainRejectedError({
            errorName: "PausedError",
            reason: "Agent đang bị khóa khẩn cấp bởi Kill Switch (paused = true)",
          }),
        }),
      },
    );

    const statusDefault = await gwDefault.handleGetPolicyStatus();
    expect(statusDefault.dashboardUrl).toBe(DEFAULT_DASHBOARD_URL);

    const notWhitelistedDefault = await gwDefault.handleCallTrustedApi({
      api: "custom_partner",
      url: "https://partner.example/api",
      payTo: UNKNOWN_PAY_TO,
      query: "q-not-wl",
    });
    expect(notWhitelistedDefault.ok).toBe(false);
    if (!notWhitelistedDefault.ok) {
      expect(notWhitelistedDefault.code).toBe("NOT_WHITELISTED");
      expect(notWhitelistedDefault.hint).toContain(DEFAULT_DASHBOARD_URL);
      expect(notWhitelistedDefault.hint).toContain("Chuyển thành API quen");
    }

    const sandboxCapDefault = await gwDefault.handleTestUnknownApi({
      payTo: UNKNOWN_PAY_TO,
      query: "q-sandbox-cap",
    });
    expect(sandboxCapDefault.ok).toBe(false);
    if (!sandboxCapDefault.ok) {
      expect(sandboxCapDefault.code).toBe("ExceedsSandboxPerTxCap");
      expect(sandboxCapDefault.hint).toContain(`Địa chỉ ${UNKNOWN_PAY_TO} đã được ghi nhận`);
      expect(sandboxCapDefault.hint).toContain(DEFAULT_DASHBOARD_URL);
      expect(sandboxCapDefault.hint).toContain("Chuyển thành API quen");
      expect(sandboxCapDefault.hint).toContain("setCaps");
    }

    const pausedDefault = await gwDefault.handleTestUnknownApi({
      url: "https://unknown-paused.example/api",
      query: "q-paused",
    });
    expect(pausedDefault.ok).toBe(false);
    if (!pausedDefault.ok) {
      expect(pausedDefault.code).toBe("PausedError");
      expect(pausedDefault.hint).toContain(DEFAULT_DASHBOARD_URL);
      expect(pausedDefault.hint).toContain("Mở khóa");
    }

    // 10b. Custom dashboardUrl (kèm trailing slash được chuẩn hóa bỏ dấu / cuối)
    const gwCustom = createMcpGateway(
      { policyAddress: POLICY_ADDR, auditLogPath, dashboardUrl: `${customDashboardUrl}/` },
      {
        checkWhitelist: async (addr) => addr.toLowerCase() === WEATHER_PAY_TO.toLowerCase(),
        getPolicyStatus: async () => ({
          policyAddress: POLICY_ADDR,
          usdcBalanceUnits: 50_000n,
          perTxCapUnits: 2_000n,
          dailyCapUnits: 3_000n,
          sandboxPerTxCapUnits: 500n,
          sandboxDailyCapUnits: 1_000n,
          remainingDailyUnits: 0n,
          remainingSandboxDailyUnits: 0n,
          currentPeriodStart: 1_700_000_000n,
          paused: true,
        }),
        simulateAuthorize: async () => {
          throw new PolicyOnChainRejectedError({
            errorName: "ExceedsDailyCap",
            reason: "Vượt hạn mức chi tiêu trong chu kỳ (dailyCap)",
          });
        },
        createPayingFetch: makeMockPayingFetch({
          payTo: UNKNOWN_PAY_TO,
          amount: "1000",
        }),
      },
    );

    const statusCustom = await gwCustom.handleGetPolicyStatus();
    expect(statusCustom.dashboardUrl).toBe(customDashboardUrl);

    // NOT_WHITELISTED từ onBeforePayment khi gọi custom URL không truyền payTo trước
    const notWhitelistedFrom402 = await gwCustom.handleCallTrustedApi({
      api: "unknown_402_partner",
      url: "https://partner-no-payto.example/api",
      query: "q-402-not-wl",
    });
    expect(notWhitelistedFrom402.ok).toBe(false);
    if (!notWhitelistedFrom402.ok) {
      expect(notWhitelistedFrom402.code).toBe("NOT_WHITELISTED");
      expect(notWhitelistedFrom402.hint).toContain(customDashboardUrl);
      expect(notWhitelistedFrom402.hint).not.toContain(`${customDashboardUrl}/`);
      expect(notWhitelistedFrom402.hint).toContain("Chuyển thành API quen");
    }

    // ExceedsDailyCap trong handleTestUnknownApi
    const dailyCapCustom = await gwCustom.handleTestUnknownApi({
      payTo: UNKNOWN_PAY_TO,
      query: "q-daily-cap",
    });
    expect(dailyCapCustom.ok).toBe(false);
    if (!dailyCapCustom.ok) {
      expect(dailyCapCustom.code).toBe("ExceedsDailyCap");
      expect(dailyCapCustom.hint).toContain(customDashboardUrl);
      expect(dailyCapCustom.hint).toContain("setCaps");
    }

    // PausedError trong handleCallTrustedApi với trusted API weather
    const gwCustomPaused = createMcpGateway(
      { policyAddress: POLICY_ADDR, auditLogPath, dashboardUrl: customDashboardUrl },
      {
        checkWhitelist: async () => true,
        createPayingFetch: makeMockPayingFetch({
          payTo: WEATHER_PAY_TO,
          amount: "1000",
          onAuthorizeError: new PolicyOnChainRejectedError({
            errorName: "PausedError",
            reason: "Agent đang bị khóa khẩn cấp bởi Kill Switch (paused = true)",
          }),
        }),
      },
    );
    const pausedTrusted = await gwCustomPaused.handleCallTrustedApi({
      api: "weather",
      query: "Da Lat",
    });
    expect(pausedTrusted.ok).toBe(false);
    if (!pausedTrusted.ok) {
      expect(pausedTrusted.code).toBe("PausedError");
      expect(pausedTrusted.hint).toContain(customDashboardUrl);
      expect(pausedTrusted.hint).toContain("Mở khóa");
    }
  });
});
