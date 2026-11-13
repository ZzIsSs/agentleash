#!/usr/bin/env node
// Thu thập thông tin git cho skill session-log. Chỉ đọc, không sửa gì trong repo.
//
//   node thu-thap.mjs ghi                 -> dữ kiện để viết log cuối phiên
//   node thu-thap.mjs doc [so-log]        -> các log gần nhất (mặc định 3), kể cả log trên nhánh khác
//   node thu-thap.mjs kiem-tra <file>     -> quét file log tìm chuỗi giống bí mật (exit 1 nếu thấy)

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const THU_MUC_LOG = "docs/sessions";

function git(args, { cwd, allowFail = false } = {}) {
  try {
    return execFileSync("git", ["-c", "core.quotepath=off", ...args], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trimEnd();
  } catch (e) {
    if (allowFail) return "";
    throw e;
  }
}

function gocRepo() {
  try {
    return git(["rev-parse", "--show-toplevel"]);
  } catch {
    console.error("Không tìm thấy repo git. Hãy chạy lệnh này từ trong thư mục dự án.");
    process.exit(2);
  }
}

function slug(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function thoiGian() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return {
    tenFile: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`,
    hienThi: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

function danhSachLog(root) {
  const dir = join(root, THU_MUC_LOG);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}-\d{4}-.+\.md$/.test(f))
    .sort();
}

function commitCuoiTrongLog(noiDung) {
  const m = noiDung.match(/^commit_cuoi:\s*([0-9a-f]{7,40})\s*$/m);
  return m ? m[1] : null;
}

function ghi() {
  const root = gocRepo();
  const tg = thoiGian();
  const ten = git(["config", "user.name"], { cwd: root, allowFail: true }) || "khong-ro";
  const nhanh = git(["branch", "--show-current"], { cwd: root, allowFail: true }) || "(detached)";
  const head = git(["rev-parse", "--short", "HEAD"], { cwd: root, allowFail: true });

  const logs = danhSachLog(root);
  let moc = null;
  let logTruoc = null;
  for (let i = logs.length - 1; i >= 0 && !moc; i--) {
    const c = commitCuoiTrongLog(readFileSync(join(root, THU_MUC_LOG, logs[i]), "utf8"));
    if (c && git(["cat-file", "-t", c], { cwd: root, allowFail: true }) === "commit") {
      moc = c;
      logTruoc = logs[i];
    }
  }

  // Bỏ qua commit/file chỉ là log phiên, vì chúng không phải "thay đổi của phiên".
  const boLog = ["--", ".", `:(exclude)${THU_MUC_LOG}`];
  const fmt = ["--format=%h %ad %an: %s", "--date=format:%d/%m %H:%M"];
  const commits = moc
    ? git(["log", ...fmt, `${moc}..HEAD`, ...boLog], { cwd: root, allowFail: true })
    : git(["log", "-8", ...fmt, ...boLog], { cwd: root, allowFail: true });
  const statFromMoc = moc ? git(["diff", "--stat", `${moc}..HEAD`, ...boLog], { cwd: root, allowFail: true }) : "";
  const status = git(["status", "--short", "--untracked-files=all"],{ cwd: root, allowFail: true });
  const statChuaCommit = git(["diff", "HEAD", "--stat"], { cwd: root, allowFail: true });

  const nhayCam = status
    .split("\n")
    .filter((l) => /(^|\/)\.env(\.|$)|\.pem$|\.key$|secret|private/i.test(l) && !/\.env\.example/.test(l));

  const out = [];
  out.push(`# Dữ kiện cho log phiên`);
  out.push(``);
  out.push(`thoi_gian: ${tg.hienThi}`);
  out.push(`git_user: ${ten}  (slug gợi ý: ${slug(ten)})`);
  out.push(`nhanh: ${nhanh}`);
  out.push(`commit_cuoi (HEAD): ${head}`);
  out.push(`ten_file_goi_y: ${THU_MUC_LOG}/${tg.tenFile}-<nguoi>.md`);
  out.push(`log_truoc_do: ${logTruoc ?? "(chưa có log nào có mốc commit)"}`);
  out.push(``);
  out.push(moc ? `## Commit từ log trước (${moc}..HEAD)` : `## 8 commit gần nhất (chưa có mốc từ log trước)`);
  out.push(commits || "(không có commit mới)");
  if (statFromMoc) {
    out.push(``, `## File đổi qua các commit trên`, statFromMoc);
  }
  out.push(``, `## Thay đổi chưa commit (git status)`, status || "(sạch, không có gì chưa commit)");
  if (statChuaCommit) out.push(``, `## Số dòng đổi chưa commit`, statChuaCommit);
  if (nhayCam.length) {
    out.push(``, `## CẢNH BÁO: file có thể chứa bí mật, chỉ nhắc tên, không đọc nội dung`, ...nhayCam);
  }
  out.push(``, `Log hiện có trong ${THU_MUC_LOG}/: ${logs.length}`);
  console.log(out.join("\n"));
}

function doc(soLog = 3) {
  const root = gocRepo();
  const logs = danhSachLog(root);
  const out = [];
  const nhanh = git(["branch", "--show-current"], { cwd: root, allowFail: true });
  out.push(`# Log phiên gần nhất trên nhánh hiện tại (${nhanh || "detached"})`);
  if (!logs.length) out.push(`(chưa có log nào trong ${THU_MUC_LOG}/)`);
  for (const f of logs.slice(-soLog).reverse()) {
    out.push(``, `===== ${f} =====`, readFileSync(join(root, THU_MUC_LOG, f), "utf8").trim());
  }

  // Log nằm trên nhánh remote khác mà nhánh hiện tại chưa có (vd. Giang đang làm trên nhánh riêng, chưa merge).
  const coSan = new Set(logs);
  const refs = git(["for-each-ref", "--format=%(refname:short)", "refs/remotes"], { cwd: root, allowFail: true })
    .split("\n")
    .filter((r) => r && r.includes("/") && !r.endsWith("/HEAD"));
  const khac = [];
  for (const ref of refs) {
    const files = git(["ls-tree", "--name-only", `${ref}:${THU_MUC_LOG}`], { cwd: root, allowFail: true })
      .split("\n")
      .filter((f) => /^\d{4}-\d{2}-\d{2}-\d{4}-.+\.md$/.test(f) && !coSan.has(f));
    for (const f of files) khac.push({ ref, f });
  }
  khac.sort((a, b) => a.f.localeCompare(b.f));
  if (khac.length) {
    out.push(``, `# Log trên nhánh khác (chưa có ở nhánh này), mới nhất trước`);
    for (const { ref, f } of khac.slice(-soLog).reverse()) {
      out.push(``, `===== ${ref}: ${f} =====`, git(["show", `${ref}:${THU_MUC_LOG}/${f}`], { cwd: root, allowFail: true }).trim());
    }
    if (khac.length > soLog) out.push(``, `(còn ${khac.length - soLog} log cũ hơn trên nhánh khác)`);
  }
  const fetchHead = join(git(["rev-parse", "--git-dir"], { cwd: root }), "FETCH_HEAD");
  const pFetch = fetchHead.match(/^[A-Za-z]:|^\//) ? fetchHead : join(root, fetchHead);
  const lanFetch = existsSync(pFetch) ? statSync(pFetch).mtime.toLocaleString("vi-VN") : "chưa bao giờ";
  out.push(``, `(Log trên nhánh khác lấy theo lần git fetch/pull gần nhất: ${lanFetch}. Muốn mới hơn thì git fetch trước.)`);
  console.log(out.join("\n"));
}

function kiemTra(file) {
  if (!file || !existsSync(file)) {
    console.error("Cần đường dẫn file log: node thu-thap.mjs kiem-tra <file>");
    process.exit(2);
  }
  const s = readFileSync(file, "utf8");
  const mau = [
    [/0x[0-9a-fA-F]{64}\b/, "chuỗi giống private key (0x + 64 hex)"],
    [/(PRIVATE_KEY|SECRET|API_KEY|APP_SECRET|PASSWORD)\s*[=:]\s*\S{8,}/i, "biến bí mật kèm giá trị"],
    [/sk-[A-Za-z0-9_-]{20,}/, "chuỗi giống API key"],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "khối private key"],
  ];
  const thay = mau.filter(([re]) => re.test(s)).map(([, ten]) => ten);
  if (thay.length) {
    console.log(`KHÔNG ỔN: ${file} có ${thay.join("; ")}. Xóa giá trị đó khỏi log rồi kiểm tra lại.`);
    process.exit(1);
  }
  console.log(`OK: không thấy chuỗi giống bí mật trong ${file}.`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "ghi") ghi();
else if (cmd === "doc") doc(arg ? Number(arg) : 3);
else if (cmd === "kiem-tra") kiemTra(arg);
else {
  console.log("Dùng: node thu-thap.mjs ghi | doc [so-log] | kiem-tra <file>");
  process.exit(2);
}
