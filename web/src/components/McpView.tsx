"use client";

import Link from "next/link";
import { useId, useSyncExternalStore } from "react";
import { addressUrl, shortAddress } from "@/lib/chain";
import { useConsole } from "./ConsoleProvider";
import { CopyButton } from "./CopyButton";
import { ArrowUpRightIcon, TerminalIcon } from "./Icons";

const MCP_TOOLS = [
  {
    name: "get_policy_status",
    tier: "Chỉ đọc (0 gas)",
    tierClass: "border-flow/35 bg-flow/10 text-flow-text",
    description:
      "Đọc số dư USDC, hạn mức Trusted/Sandbox còn lại trong chu kỳ, trạng thái Kill Switch và danh mục API trên Fuji.",
  },
  {
    name: "test_unknown_api",
    tier: "Tầng 2 · Sandbox",
    tierClass: "border-sandbox/35 bg-sandbox/10 text-sandbox-text",
    description:
      "Thử nghiệm API lạ (ngoài whitelist) qua RuleEngine chống SSRF + trần Sandbox; trả lý do chặn tiếng Việt kèm link Dashboard nếu vượt ngưỡng.",
  },
  {
    name: "call_trusted_api",
    tier: "Tầng 1 · Whitelist",
    tierClass: "border-trusted/30 bg-trusted/10 text-trusted-text",
    description:
      "Gọi API trong danh mục (weather, rates) hoặc API đã được chủ ví bấm Chuyển thành API quen trên Dashboard, trả dữ liệu và link tx Snowscan.",
  },
] as const;

const subscribeNoop = () => () => {};
const getClientOrigin = () => window.location.origin;
const getServerOrigin = () => "http://localhost:3000";

/** Trang /mcp — Hướng dẫn kết nối MCP Gateway Bên A – Bên B (chỉ đọc cấu hình, không giả lập giao dịch). */
export function McpView() {
  const { policy } = useConsole();
  const setupCmdId = useId();
  const runCmdId = useId();
  const jsonRegionId = useId();

  const setupCmd = "npm --prefix agent run setup:mcp";
  // Máy của nhóm chạy Windows nên lệnh chép mặc định dùng cú pháp PowerShell; bản bash in kèm bên dưới.
  const runWithPolicyCmd = `$env:AGENT_POLICY_ADDRESS="${policy}"; npm --prefix agent run mcp`;
  const runWithPolicyBashCmd = `AGENT_POLICY_ADDRESS=${policy} npm --prefix agent run mcp`;
  const dashboardOrigin = useSyncExternalStore(subscribeNoop, getClientOrigin, getServerOrigin);

  const mcpJsonSnippet = JSON.stringify(
    {
      mcpServers: {
        agentleash: {
          command: "node",
          // Client MCP không chạy từ gốc repo, nên đường dẫn phải tuyệt đối (setup:mcp tự điền đúng).
          args: ["<ĐƯỜNG_DẪN_TUYỆT_ĐỐI>/agentleash/agent/src/mcp.ts"],
          env: {
            AGENT_POLICY_ADDRESS: policy,
            DASHBOARD_URL: dashboardOrigin,
          },
        },
      },
    },
    null,
    2,
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/90 px-4 py-3.5 backdrop-blur-sm sm:px-5">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            MCP Bên A – Bên B
          </h1>
          <p className="mt-0.5 text-xs leading-relaxed text-muted sm:text-sm">
            Kết nối <code className="font-mono text-foreground">agent/src/mcp.ts</code> làm cổng kiểm soát chi tiêu x402
            cho Claude Code hoặc Antigravity với địa chỉ <code className="font-mono text-flow-text">AgentPolicy</code>{" "}
            đang chọn.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-md border border-flow/35 bg-flow/10 px-2.5 py-1 font-mono text-xs font-medium text-flow-text">
          <TerminalIcon className="h-3.5 w-3.5" />
          <span>stdio · {shortAddress(policy)}</span>
        </span>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Cột trái: 1 lệnh cài đặt & chạy */}
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card/90 p-4 backdrop-blur-sm sm:p-5 xl:col-span-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Cài đặt 1 lệnh cho Claude Code & Antigravity
            </h2>
            <a
              href={addressUrl(policy)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-flow hover:text-flow-text hover:underline"
            >
              {shortAddress(policy)}
              <ArrowUpRightIcon className="h-3 w-3" />
            </a>
          </div>

          <p className="text-xs leading-relaxed text-muted sm:text-sm">
            Lệnh <code className="font-mono text-foreground">setup:mcp</code> đọc{" "}
            <code className="font-mono text-foreground">agent/src/setupMcp.ts</code> và tự ghi đường dẫn tuyệt đối tới{" "}
            <code className="font-mono text-foreground">agent/src/mcp.ts</code> vào cấu hình MCP của Claude Code hoặc
            Antigravity trên máy local (có thể thêm <code className="font-mono text-foreground">-- --only=claude</code>{" "}
            hoặc <code className="font-mono text-foreground">-- --only=antigravity</code>).
          </p>

          <div className="flex flex-col gap-2 rounded-lg bg-surface-inset p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span id={setupCmdId} className="text-xs font-semibold text-foreground">
                1. Tự động cài vào Bên A (chạy tại gốc repo)
              </span>
              <CopyButton text={setupCmd} idleLabel="Chép lệnh" ariaLabel="Chép lệnh setup MCP" />
            </div>
            <pre
              role="region"
              aria-labelledby={setupCmdId}
              tabIndex={0}
              className="overflow-x-auto rounded-lg border border-border bg-background/80 p-3 font-mono text-xs text-flow-text"
            >
              <code>{setupCmd}</code>
            </pre>
          </div>

          <div className="flex flex-col gap-2 rounded-lg bg-surface-inset p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span id={runCmdId} className="text-xs font-semibold text-foreground">
                2. Chạy thủ công với Policy đang chọn
              </span>
              <CopyButton
                text={runWithPolicyCmd}
                idleLabel="Chép lệnh"
                ariaLabel="Chép lệnh chạy MCP server với Policy hiện tại"
              />
            </div>
            <pre
              role="region"
              aria-labelledby={runCmdId}
              tabIndex={0}
              className="overflow-x-auto rounded-lg border border-border bg-background/80 p-3 font-mono text-xs text-foreground"
            >
              <code>{runWithPolicyCmd}</code>
            </pre>
            <p className="text-xs leading-relaxed text-muted">
              Lệnh trên dùng cho PowerShell. Với bash/zsh:{" "}
              <code className="break-all font-mono text-foreground">{runWithPolicyBashCmd}</code>
            </p>
            <p className="text-xs leading-relaxed text-muted">
              <code className="font-mono text-foreground">mcp.ts</code> tự nạp{" "}
              <code className="font-mono text-foreground">.env</code> ở gốc repo để lấy{" "}
              <code className="font-mono text-foreground">AGENT_PRIVATE_KEY</code> và{" "}
              <code className="font-mono text-foreground">AGENT_POLICY_ADDRESS</code> (không lưu khóa bí mật vào file
              cấu hình MCP của agent).
            </p>
          </div>
        </section>

        {/* Cột phải: Snippet .mcp.json lấy động policy đang chọn */}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card/90 p-4 backdrop-blur-sm sm:p-5 xl:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={jsonRegionId} className="text-lg font-semibold tracking-tight text-foreground">
              Cấu hình <code className="font-mono text-base text-flow-text">.mcp.json</code> (Policy đang chọn)
            </h2>
            <CopyButton
              text={mcpJsonSnippet}
              idleLabel="Chép JSON"
              ariaLabel="Chép cấu hình .mcp.json"
            />
          </div>

          <p className="text-xs leading-relaxed text-muted sm:text-sm">
            Địa chỉ <code className="font-mono text-flow-text">{policy}</code> được điền tự động theo Policy bạn đang
            theo dõi (đổi Policy ở trang{" "}
            <Link href="/policies" className="text-flow hover:underline">
              Policy & Luật 2 tầng
            </Link>{" "}
            để cập nhật).
          </p>

          <pre
            role="region"
            aria-labelledby={jsonRegionId}
            tabIndex={0}
            className="al-scroll flex-1 overflow-x-auto rounded-lg border border-border bg-background/90 p-4 font-mono text-xs leading-relaxed text-foreground"
          >
            <code>{mcpJsonSnippet}</code>
          </pre>

          <p className="text-xs text-muted">
            Thay <code className="font-mono text-foreground">&lt;ĐƯỜNG_DẪN_TUYỆT_ĐỐI&gt;</code> bằng thư mục chứa repo trên
            máy, hoặc dùng lệnh <code className="font-mono text-foreground">setup:mcp</code> ở cột bên trái để tự ghi
            đường dẫn chuẩn (khuyên dùng).
          </p>
        </section>

        {/* Hàng dưới: Danh sách 3 MCP Tools thực tế */}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card/90 p-4 backdrop-blur-sm sm:p-5 xl:col-span-12">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              3 MCP Tool cung cấp cho Bên A
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <Link href="/audit" className="text-flow hover:text-flow-text hover:underline">
                Theo dõi yêu cầu bị chặn →
              </Link>
              <Link href="/flows" className="text-flow hover:text-flow-text hover:underline">
                Xem dòng tiền on-chain →
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {MCP_TOOLS.map((tool) => (
              <div
                key={tool.name}
                className="flex flex-col gap-2 rounded-lg border border-border bg-surface-inset p-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <code className="font-mono text-xs font-semibold text-foreground sm:text-sm">
                    {tool.name}
                  </code>
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${tool.tierClass}`}>
                    {tool.tier}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted">{tool.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
