import { describe, expect, it } from "vitest";
import { runLlmAgentLoop } from "../src/llm.ts";
import { createMockLlmClient, MOCK_DA_LAT_PLAN } from "../src/mockLlm.ts";

describe("LLM giả lập (--mock-llm)", () => {
  it("chạy trọn vòng tool calling không cần GEMINI_API_KEY", async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const res = await runLlmAgentLoop({
        prompt: "Tổng hợp thời tiết và tỷ giá cho chuyến đi Đà Lạt",
        client: createMockLlmClient(),
        executeTool: async (call) => ({ ok: true, data: { tool: call.name } }),
      });

      expect(res.turns).toBe(2);
      expect(res.toolCallsExecuted.map((x) => x.call.name)).toEqual(
        MOCK_DA_LAT_PLAN.map((c) => c.name),
      );
      expect(res.finalText).toContain("[LLM GIẢ LẬP]");
      expect(res.finalText).toContain("4 gói dữ liệu");
    } finally {
      if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
    }
  });

  it("báo cáo cuối nêu số lần bị chặn khi contract từ chối lần 4", async () => {
    const res = await runLlmAgentLoop({
      prompt: "Đà Lạt",
      client: createMockLlmClient(),
      executeTool: async (call) =>
        call.id === "mock-4"
          ? { ok: false, error: "Vượt hạn mức chu kỳ (ExceedsDailyCap)" }
          : { ok: true, data: {} },
    });

    expect(res.toolCallsExecuted.filter((x) => !x.outcome.ok)).toHaveLength(1);
    expect(res.finalText).toContain("3 gói dữ liệu");
    expect(res.finalText).toContain("1 lần mua bị chặn");
  });
});
