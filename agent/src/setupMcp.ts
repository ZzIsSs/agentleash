/**
 * Một lệnh cài MCP AgentLeash cho Claude Code và Antigravity:
 *
 *   npm --prefix agent run setup:mcp            # ghi cấu hình cho agent nào có trên máy
 *   npm --prefix agent run setup:mcp -- --print # chỉ in cấu hình, không ghi gì
 *   npm --prefix agent run setup:mcp -- --only=claude | --only=antigravity
 *
 * Cấu hình chỉ gồm `node` (đường dẫn tuyệt đối) + đường dẫn thật tới `agent/src/mcp.ts`.
 * Không có `cwd`, `--env-file` hay khóa nào trong file cấu hình của agent: `mcp.ts` tự nạp
 * `.env` của repo (xem `envFile.ts`).
 */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { REPO_ENV_PATH } from "./envFile.ts";

export const SERVER_NAME = "agentleash";
export const REQUIRED_ENV_KEYS = ["AGENT_POLICY_ADDRESS", "AGENT_PRIVATE_KEY"] as const;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface StdioServerEntry {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export type AgentId = "claude" | "antigravity";

export interface SetupOptions {
  print: boolean;
  only: AgentId | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Lệnh chạy MCP mà mọi agent stdio đều hiểu: node tuyệt đối + file `mcp.ts`. */
export function buildServerEntry(nodePath: string, entryPath: string): StdioServerEntry {
  return { command: nodePath, args: [entryPath] };
}

/**
 * Dùng `realpath` cho `mcp.ts` để `process.argv[1]` khớp `import.meta.url` (điều kiện
 * `isEntrypoint` trong `mcp.ts`), kể cả khi đường dẫn khác hoa/thường ổ đĩa trên Windows.
 */
export function resolveDefaultEntry(): StdioServerEntry {
  return buildServerEntry(process.execPath, realpathSync.native(path.join(__dirname, "mcp.ts")));
}

export function parseArgs(argv: string[]): SetupOptions {
  const options: SetupOptions = { print: false, only: null };
  for (const arg of argv) {
    if (arg === "--print") options.print = true;
    else if (arg === "--only=claude") options.only = "claude";
    else if (arg === "--only=antigravity") options.only = "antigravity";
    else throw new Error(`Tham số không hợp lệ: ${arg}. Dùng --print, --only=claude hoặc --only=antigravity.`);
  }
  return options;
}

/** Trả về các khóa bắt buộc còn thiếu hoặc rỗng trong nội dung `.env` (không đọc giá trị ra ngoài). */
export function missingEnvKeys(envText: string): string[] {
  const parsed = parseEnv(envText);
  return REQUIRED_ENV_KEYS.filter((key) => !parsed[key]?.trim());
}

/**
 * Gộp server AgentLeash vào một file cấu hình dạng `{ "mcpServers": { ... } }` (Antigravity).
 * Giữ nguyên các server khác và mục `env` người dùng đã đặt cho `agentleash`; bỏ `cwd` cũ.
 * File rỗng được coi là `{}`. JSON hỏng thì báo lỗi, không ghi đè.
 */
export function mergeMcpServersConfig(
  raw: string,
  entry: StdioServerEntry,
  name: string = SERVER_NAME,
): { text: string; changed: boolean } {
  let config: Record<string, unknown> = {};
  if (raw.trim() !== "") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `File cấu hình không phải JSON hợp lệ (${(err as Error).message}). Sửa file rồi chạy lại; AgentLeash không ghi đè file hỏng.`,
      );
    }
    if (!isPlainObject(parsed)) throw new Error("File cấu hình phải là một object JSON.");
    config = parsed;
  }

  const servers = config.mcpServers ?? {};
  if (!isPlainObject(servers)) throw new Error('Trường "mcpServers" trong file cấu hình phải là object.');

  const previous = servers[name];
  const nextEntry: StdioServerEntry = { command: entry.command, args: [...entry.args] };
  const previousEnv = isPlainObject(previous) ? previous.env : undefined;
  if (entry.env) nextEntry.env = entry.env;
  else if (isPlainObject(previousEnv)) nextEntry.env = previousEnv as Record<string, string>;

  const next = { ...config, mcpServers: { ...servers, [name]: nextEntry } };
  return {
    text: JSON.stringify(next, null, 2) + "\n",
    changed: JSON.stringify(previous) !== JSON.stringify(nextEntry),
  };
}

/** Tham số cho `claude mcp add`, phạm vi `user` để Claude Code dùng được ở mọi thư mục dự án. */
export function buildClaudeAddArgs(entry: StdioServerEntry, name: string = SERVER_NAME): string[] {
  return ["mcp", "add", name, "--scope", "user", "--", entry.command, ...entry.args];
}

/**
 * Ghép dòng lệnh cho `cmd.exe` (Windows cần shell để chạy `claude.cmd`). Mọi tham số được
 * bọc ngoặc kép, nên đường dẫn có dấu cách hay dấu ngoặc như `OnlyC(ode)` vẫn an toàn.
 */
export function buildCmdLine(program: string, args: string[]): string {
  for (const arg of args) {
    if (/["%]/.test(arg)) {
      throw new Error(`Tham số chứa ký tự " hoặc % không truyền an toàn qua cmd.exe: ${arg}`);
    }
  }
  return [program, ...args.map((arg) => `"${arg}"`)].join(" ");
}

export function antigravityConfigPath(home: string = os.homedir()): string {
  return path.join(home, ".gemini", "config", "mcp_config.json");
}

function isAntigravityInstalled(home: string = os.homedir()): boolean {
  return existsSync(path.join(home, ".gemini", "antigravity")) || existsSync(antigravityConfigPath(home));
}

function runClaude(args: string[]): SpawnSyncReturns<string> {
  if (process.platform === "win32") {
    return spawnSync(buildCmdLine("claude", args), { shell: true, encoding: "utf-8" });
  }
  return spawnSync("claude", args, { encoding: "utf-8" });
}

function printCommand(entry: StdioServerEntry): void {
  console.log(`  command: ${entry.command}`);
  console.log(`  args:    ${JSON.stringify(entry.args)}`);
}

function setupClaude(entry: StdioServerEntry, options: SetupOptions): boolean {
  const addArgs = buildClaudeAddArgs(entry);
  const manual = `claude ${addArgs.map((a) => (/[\s()]/.test(a) ? `"${a}"` : a)).join(" ")}`;
  console.log("\n[Claude Code]");

  if (options.print) {
    console.log(`  Lệnh sẽ chạy: ${manual}`);
    return true;
  }

  const version = runClaude(["--version"]);
  if (version.error || version.status !== 0) {
    console.log("  Không tìm thấy lệnh `claude` trong PATH, bỏ qua. Cài Claude Code rồi chạy lại, hoặc tự chạy:");
    console.log(`  ${manual}`);
    return options.only !== "claude";
  }

  // `claude mcp add` báo lỗi nếu tên đã có, nên gỡ bản cũ trước (không có thì bỏ qua lỗi).
  runClaude(["mcp", "remove", SERVER_NAME, "--scope", "user"]);
  const added = runClaude(addArgs);
  if (added.error || added.status !== 0) {
    console.log("  Lỗi khi chạy `claude mcp add`:");
    console.log(`  ${(added.stderr || added.stdout || String(added.error)).trim()}`);
    console.log(`  Có thể tự chạy: ${manual}`);
    return false;
  }
  console.log(`  Đã thêm server "${SERVER_NAME}" (phạm vi user). Mở Claude Code, gõ /mcp để thấy 3 tool.`);
  return true;
}

function setupAntigravity(entry: StdioServerEntry, options: SetupOptions): boolean {
  const configPath = antigravityConfigPath();
  console.log("\n[Antigravity]");

  if (!isAntigravityInstalled() && options.only !== "antigravity") {
    console.log("  Không thấy thư mục ~/.gemini/antigravity, bỏ qua. Muốn ghi vẫn ghi thì chạy với --only=antigravity.");
    return true;
  }

  const raw = existsSync(configPath) ? readFileSync(configPath, "utf-8") : "";
  let merged: { text: string; changed: boolean };
  try {
    merged = mergeMcpServersConfig(raw, entry);
  } catch (err) {
    console.log(`  ${configPath}: ${(err as Error).message}`);
    return false;
  }

  if (options.print) {
    console.log(`  Sẽ ghi vào ${configPath}:`);
    console.log(merged.text.replace(/^/gm, "  "));
    return true;
  }
  if (!merged.changed) {
    console.log(`  ${configPath} đã có cấu hình đúng, không cần ghi lại.`);
    return true;
  }

  mkdirSync(path.dirname(configPath), { recursive: true });
  const backupPath = `${configPath}.agentleash.bak`;
  if (raw.trim() !== "" && !existsSync(backupPath)) {
    copyFileSync(configPath, backupPath);
    console.log(`  Đã sao lưu file cũ: ${backupPath}`);
  }
  writeFileSync(configPath, merged.text, "utf-8");
  console.log(`  Đã ghi server "${SERVER_NAME}" vào ${configPath}.`);
  console.log("  Trong Antigravity: … ở panel agent → MCP Servers → Manage MCP Servers → Refresh (hoặc khởi động lại).");
  return true;
}

export function main(argv: string[] = process.argv.slice(2)): number {
  let options: SetupOptions;
  try {
    options = parseArgs(argv);
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }

  if (!existsSync(REPO_ENV_PATH)) {
    console.error(`Chưa có ${REPO_ENV_PATH}. Chép .env.example thành .env rồi điền ${REQUIRED_ENV_KEYS.join(", ")}.`);
    return 1;
  }
  const missing = missingEnvKeys(readFileSync(REPO_ENV_PATH, "utf-8"));
  if (missing.length > 0) {
    console.error(`${REPO_ENV_PATH} còn thiếu: ${missing.join(", ")}. MCP sẽ không khởi động được nếu thiếu.`);
    return 1;
  }

  const entry = resolveDefaultEntry();
  console.log(`AgentLeash MCP${options.print ? " (chế độ --print, không ghi gì)" : ""}`);
  printCommand(entry);
  console.log(`  .env:    ${REPO_ENV_PATH} (mcp.ts tự nạp, khóa owner/facilitator không được nạp)`);

  let ok = true;
  if (options.only !== "antigravity") ok = setupClaude(entry, options) && ok;
  if (options.only !== "claude") ok = setupAntigravity(entry, options) && ok;
  return ok ? 0 : 1;
}

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  process.exitCode = main();
}
