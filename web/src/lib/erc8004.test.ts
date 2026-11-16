import { describe, expect, it } from "vitest";
import {
  ERC8004_REGISTRATION_TYPE,
  REGISTERED_TOPIC,
  buildAgentRegistrationPayload,
  decodeAgentRegistrationUri,
  encodeAgentRegistrationUri,
  parseRegisteredLogs,
} from "./erc8004";

const AGENT = "0x0F8de357042E53bF0E647066F0Bb1a446133ef9D" as const;
const POLICY = "0x62Ea5e422b3ef66174B6Dd6Aa855F1f036894177" as const;
const OWNER = "0x80a8dd777A3Ba8e13F5A933911b76CBb6451d58A" as const;

describe("ERC-8004 registration URI helpers", () => {
  it("tạo JSON registration-v1 đầy đủ và encode/decode UTF-8 khứ hồi", () => {
    const payload = buildAgentRegistrationPayload({
      name: "AgentLeash · Đà Lạt",
      agentAddress: AGENT,
      policyAddress: POLICY,
    });
    expect(payload.type).toBe(ERC8004_REGISTRATION_TYPE);
    expect(payload.services[0].endpoint).toBe(`eip155:43113:${AGENT}`);

    const uri = encodeAgentRegistrationUri(payload);
    expect(uri.startsWith("data:application/json;base64,")).toBe(true);

    const decoded = decodeAgentRegistrationUri(uri);
    expect(decoded.name).toBe("AgentLeash · Đà Lạt");
    expect(decoded.policyAddress).toBe(POLICY);
    expect(decoded.agentWallet).toBe(`eip155:43113:${AGENT}`);
    expect(decoded.supportedTrust).toContain("eip-3009");
  });

  it("trả fallback an toàn khi tokenURI là link https hoặc base64 hỏng", () => {
    const httpUri = decodeAgentRegistrationUri("https://example.com/agent.json");
    expect(httpUri.name).toBeNull();
    expect(httpUri.rawUri).toBe("https://example.com/agent.json");

    const broken = decodeAgentRegistrationUri("data:application/json;base64,!!!not-base64");
    expect(broken.name).toBeNull();
  });

  it("parseRegisteredLogs lọc đúng owner và xếp agentId mới nhất lên trước", () => {
    const ownerTopic = `0x000000000000000000000000${OWNER.slice(2).toLowerCase()}`;
    const otherTopic = "0x0000000000000000000000001111111111111111111111111111111111111111";

    const parsed = parseRegisteredLogs(
      [
        {
          topics: [REGISTERED_TOPIC, "0x000000000000000000000000000000000000000000000000000000000000000a", ownerTopic],
          blockNumber: "0x10",
          transactionHash: "0xaaa",
        },
        {
          topics: [REGISTERED_TOPIC, "0x000000000000000000000000000000000000000000000000000000000000010e", otherTopic],
          blockNumber: "0x11",
          transactionHash: "0xbbb",
        },
        {
          topics: [REGISTERED_TOPIC, "0x000000000000000000000000000000000000000000000000000000000000001f", ownerTopic],
          blockNumber: "0x12",
          transactionHash: "0xccc",
        },
      ],
      OWNER,
    );

    expect(parsed).toHaveLength(2);
    expect(parsed.map((x) => x.agentId)).toEqual([31n, 10n]);
    expect(parsed[0].owner).toBe(OWNER);
  });
});
