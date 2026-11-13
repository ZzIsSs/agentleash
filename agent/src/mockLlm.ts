// LLM giả lập: thay Gemini bằng kịch bản cố định để chạy demo không cần GEMINI_API_KEY.
// Vẫn đi qua đúng vòng runLlmAgentLoop → Rule Engine → x402 → AgentPolicy trên Fuji;
// chỉ phần "LLM đề xuất tool call" là giả lập. Theo luật 6, phải khai rõ khi demo bằng chế độ này.
import type { Interactions } from "@google/genai";
import type { AgentToolCall, InteractionsClientLike } from "./llm.ts";

/** Kế hoạch Đà Lạt mặc định: 3 lần mua trong hạn mức + lần 4 để contract chặn. */
export const MOCK_DA_LAT_PLAN: AgentToolCall[] = [
  { id: "mock-1", name: "fetch_weather", arguments: { city: "Da Lat", days: 3 } },
  { id: "mock-2", name: "fetch_exchange_rate", arguments: { from: "USD", to: "VND" } },
  { id: "mock-3", name: "fetch_exchange_rate", arguments: { from: "AVAX", to: "USD" } },
  { id: "mock-4", name: "fetch_exchange_rate", arguments: { from: "USDC", to: "VND" } },
];

function summarize(results: Interactions.FunctionResultStep[]): string {
  const ok = results.filter((r) => !r.is_error);
  const blocked = results.filter((r) => r.is_error);
  const lines = [
    "[LLM GIẢ LẬP] Báo cáo chuyến đi Đà Lạt:",
    `- Đã mua được ${ok.length} gói dữ liệu: ${ok.map((r) => r.name).join(", ") || "không có"}.`,
  ];
  if (blocked.length > 0) {
    lines.push(
      `- ${blocked.length} lần mua bị chặn (rule engine hoặc AgentPolicy on-chain), agent dừng mua thêm.`,
    );
  }
  return lines.join("\n");
}

/**
 * Tạo client giả lập cùng giao diện InteractionsClientLike mà runLlmAgentLoop dùng.
 * Lượt 1 trả các function_call theo `plan`; lượt sau đọc function_result và trả output_text.
 */
export function createMockLlmClient(
  plan: AgentToolCall[] = MOCK_DA_LAT_PLAN,
): InteractionsClientLike {
  let counter = 0;
  return {
    interactions: {
      async create(params) {
        counter += 1;
        const id = `mock-interaction-${counter}`;

        if (!params.previous_interaction_id) {
          return {
            id,
            steps: plan.map((call) => ({
              type: "function_call" as const,
              id: call.id,
              name: call.name,
              arguments: call.arguments,
            })) as Interactions.Step[],
          };
        }

        const results = (Array.isArray(params.input) ? params.input : []) as Interactions.FunctionResultStep[];
        const text = summarize(results);
        return {
          id,
          steps: [{ type: "model_output", content: [{ type: "text", text }] }] as Interactions.Step[],
          output_text: text,
        };
      },
    },
  };
}
