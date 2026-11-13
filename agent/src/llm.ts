import { GoogleGenAI, type Interactions } from "@google/genai";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export const SYSTEM_INSTRUCTION = [
  "Bạn là trợ lý tổng hợp thông tin du lịch và tài chính của hệ thống AgentLeash.",
  "Vai trò của bạn là phân tích yêu cầu của người dùng và đề xuất gọi các công cụ dữ liệu có cấu trúc (fetch_weather, fetch_exchange_rate).",
  "Bạn KHÔNG nắm giữ ví, KHÔNG biết số dư hay khóa bí mật, và KHÔNG tự thực hiện thanh toán.",
  "Khi người dùng yêu cầu tổng hợp thời tiết và tỷ giá cho chuyến đi tại Việt Nam trong hệ sinh thái Avalanche, hãy đề xuất đủ các lượt tra cứu cần thiết: (1) thời tiết điểm đến, (2) tỷ giá USD/VND cho chi tiêu tiền mặt, (3) tỷ giá AVAX/USD cho phí mạng lưới, và (4) tỷ giá USDC/VND để quy đổi ngân sách thanh toán API x402.",
  "Nếu một công cụ trả về lỗi bị chặn bởi Rule Engine hoặc Policy Contract, KHÔNG tự bịa dữ liệu thay thế; hãy thông báo rõ ràng phần dữ liệu nào đã lấy được và phần nào bị từ chối kèm nguyên văn lý do.",
  "Trả lời bằng tiếng Việt súc tích, rõ ràng.",
].join(" ");

export const AGENT_TOOLS: Interactions.Tool[] = [
  {
    type: "function",
    name: "fetch_weather",
    description:
      "Tra cứu thông tin thời tiết hiện tại và dự báo ngắn hạn cho một thành phố.",
    parameters: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "Tên thành phố (ví dụ: Da Lat, Ha Noi, Ho Chi Minh).",
        },
        days: {
          type: "integer",
          description: "Số ngày dự báo từ 1 đến 3 (mặc định 3).",
        },
      },
      required: ["city"],
    },
  },
  {
    type: "function",
    name: "fetch_exchange_rate",
    description:
      "Tra cứu tỷ giá quy đổi giữa hai đồng tiền hoặc tài sản số (ví dụ: USD sang VND, AVAX sang USD).",
    parameters: {
      type: "object",
      properties: {
        from: {
          type: "string",
          description: "Mã tiền tệ nguồn (ví dụ: USD, AVAX, EUR, JPY, USDC).",
        },
        to: {
          type: "string",
          description: "Mã tiền tệ đích (ví dụ: VND, USD).",
        },
      },
      required: ["from", "to"],
    },
  },
];

export type AgentToolName = "fetch_weather" | "fetch_exchange_rate";

export interface AgentToolCall {
  id: string;
  name: AgentToolName | string;
  arguments: Record<string, unknown>;
}

export interface ToolExecutionOutcome {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface InteractionsClientLike {
  interactions: {
    create(params: Record<string, unknown>): Promise<{
      id: string;
      steps?: Interactions.Step[];
      output_text?: string | null;
    }>;
  };
}

export interface LlmAgentLoopOptions {
  prompt: string;
  executeTool: (call: AgentToolCall) => Promise<ToolExecutionOutcome>;
  apiKey?: string;
  model?: string;
  systemInstruction?: string;
  maxTurns?: number;
  maxRetries?: number;
  client?: InteractionsClientLike;
  onModelTurn?: (turn: number, calls: AgentToolCall[]) => void;
}

export interface LlmAgentLoopResult {
  finalText: string;
  turns: number;
  toolCallsExecuted: Array<{
    call: AgentToolCall;
    outcome: ToolExecutionOutcome;
  }>;
  interactionId: string;
}

export function createGeminiClient(apiKey?: string): GoogleGenAI {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "Thiếu GEMINI_API_KEY trong biến môi trường. Vui lòng kiểm tra file .env.",
    );
  }
  return new GoogleGenAI({ apiKey: key });
}

function extractFunctionCalls(
  steps: Interactions.Step[] | undefined,
): AgentToolCall[] {
  if (!steps || steps.length === 0) return [];
  const calls: AgentToolCall[] = [];

  for (const step of steps) {
    if (step.type === "function_call") {
      calls.push({
        id: step.id,
        name: step.name,
        arguments: step.arguments ?? {},
      });
    }
  }
  return calls;
}

function isTransientGeminiError(err: unknown): {
  transient: boolean;
  delayMs: number;
} {
  const status = (err as { status?: number })?.status;
  const msg = String((err as { message?: string })?.message || err || "");

  // Do not retry daily quota exhaustion (e.g. "limit: 20 requests per day" or "retry in 2h...")
  if (
    msg.includes("per day") ||
    /retry in \d+h/i.test(msg) ||
    /retry in \d+m/i.test(msg)
  ) {
    return { transient: false, delayMs: 0 };
  }

  if (status === 503 || msg.includes("503")) {
    return { transient: true, delayMs: 1500 };
  }

  if (status === 429 || msg.includes("429")) {
    const match = msg.match(/retry in (\d+)s/i);
    const sec = match ? Number(match[1]) : 5;
    if (sec <= 25) {
      return { transient: true, delayMs: (sec + 1) * 1000 };
    }
  }

  return { transient: false, delayMs: 0 };
}

async function createInteractionWithRetry(
  client: InteractionsClientLike,
  params: Record<string, unknown>,
  maxRetries: number,
) {
  let attempt = 0;
  while (true) {
    try {
      return await client.interactions.create(params);
    } catch (err) {
      const { transient, delayMs } = isTransientGeminiError(err);
      if (!transient || attempt >= maxRetries) {
        throw err;
      }
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Runs a multi-turn Gemini 3.8 Flash tool-calling loop using the official @google/genai Interactions API.
 * Strictly obeys Competition Rule 4: LLM only proposes structured tool calls and never accesses keys or funds.
 */
export async function runLlmAgentLoop(
  options: LlmAgentLoopOptions,
): Promise<LlmAgentLoopResult> {
  const {
    prompt,
    executeTool,
    apiKey,
    model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    systemInstruction = SYSTEM_INSTRUCTION,
    maxTurns = 6,
    maxRetries = 2,
    client: injectedClient,
    onModelTurn,
  } = options;

  const client: InteractionsClientLike =
    injectedClient ?? (createGeminiClient(apiKey) as unknown as InteractionsClientLike);
  const toolCallsExecuted: LlmAgentLoopResult["toolCallsExecuted"] = [];

  let turn = 1;
  let interaction = await createInteractionWithRetry(
    client,
    {
      model,
      system_instruction: systemInstruction,
      input: prompt,
      tools: AGENT_TOOLS,
    },
    maxRetries,
  );

  while (true) {
    const calls = extractFunctionCalls(interaction.steps);
    onModelTurn?.(turn, calls);

    if (calls.length === 0) {
      return {
        finalText: interaction.output_text ?? "",
        turns: turn,
        toolCallsExecuted,
        interactionId: interaction.id,
      };
    }

    if (turn >= maxTurns) {
      return {
        finalText:
          interaction.output_text ??
          "Đã đạt giới hạn số lượt gọi công cụ tối đa trong phiên.",
        turns: turn,
        toolCallsExecuted,
        interactionId: interaction.id,
      };
    }

    const resultSteps: Interactions.FunctionResultStep[] = [];
    for (const call of calls) {
      const outcome = await executeTool(call);
      toolCallsExecuted.push({ call, outcome });

      resultSteps.push({
        type: "function_result",
        call_id: call.id,
        name: call.name,
        is_error: !outcome.ok,
        result: JSON.stringify(
          outcome.ok
            ? outcome.data
            : { error: outcome.error ?? "Tool execution failed" },
        ),
      });
    }

    turn += 1;
    interaction = await createInteractionWithRetry(
      client,
      {
        model,
        system_instruction: systemInstruction,
        input: resultSteps,
        tools: AGENT_TOOLS,
        previous_interaction_id: interaction.id,
      },
      maxRetries,
    );
  }
}
