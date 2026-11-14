#!/usr/bin/env node
// Hook Stop của Claude Code: nhắc nhẹ ghi nhật ký phiên (/session-log).
// Chỉ hiện một dòng cho người dùng, không chặn Claude. Tối đa 1 lần mỗi 45 phút.
// Nhắc khi: có file thay đổi chưa commit (ngoài docs/sessions/) mà chưa có file log mới hoặc đang sửa.

import { execFileSync } from "node:child_process";
import { existsSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

const KHOANG_NHAC_MS = 45 * 60 * 1000;

function git(args, cwd) {
  return execFileSync("git", ["-c", "core.quotepath=off", ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trimEnd();
}

try {
  const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const root = git(["rev-parse", "--show-toplevel"], cwd);
  const dong = git(["status", "--porcelain", "--untracked-files=all"], root).split("\n").filter(Boolean);
  const laLog = (l) => l.slice(3).startsWith("docs/sessions/");
  const coThayDoi = dong.some((l) => !laLog(l));
  const daCoLog = dong.some(laLog);
  if (!coThayDoi || daCoLog) process.exit(0);

  let gitDir = git(["rev-parse", "--git-dir"], root);
  if (!isAbsolute(gitDir)) gitDir = join(root, gitDir);
  const dau = join(gitDir, "session-log-da-nhac");
  if (existsSync(dau) && Date.now() - statSync(dau).mtimeMs < KHOANG_NHAC_MS) process.exit(0);
  writeFileSync(dau, new Date().toISOString());

  const soFile = dong.filter((l) => !laLog(l)).length;
  console.log(
    JSON.stringify({
      systemMessage: `📝 Có ${soFile} file thay đổi nhưng chưa ghi nhật ký phiên. Khi xong việc, gõ /session-log để để lại ghi chú bàn giao cho người kia.`,
    })
  );
} catch {
  // Không phải repo git hoặc git lỗi: im lặng, hook nhắc không được làm hỏng phiên.
}
process.exit(0);
