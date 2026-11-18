import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * `.env` ở gốc repo, tính theo vị trí file này (`agent/src` → `../../.env`) chứ không theo
 * thư mục đang đứng. Nhờ vậy Claude Code, Antigravity... chỉ cần `node <đường dẫn>/mcp.ts`,
 * không cần `cwd` hay `--env-file`.
 */
export const REPO_ENV_PATH = path.resolve(__dirname, "..", "..", ".env");

/**
 * Khóa ký của chủ ví (`PRIVATE_KEY`) và facilitator (`FACILITATOR_PRIVATE_KEY`) không được nạp,
 * vì MCP chỉ ký bằng khóa agent (Luật 3 & 4). Giữ `AGENT_PRIVATE_KEY`.
 */
export function isWithheldKey(key: string): boolean {
  return key.endsWith("PRIVATE_KEY") && key !== "AGENT_PRIVATE_KEY";
}

export interface LoadRepoEnvResult {
  loaded: boolean;
  filePath: string;
  withheld: string[];
}

/**
 * Nạp `.env` của repo vào `env`. Biến đã có sẵn (từ mục `env` trong cấu hình agent hoặc
 * `--env-file`) được giữ nguyên, giống quy tắc của `--env-file`.
 */
export function loadRepoEnv(
  options: { filePath?: string; env?: NodeJS.ProcessEnv } = {},
): LoadRepoEnvResult {
  const filePath = options.filePath ?? REPO_ENV_PATH;
  const env = options.env ?? process.env;
  if (!existsSync(filePath)) return { loaded: false, filePath, withheld: [] };

  const parsed = parseEnv(readFileSync(filePath, "utf-8"));
  const withheld: string[] = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (isWithheldKey(key)) {
      withheld.push(key);
      continue;
    }
    if (env[key] === undefined) env[key] = value;
  }
  return { loaded: true, filePath, withheld };
}
