import { encodeAbiParameters, encodeEventTopics, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { policyEventsAbi } from "./abi";
import {
  AUTHORIZED_TOPIC,
  RATES_SELLER_ADDRESS,
  WEATHER_SELLER_ADDRESS,
  blockRanges,
  decodePolicyLog,
  fromRoutescan,
  mergeSpends,
  sellerName,
  summarizeSpendFlows,
  totalSpent,
  type RawLog,
  type RoutescanLog,
} from "./spends";

// Log thật từ Routescan: lần mua thứ nhất của demo 13/11 trên policy 0x2acc…9671 (block 61006254).
const ROUTESCAN_AUTHORIZED: RoutescanLog = {
  topics: [
    "0x9bf32ddd28f355f4a1b7bb0ec747beb3179c03eb30985980417c7fad965842c4",
    "0x87cd1e11055b007683a7f5e2aa974bd87c73cd1878b1e441031757346b395d22",
    "0x0000000000000000000000009d014376c3296db41770015af074cf4d14c075e1",
  ],
  data: "0x00000000000000000000000000000000000000000000000000000000000003e80000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006af71526de9666871c0b6e9934beaab607575816df73196f7ae76d7a8d11d7e0548fc0970000000000000000000000000000000000000000000000000000000000000000",
  blockNumber: "0x3a2e1ae",
  timeStamp: "0x6af713fc",
  logIndex: "0xf",
  transactionHash: "0x707a8cd20963a84bc48994932644192d4184a6d836758d1f05fcc422b48c0541",
};

// Log khác của policy trong cùng tx (PeriodRolledOver), phải bị bỏ qua.
const ROUTESCAN_OTHER: RoutescanLog = {
  topics: ["0x767192ce6e27f9bf556109e4c015adb5b8ae6e69e454331d7742e1ab9b323b02"],
  data: "0x000000000000000000000000000000000000000000000000000000006af713fc",
  blockNumber: "0x3a2e1ae",
  timeStamp: "0x6af713fc",
  logIndex: "0xe",
  transactionHash: "0x707a8cd20963a84bc48994932644192d4184a6d836758d1f05fcc422b48c0541",
};

const NONCE = ("0x" + "ab".repeat(32)) as Hex;
const DIGEST = ("0x" + "cd".repeat(32)) as Hex;
const STRANGER = "0x1111111111111111111111111111111111111111";

function authorizedLog(opts: {
  block: bigint;
  index: number;
  amount: bigint;
  sandbox?: boolean;
  nonce?: Hex;
  tx?: Hex;
  payTo?: `0x${string}`;
}): RawLog {
  return {
    topics: encodeEventTopics({
      abi: policyEventsAbi,
      eventName: "Authorized",
      args: { digest: DIGEST, payTo: opts.payTo ?? STRANGER },
    }) as Hex[],
    data: encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes32" }, { type: "bool" }],
      [opts.amount, 0n, 1n, opts.nonce ?? NONCE, opts.sandbox ?? false],
    ),
    transactionHash: opts.tx ?? (("0x" + opts.block.toString(16).padStart(64, "0")) as Hex),
    blockNumber: opts.block,
    logIndex: opts.index,
  };
}

function releasedLog(nonce: Hex, block: bigint): RawLog {
  return {
    topics: encodeEventTopics({
      abi: policyEventsAbi,
      eventName: "Released",
      args: { nonce, payTo: STRANGER, digest: DIGEST },
    }) as Hex[],
    data: encodeAbiParameters([{ type: "uint256" }], [500n]),
    transactionHash: ("0x" + "ee".repeat(32)) as Hex,
    blockNumber: block,
    logIndex: 0,
  };
}

describe("decodePolicyLog", () => {
  it("giải mã log Authorized thật từ Routescan", () => {
    const d = decodePolicyLog(fromRoutescan(ROUTESCAN_AUTHORIZED));
    expect(d?.kind).toBe("authorized");
    if (d?.kind !== "authorized") return;
    expect(d.spend.amount).toBe(1000n);
    expect(d.spend.isSandbox).toBe(false);
    expect(d.spend.payTo).toBe("0x9D014376C3296db41770015AF074CF4D14c075E1");
    expect(d.spend.blockNumber).toBe(61006254n);
    expect(d.spend.logIndex).toBe(15);
    expect(d.spend.timestamp).toBe(0x6af713fc);
    expect(sellerName(d.spend.payTo)).toBe("API Thời tiết");
  });

  it("bỏ qua event khác của policy", () => {
    expect(decodePolicyLog(fromRoutescan(ROUTESCAN_OTHER))).toBeNull();
  });

  it("bỏ qua log chưa đủ thông tin (pending)", () => {
    expect(decodePolicyLog({ ...authorizedLog({ block: 1n, index: 0, amount: 1n }), blockNumber: null })).toBeNull();
  });

  it("topic Authorized đúng chữ ký event của contract", () => {
    expect(AUTHORIZED_TOPIC).toBe(ROUTESCAN_AUTHORIZED.topics[0]);
  });
});

describe("fromRoutescan", () => {
  it('đọc logIndex "0x" là 0', () => {
    expect(fromRoutescan({ ...ROUTESCAN_AUTHORIZED, logIndex: "0x" }).logIndex).toBe(0);
  });
});

describe("mergeSpends", () => {
  it("khử trùng khi Routescan và RPC cùng trả một log, giữ timestamp đã biết", () => {
    const fromApi = fromRoutescan(ROUTESCAN_AUTHORIZED);
    const first = mergeSpends([], [fromApi]);
    const again = mergeSpends(first, [{ ...fromApi, timestamp: null }]);
    expect(again).toHaveLength(1);
    expect(again[0].timestamp).toBe(0x6af713fc);
  });

  it("xếp mới nhất lên trên, cùng block thì logIndex lớn hơn lên trên", () => {
    const tx = ("0x" + "12".repeat(32)) as Hex;
    const spends = mergeSpends(
      [],
      [
        authorizedLog({ block: 10n, index: 0, amount: 1n }),
        authorizedLog({ block: 12n, index: 1, amount: 2n, tx }),
        authorizedLog({ block: 12n, index: 3, amount: 3n, tx }),
      ],
    );
    expect(spends.map((s) => s.amount)).toEqual([3n, 2n, 1n]);
  });

  it("đánh dấu released khi có event Released cùng nonce, kể cả đến sau", () => {
    const other = ("0x" + "01".repeat(32)) as Hex;
    const step1 = mergeSpends(
      [],
      [
        authorizedLog({ block: 5n, index: 0, amount: 500n, sandbox: true }),
        authorizedLog({ block: 6n, index: 0, amount: 1000n, nonce: other }),
      ],
    );
    expect(totalSpent(step1)).toBe(1500n);

    const step2 = mergeSpends(step1, [releasedLog(NONCE, 9n)]);
    expect(step2.find((s) => s.nonce === NONCE)?.released).toBe(true);
    expect(step2.find((s) => s.nonce === other)?.released).toBe(false);
    expect(totalSpent(step2)).toBe(1000n);
  });

  it("địa chỉ lạ không có tên seller", () => {
    expect(sellerName(STRANGER)).toBeNull();
  });
});

describe("blockRanges", () => {
  it("chia đúng khoảng 100 block", () => {
    expect(blockRanges(1n, 250n)).toEqual([
      [1n, 100n],
      [101n, 200n],
      [201n, 250n],
    ]);
  });

  it("from > to thì không quét", () => {
    expect(blockRanges(11n, 10n)).toEqual([]);
  });

  it("bị bỏ xa thì chỉ quét phần gần nhất", () => {
    const r = blockRanges(1n, 10_000n, 100n, 2);
    expect(r).toEqual([
      [9801n, 9900n],
      [9901n, 10_000n],
    ]);
  });
});

describe("summarizeSpendFlows", () => {
  it("trả về 3 nhánh idle khi chưa có khoản chi hoặc tất cả đã released", () => {
    const releasedOnly = mergeSpends(
      [],
      [authorizedLog({ block: 5n, index: 0, amount: 1000n, payTo: WEATHER_SELLER_ADDRESS })],
    );
    const afterRelease = mergeSpends(releasedOnly, [releasedLog(NONCE, 6n)]);

    const summary = summarizeSpendFlows(afterRelease);
    expect(summary.totalAmount).toBe(0n);
    expect(summary.totalCount).toBe(0);
    expect(summary.nodes.map((n) => [n.id, n.tier, n.strokeWidth, n.amount])).toEqual([
      ["weather", "idle", 1.5, 0n],
      ["rates", "idle", 1.5, 0n],
      ["unknown", "idle", 1.5, 0n],
    ]);
  });

  it("gom tổng USDC theo Thời tiết, Tỷ giá, Địa chỉ lạ, loại khoản released và chỉnh độ dày tỷ lệ", () => {
    const n1 = ("0x" + "11".repeat(32)) as Hex;
    const n2 = ("0x" + "22".repeat(32)) as Hex;
    const n3 = ("0x" + "33".repeat(32)) as Hex;
    const n4 = ("0x" + "44".repeat(32)) as Hex;

    const spends = mergeSpends(
      [],
      [
        authorizedLog({ block: 1n, index: 0, amount: 1000n, payTo: WEATHER_SELLER_ADDRESS, nonce: n1 }),
        authorizedLog({ block: 2n, index: 0, amount: 1000n, payTo: RATES_SELLER_ADDRESS, nonce: n2 }),
        authorizedLog({ block: 3n, index: 0, amount: 1000n, payTo: RATES_SELLER_ADDRESS, nonce: n3 }),
        authorizedLog({ block: 4n, index: 0, amount: 500n, payTo: STRANGER, sandbox: true, nonce: n4 }),
      ],
    );
    const withReleased = mergeSpends(spends, [releasedLog(n4, 5n)]);

    const summary = summarizeSpendFlows(withReleased);
    expect(summary.totalAmount).toBe(3000n);
    expect(summary.totalCount).toBe(3);

    const [weather, rates, unknown] = summary.nodes;
    expect(weather).toMatchObject({ id: "weather", amount: 1000n, count: 1, tier: "trusted" });
    expect(rates).toMatchObject({ id: "rates", amount: 2000n, count: 2, tier: "trusted" });
    expect(unknown).toMatchObject({ id: "unknown", amount: 0n, count: 0, tier: "idle" });
    expect(rates.strokeWidth).toBeGreaterThan(weather.strokeWidth);
    expect(weather.strokeWidth).toBeGreaterThan(unknown.strokeWidth);
  });

  it("phân biệt đúng Whitelist, Sandbox và hỗn hợp (mixed)", () => {
    const n1 = ("0x" + "01".repeat(32)) as Hex;
    const n2 = ("0x" + "02".repeat(32)) as Hex;
    const n3 = ("0x" + "03".repeat(32)) as Hex;

    const spends = mergeSpends(
      [],
      [
        authorizedLog({ block: 1n, index: 0, amount: 1000n, payTo: WEATHER_SELLER_ADDRESS, sandbox: false, nonce: n1 }),
        authorizedLog({ block: 2n, index: 0, amount: 500n, payTo: WEATHER_SELLER_ADDRESS, sandbox: true, nonce: n2 }),
        authorizedLog({ block: 3n, index: 0, amount: 500n, payTo: STRANGER, sandbox: true, nonce: n3 }),
      ],
    );

    const [weather, rates, unknown] = summarizeSpendFlows(spends).nodes;
    expect(weather).toMatchObject({
      tier: "mixed",
      amount: 1500n,
      trustedAmount: 1000n,
      sandboxAmount: 500n,
    });
    expect(rates.tier).toBe("idle");
    expect(unknown).toMatchObject({
      tier: "sandbox",
      amount: 500n,
      trustedAmount: 0n,
      sandboxAmount: 500n,
    });
  });
});
