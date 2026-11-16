#!/usr/bin/env node
/**
 * Script kiểm tra và chuẩn bị nhanh trạng thái demo AgentLeash trên Avalanche Fuji + local services.
 *
 * Chạy kiểm tra (chỉ đọc, an toàn):
 *   node --env-file=.env scripts/seed-demo.mjs
 *
 * Tùy chọn tự áp dụng thay đổi nếu PRIVATE_KEY là chủ policy:
 *   node --env-file=.env scripts/seed-demo.mjs --apply
 *   node --env-file=.env scripts/seed-demo.mjs --apply --topup 0.02
 *   node --env-file=.env scripts/seed-demo.mjs --reset-logs
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const requireFromAgent = createRequire(path.join(REPO_ROOT, "agent", "package.json"));
const {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatEther,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  parseUnits,
} = requireFromAgent("viem");
const { privateKeyToAccount } = requireFromAgent("viem/accounts");
const { avalancheFuji } = requireFromAgent("viem/chains");

const DEFAULT_RPC = "https://api.avax-test.network/ext/bc/C/rpc";
const DEFAULT_USDC = "0x5425890298aed601595a70AB815c96711a31Bc65";
const DEFAULT_POLICY = "0x62Ea5e422b3ef66174B6Dd6Aa855F1f036894177";
const DEFAULT_WEATHER_PAY_TO = "0x9D014376C3296db41770015AF074CF4D14c075E1";
const DEFAULT_RATES_PAY_TO = "0x8D299966B407e9f189C1920f5A7324F13a9a4110";
const ERC8004_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

const DEMO_CAPS = {
  perTxCap: 2000n,
  dailyCap: 3000n,
  sandboxPerTxCap: 500n,
  sandboxDailyCap: 1000n,
};

const POLICY_ABI = parseAbi([
  "function owner() view returns (address)",
  "function agent() view returns (address)",
  "function paused() view returns (bool)",
  "function period() view returns (uint256)",
  "function perTxCap() view returns (uint256)",
  "function dailyCap() view returns (uint256)",
  "function sandboxPerTxCap() view returns (uint256)",
  "function sandboxDailyCap() view returns (uint256)",
  "function whitelist(address) view returns (bool)",
  "function getRemainingCaps() view returns (uint256 remainingDaily, uint256 remainingSandboxDaily, uint256 currentPeriodStart)",
  "function unpause()",
  "function setWhitelist(address payTo, bool allowed)",
  "function setCaps(uint256 _perTxCap, uint256 _dailyCap, uint256 _sandboxPerTxCap, uint256 _sandboxDailyCap)",
]);

const ERC8004_ABI = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);

function parseArgs(argv) {
  let apply = false;
  let resetLogs = false;
  let topupUsdc = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--apply") apply = true;
    else if (argv[i] === "--reset-logs") resetLogs = true;
    else if (argv[i] === "--topup" && argv[i + 1]) {
      topupUsdc = argv[i + 1];
      i += 1;
    }
  }
  return { apply, resetLogs, topupUsdc };
}

async function probe(name, url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    return { name, ok: res.ok, status: res.status };
  } catch {
    return { name, ok: false, status: "DOWN" };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rpcUrl = process.env.FUJI_RPC_URL || DEFAULT_RPC;
  const policyAddress = getAddress(process.env.AGENT_POLICY_ADDRESS || DEFAULT_POLICY);
  const usdcAddress = getAddress(process.env.USDC_ADDRESS || DEFAULT_USDC);
  const weatherPayTo = getAddress(process.env.WEATHER_PAY_TO || DEFAULT_WEATHER_PAY_TO);
  const ratesPayTo = getAddress(process.env.RATES_PAY_TO || DEFAULT_RATES_PAY_TO);

  const client = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl) });

  console.log("=== AgentLeash · Kiểm tra môi trường demo Fuji ===");
  console.log(`Policy contract : ${policyAddress}`);
  console.log(`USDC Fuji       : ${usdcAddress}`);
  console.log(`ERC-8004 Fuji   : ${ERC8004_REGISTRY}`);

  const [
    owner,
    agent,
    paused,
    period,
    perTxCap,
    dailyCap,
    sandboxPerTxCap,
    sandboxDailyCap,
    remaining,
    usdcBal,
    wlWeather,
    wlRates,
  ] = await Promise.all([
    client.readContract({ address: policyAddress, abi: POLICY_ABI, functionName: "owner" }),
    client.readContract({ address: policyAddress, abi: POLICY_ABI, functionName: "agent" }),
    client.readContract({ address: policyAddress, abi: POLICY_ABI, functionName: "paused" }),
    client.readContract({ address: policyAddress, abi: POLICY_ABI, functionName: "period" }),
    client.readContract({ address: policyAddress, abi: POLICY_ABI, functionName: "perTxCap" }),
    client.readContract({ address: policyAddress, abi: POLICY_ABI, functionName: "dailyCap" }),
    client.readContract({ address: policyAddress, abi: POLICY_ABI, functionName: "sandboxPerTxCap" }),
    client.readContract({ address: policyAddress, abi: POLICY_ABI, functionName: "sandboxDailyCap" }),
    client.readContract({ address: policyAddress, abi: POLICY_ABI, functionName: "getRemainingCaps" }),
    client.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "balanceOf", args: [policyAddress] }),
    client.readContract({ address: policyAddress, abi: POLICY_ABI, functionName: "whitelist", args: [weatherPayTo] }),
    client.readContract({ address: policyAddress, abi: POLICY_ABI, functionName: "whitelist", args: [ratesPayTo] }),
  ]);

  const [agentGas, erc8004Count] = await Promise.all([
    client.getBalance({ address: agent }),
    client.readContract({
      address: ERC8004_REGISTRY,
      abi: ERC8004_ABI,
      functionName: "balanceOf",
      args: [owner],
    }),
  ]);

  const [remDaily, remSandbox] = remaining;
  console.log(`Owner           : ${owner}`);
  console.log(`Agent EOA       : ${agent} (${Number(formatEther(agentGas)).toFixed(4)} AVAX)`);
  console.log(`Paused          : ${paused}`);
  console.log(`Period          : ${period} giây`);
  console.log(
    `Caps (USDC)     : perTx=${formatUnits(perTxCap, 6)} | daily=${formatUnits(dailyCap, 6)} | sandboxPerTx=${formatUnits(sandboxPerTxCap, 6)} | sandboxDaily=${formatUnits(sandboxDailyCap, 6)}`,
  );
  console.log(`Remaining       : daily=${formatUnits(remDaily, 6)} | sandbox=${formatUnits(remSandbox, 6)} USDC`);
  console.log(`USDC Balance    : ${formatUnits(usdcBal, 6)} USDC`);
  console.log(`Whitelist       : Weather=${wlWeather} (${weatherPayTo}) | Rates=${wlRates} (${ratesPayTo})`);
  console.log(`ERC-8004 NFT    : ${erc8004Count.toString()} hộ chiếu thuộc owner`);

  const services = await Promise.all([
    probe("Web (3000)", "http://localhost:3000/"),
    probe("Weather Seller (4021)", "http://127.0.0.1:4021/"),
    probe("Facilitator (4022)", "http://127.0.0.1:4022/supported"),
    probe("Rates Seller (4023)", "http://127.0.0.1:4023/"),
  ]);
  console.log("\n=== Dịch vụ local ===");
  for (const s of services) {
    console.log(`- ${s.name}: ${s.ok ? `OK (${s.status})` : `CHƯA SẴN SÀNG (${s.status})`}`);
  }

  const capsMatch =
    perTxCap === DEMO_CAPS.perTxCap &&
    dailyCap === DEMO_CAPS.dailyCap &&
    sandboxPerTxCap === DEMO_CAPS.sandboxPerTxCap &&
    sandboxDailyCap === DEMO_CAPS.sandboxDailyCap;

  if (args.resetLogs) {
    const logPath = path.join(REPO_ROOT, "agent", "logs", "audit.json");
    mkdirSync(path.dirname(logPath), { recursive: true });
    writeFileSync(logPath, "[]\n", "utf8");
    console.log("\n[OK] Đã làm sạch agent/logs/audit.json.");
  }

  const issues = [];
  if (paused) issues.push("Policy đang bị khóa (paused = true). Cần bấm MỞ KHÓA trước khi chạy agent.");
  if (!wlWeather) issues.push(`Weather (${weatherPayTo}) chưa vào whitelist.`);
  if (!wlRates) issues.push(`Rates (${ratesPayTo}) chưa vào whitelist.`);
  if (!capsMatch) issues.push("Hạn mức 4 ngưỡng chưa về mặc định demo (0.002 / 0.003 / 0.0005 / 0.001).");
  if (usdcBal < parseUnits("0.005", 6)) issues.push("Số dư USDC của policy < 0.005 USDC; cần nạp thêm USDC test Fuji.");
  if (agentGas === 0n) issues.push(`Ví agent ${agent} hết AVAX Fuji trả gas authorize().`);

  if (args.apply && process.env.PRIVATE_KEY) {
    const pk = process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`;
    const account = privateKeyToAccount(pk);
    const wallet = createWalletClient({ account, chain: avalancheFuji, transport: http(rpcUrl) });
    if (account.address.toLowerCase() !== owner.toLowerCase()) {
      console.log(
        `\n[Lưu ý] PRIVATE_KEY trong .env (${account.address}) không phải chủ policy (${owner} — ví Privy). Mở Dashboard tại http://localhost:3000 để chủ ví Privy ký mở khóa/whitelist/setCaps.`,
      );
    } else {
      if (paused) {
        const hash = await wallet.writeContract({ address: policyAddress, abi: POLICY_ABI, functionName: "unpause" });
        await client.waitForTransactionReceipt({ hash });
        console.log(`[OK] Đã unpause: ${hash}`);
      }
      if (!wlWeather) {
        const hash = await wallet.writeContract({
          address: policyAddress,
          abi: POLICY_ABI,
          functionName: "setWhitelist",
          args: [weatherPayTo, true],
        });
        await client.waitForTransactionReceipt({ hash });
        console.log(`[OK] Đã whitelist Weather: ${hash}`);
      }
      if (!wlRates) {
        const hash = await wallet.writeContract({
          address: policyAddress,
          abi: POLICY_ABI,
          functionName: "setWhitelist",
          args: [ratesPayTo, true],
        });
        await client.waitForTransactionReceipt({ hash });
        console.log(`[OK] Đã whitelist Rates: ${hash}`);
      }
      if (!capsMatch) {
        const hash = await wallet.writeContract({
          address: policyAddress,
          abi: POLICY_ABI,
          functionName: "setCaps",
          args: [DEMO_CAPS.perTxCap, DEMO_CAPS.dailyCap, DEMO_CAPS.sandboxPerTxCap, DEMO_CAPS.sandboxDailyCap],
        });
        await client.waitForTransactionReceipt({ hash });
        console.log(`[OK] Đã đặt lại caps mặc định demo: ${hash}`);
      }
    }
    if (args.topupUsdc) {
      const amount = parseUnits(args.topupUsdc, 6);
      const hash = await wallet.writeContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "transfer",
        args: [policyAddress, amount],
      });
      await client.waitForTransactionReceipt({ hash });
      console.log(`[OK] Đã nạp ${args.topupUsdc} USDC vào policy: ${hash}`);
    }
  }

  console.log("\n=== Kết luận ===");
  if (issues.length === 0) {
    console.log("SẴN SÀNG DEMO: policy đang mở, whitelist đủ 2 API, hạn mức khớp kịch bản, đủ USDC & gas.");
  } else {
    for (const issue of issues) {
      console.log(`- CẦN XỬ LÝ: ${issue}`);
    }
    if (!existsSync(path.join(REPO_ROOT, ".env"))) {
      console.log("- Gợi ý: sao chép .env.example thành .env nếu chưa cấu hình khóa test.");
    }
  }
}

main().catch((err) => {
  console.error("Lỗi seed-demo:", err?.message || err);
  process.exit(1);
});
