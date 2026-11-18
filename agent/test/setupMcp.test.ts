import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isWithheldKey, loadRepoEnv } from "../src/envFile.ts";
import {
  buildClaudeAddArgs,
  buildCmdLine,
  buildServerEntry,
  mergeMcpServersConfig,
  missingEnvKeys,
  parseArgs,
} from "../src/setupMcp.ts";

const ENTRY = buildServerEntry(
  "C:\\Program Files\\nodejs\\node.exe",
  "E:\\coder\\OnlyC(ode)\\agentleash\\agent\\src\\mcp.ts",
);

describe("loadRepoEnv", () => {
  let dir: string | null = null;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  function writeEnv(text: string): string {
    dir = mkdtempSync(path.join(os.tmpdir(), "agentleash-env-"));
    const filePath = path.join(dir, ".env");
    writeFileSync(filePath, text);
    return filePath;
  }

  it("nạp biến còn thiếu và giữ nguyên biến đã có từ cấu hình agent", () => {
    const filePath = writeEnv("AGENT_POLICY_ADDRESS=0xfile\nDASHBOARD_URL=http://localhost:3000\n");
    const env: NodeJS.ProcessEnv = { DASHBOARD_URL: "https://agentleash-two.vercel.app" };
    const result = loadRepoEnv({ filePath, env });
    expect(result.loaded).toBe(true);
    expect(env.AGENT_POLICY_ADDRESS).toBe("0xfile");
    expect(env.DASHBOARD_URL).toBe("https://agentleash-two.vercel.app");
  });

  it("không nạp khóa owner và facilitator, chỉ giữ khóa agent", () => {
    const filePath = writeEnv(
      "PRIVATE_KEY=0xowner\nFACILITATOR_PRIVATE_KEY=0xfac\nAGENT_PRIVATE_KEY=0xagent\n",
    );
    const env: NodeJS.ProcessEnv = {};
    const result = loadRepoEnv({ filePath, env });
    expect(env.AGENT_PRIVATE_KEY).toBe("0xagent");
    expect(env.PRIVATE_KEY).toBeUndefined();
    expect(env.FACILITATOR_PRIVATE_KEY).toBeUndefined();
    expect(result.withheld.sort()).toEqual(["FACILITATOR_PRIVATE_KEY", "PRIVATE_KEY"]);
    expect(isWithheldKey("AGENT_PRIVATE_KEY")).toBe(false);
  });

  it("không có file thì không làm gì", () => {
    const env: NodeJS.ProcessEnv = {};
    const result = loadRepoEnv({ filePath: path.join(os.tmpdir(), "khong-co-file.env"), env });
    expect(result.loaded).toBe(false);
    expect(env).toEqual({});
  });
});

describe("mergeMcpServersConfig", () => {
  it("file rỗng thành cấu hình chỉ có agentleash, không có cwd", () => {
    const { text, changed } = mergeMcpServersConfig("", ENTRY);
    expect(changed).toBe(true);
    expect(JSON.parse(text)).toEqual({
      mcpServers: { agentleash: { command: ENTRY.command, args: ENTRY.args } },
    });
  });

  it("giữ nguyên server khác, trường khác và env đã đặt; bỏ cấu hình cwd kiểu cũ", () => {
    const raw = JSON.stringify({
      someSetting: true,
      mcpServers: {
        notion: { serverUrl: "https://mcp.notion.com/mcp" },
        agentleash: {
          command: "node",
          args: ["--env-file=../.env", "src/mcp.ts"],
          cwd: "/old/agent",
          env: { DASHBOARD_URL: "https://agentleash-two.vercel.app" },
        },
      },
    });
    const config = JSON.parse(mergeMcpServersConfig(raw, ENTRY).text);
    expect(config.someSetting).toBe(true);
    expect(config.mcpServers.notion).toEqual({ serverUrl: "https://mcp.notion.com/mcp" });
    expect(config.mcpServers.agentleash).toEqual({
      command: ENTRY.command,
      args: ENTRY.args,
      env: { DASHBOARD_URL: "https://agentleash-two.vercel.app" },
    });
  });

  it("chạy lần hai không đổi gì", () => {
    const first = mergeMcpServersConfig("", ENTRY).text;
    const second = mergeMcpServersConfig(first, ENTRY);
    expect(second.changed).toBe(false);
    expect(second.text).toBe(first);
  });

  it("JSON hỏng hoặc sai kiểu thì báo lỗi, không ghi đè", () => {
    expect(() => mergeMcpServersConfig("{ hỏng", ENTRY)).toThrow(/không phải JSON hợp lệ/);
    expect(() => mergeMcpServersConfig("[]", ENTRY)).toThrow(/object JSON/);
    expect(() => mergeMcpServersConfig('{"mcpServers": []}', ENTRY)).toThrow(/mcpServers/);
  });
});

describe("lệnh Claude Code", () => {
  it("dùng phạm vi user và tách tham số của claude khỏi lệnh node bằng --", () => {
    expect(buildClaudeAddArgs(ENTRY)).toEqual([
      "mcp", "add", "agentleash", "--scope", "user", "--", ENTRY.command, ...ENTRY.args,
    ]);
  });

  it("bọc ngoặc kép mọi tham số cho cmd.exe, kể cả đường dẫn có dấu ngoặc", () => {
    expect(buildCmdLine("claude", ["mcp", "E:\\OnlyC(ode)\\mcp.ts"])).toBe(
      'claude "mcp" "E:\\OnlyC(ode)\\mcp.ts"',
    );
    expect(() => buildCmdLine("claude", ["%PATH%"])).toThrow(/cmd\.exe/);
  });
});

describe("tham số dòng lệnh và kiểm tra .env", () => {
  it("nhận --print và --only", () => {
    expect(parseArgs([])).toEqual({ print: false, only: null });
    expect(parseArgs(["--print", "--only=antigravity"])).toEqual({ print: true, only: "antigravity" });
    expect(() => parseArgs(["--only=cursor"])).toThrow(/không hợp lệ/);
  });

  it("báo khóa bắt buộc còn thiếu hoặc rỗng", () => {
    expect(missingEnvKeys("AGENT_POLICY_ADDRESS=0xabc\nAGENT_PRIVATE_KEY=\n")).toEqual(["AGENT_PRIVATE_KEY"]);
    expect(missingEnvKeys("AGENT_POLICY_ADDRESS=0xabc\nAGENT_PRIVATE_KEY=0xdef\n")).toEqual([]);
  });
});
