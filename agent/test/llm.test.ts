import { describe, expect, it } from "vitest";
import {
  AGENT_TOOLS,
  DEFAULT_GEMINI_MODEL,
  runLlmAgentLoop,
  type InteractionsClientLike,
} from "../src/llm.ts";

describe("LLM Tool Calling Loop (Gemini 3.8 Flash)", () => {
  it("1. Thực hiện vòng lặp tool calling hoàn chỉnh và truyền lại tools/system_instruction mỗi lượt", async () => {
    const callsReceived: Array<Record<string, unknown>> = [];

    const mockClient: InteractionsClientLike = {
      interactions: {
        async create(params) {
          callsReceived.push(params);
          if (!params.previous_interaction_id) {
            return {
              id: "int-1",
              steps: [
                {
                  type: "function_call",
                  id: "call-1",
                  name: "fetch_weather",
                  arguments: { city: "Da Lat", days: 3 },
                },
                {
                  type: "function_call",
                  id: "call-2",
                  name: "fetch_exchange_rate",
                  arguments: { from: "USD", to: "VND" },
                },
                {
                  type: "function_call",
                  id: "call-3",
                  name: "fetch_exchange_rate",
                  arguments: { from: "AVAX", to: "USD" },
                },
              ],
            };
          }

          return {
            id: "int-2",
            steps: [
              {
                type: "model_output",
                content: [{ type: "text", text: "Tổng hợp Đà Lạt hoàn tất." }],
              },
            ],
            output_text: "Tổng hợp Đà Lạt hoàn tất.",
          };
        },
      },
    };

    const res = await runLlmAgentLoop({
      prompt: "Tổng hợp thời tiết và tỷ giá cho chuyến đi Đà Lạt",
      client: mockClient,
      executeTool: async (call) => ({
        ok: true,
        data: { tool: call.name, args: call.arguments },
      }),
    });

    expect(res.turns).toBe(2);
    expect(res.toolCallsExecuted).toHaveLength(3);
    expect(res.finalText).toBe("Tổng hợp Đà Lạt hoàn tất.");
    expect(callsReceived).toHaveLength(2);
    expect(callsReceived[0].model).toBe(DEFAULT_GEMINI_MODEL);
    expect(callsReceived[1].previous_interaction_id).toBe("int-1");
    expect(callsReceived[1].tools).toBe(AGENT_TOOLS);
    expect(typeof callsReceived[1].system_instruction).toBe("string");
  });

  it("2. Gửi is_error=true và thông báo lỗi khi Rule Engine / Policy Contract chặn tool call", async () => {
    const sentInputs: unknown[] = [];

    const mockClient: InteractionsClientLike = {
      interactions: {
        async create(params) {
          sentInputs.push(params.input);
          if (!params.previous_interaction_id) {
            return {
              id: "int-a",
              steps: [
                {
                  type: "function_call",
                  id: "call-ok",
                  name: "fetch_weather",
                  arguments: { city: "Da Lat" },
                },
                {
                  type: "function_call",
                  id: "call-blocked",
                  name: "fetch_exchange_rate",
                  arguments: { from: "EUR", to: "VND" },
                },
              ],
            };
          }
          return {
            id: "int-b",
            output_text: "Lần 2 bị chặn do vượt dailyCap.",
          };
        },
      },
    };

    const res = await runLlmAgentLoop({
      prompt: "Test rejection",
      client: mockClient,
      executeTool: async (call) => {
        if (call.id === "call-blocked") {
          return {
            ok: false,
            error: "Vượt hạn mức chi tiêu trong chu kỳ (dailyCap)",
          };
        }
        return { ok: true, data: { temp: 19 } };
      },
    });

    expect(res.finalText).toBe("Lần 2 bị chặn do vượt dailyCap.");
    const turn2Input = sentInputs[1] as Array<Record<string, unknown>>;
    expect(turn2Input).toHaveLength(2);
    expect(turn2Input[0]).toMatchObject({
      type: "function_result",
      call_id: "call-ok",
      is_error: false,
    });
    expect(turn2Input[1]).toMatchObject({
      type: "function_result",
      call_id: "call-blocked",
      is_error: true,
    });
    expect(String(turn2Input[1].result)).toContain("dailyCap");
  });

  it("3. Dừng đúng giới hạn maxTurns nếu model liên tục yêu cầu tool call", async () => {
    const mockClient: InteractionsClientLike = {
      interactions: {
        async create() {
          return {
            id: "int-loop",
            steps: [
              {
                type: "function_call",
                id: "call-loop",
                name: "fetch_weather",
                arguments: { city: "Da Lat" },
              },
            ],
          };
        },
      },
    };

    const res = await runLlmAgentLoop({
      prompt: "Loop test",
      maxTurns: 2,
      client: mockClient,
      executeTool: async () => ({ ok: true, data: {} }),
    });

    expect(res.turns).toBe(2);
    expect(res.toolCallsExecuted).toHaveLength(1);
    expect(res.finalText).toContain("giới hạn");
  });

  it("4. Tự động retry lỗi 503 tạm thời và fail ngay khi hết quota ngày (429 per day)", async () => {
    let attempts = 0;
    const retryClient: InteractionsClientLike = {
      interactions: {
        async create() {
          attempts += 1;
          if (attempts === 1) {
            const err = new Error("503 service temporarily overloaded");
            (err as { status?: number }).status = 503;
            throw err;
          }
          return { id: "int-ok", output_text: "OK sau retry" };
        },
      },
    };

    const res = await runLlmAgentLoop({
      prompt: "Retry test",
      client: retryClient,
      maxRetries: 1,
      executeTool: async () => ({ ok: true, data: {} }),
    });
    expect(res.finalText).toBe("OK sau retry");
    expect(attempts).toBe(2);

    const quotaClient: InteractionsClientLike = {
      interactions: {
        async create() {
          const err = new Error(
            "429 Rate limit exceeded (limit: 20 requests per day on Free Tier). Please retry in 2h47m7s.",
          );
          (err as { status?: number }).status = 429;
          throw err;
        },
      },
    };

    await expect(
      runLlmAgentLoop({
        prompt: "Quota test",
        client: quotaClient,
        maxRetries: 2,
        executeTool: async () => ({ ok: true, data: {} }),
      }),
    ).rejects.toThrow("per day");
  });
});
