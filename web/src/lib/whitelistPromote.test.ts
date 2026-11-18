import { describe, expect, it, vi } from "vitest";
import { zeroAddress, type Address, type Hex } from "viem";
import { policyOwnerAbi } from "./abi";
import type { Rejection } from "./rejections";
import { RATES_SELLER_ADDRESS, WEATHER_SELLER_ADDRESS, type Spend } from "./spends";
import {
  collectWhitelistCandidates,
  executeSetWhitelist,
  getExtraWhitelistedAddresses,
  getPromoteButtonState,
  isUnknownOrSandboxRejection,
  isUnknownOrSandboxSpend,
} from "./whitelistPromote";

const POLICY = "0x62Ea5e422b3ef66174B6Dd6Aa855F1f036894177" as Address;
const OWNER = "0x80a8dd777A3Ba8e13F5A933911b76CBb6451d58A" as Address;
const STRANGER = "0x1111111111111111111111111111111111111111" as Address;
const OTHER_UNKNOWN = "0x2222222222222222222222222222222222222222" as Address;
const TX_HASH = ("0x" + "ab".repeat(32)) as Hex;

function makeSpend(overrides: Partial<Spend> = {}): Spend {
  return {
    key: "tx:0",
    txHash: TX_HASH,
    blockNumber: 1n,
    logIndex: 0,
    timestamp: 1_700_000_000,
    payTo: STRANGER,
    amount: 500n,
    isSandbox: true,
    nonce: ("0x" + "11".repeat(32)) as Hex,
    digest: ("0x" + "22".repeat(32)) as Hex,
    released: false,
    ...overrides,
  };
}

function makeRejection(overrides: Partial<Rejection> = {}): Rejection {
  return {
    id: "rej-1",
    time: 1_700_000_000_000,
    source: "contract",
    code: "ExceedsSandboxPerTxCap",
    title: "Vượt trần Sandbox mỗi giao dịch (địa chỉ lạ)",
    detail: "Vượt trần Sandbox",
    api: "rogue_api",
    payTo: STRANGER,
    amountUnits: 1000n,
    bypassRules: true,
    ...overrides,
  };
}

describe("whitelistPromote helpers", () => {
  it("gom địa chỉ ứng viên từ KNOWN_SELLERS, Dòng tiền và Bị từ chối; loại trùng, null và 0x0", () => {
    const candidates = collectWhitelistCandidates(
      [
        makeSpend({ payTo: STRANGER }),
        makeSpend({ payTo: WEATHER_SELLER_ADDRESS as Address }),
      ],
      [
        makeRejection({ payTo: STRANGER.toLowerCase() }),
        makeRejection({ payTo: OTHER_UNKNOWN }),
        makeRejection({ payTo: null }),
        makeRejection({ payTo: "not-an-address" }),
        makeRejection({ payTo: zeroAddress }),
      ],
    );

    const lowered = candidates.map((a) => a.toLowerCase());
    expect(lowered).toContain(WEATHER_SELLER_ADDRESS.toLowerCase());
    expect(lowered).toContain(RATES_SELLER_ADDRESS.toLowerCase());
    expect(lowered).toContain(STRANGER.toLowerCase());
    expect(lowered).toContain(OTHER_UNKNOWN.toLowerCase());
    expect(new Set(lowered).size).toBe(lowered.length);
  });

  it("nhận diện đúng giao dịch API lạ / Sandbox ở Dòng tiền và Bị từ chối", () => {
    const wl = {
      [WEATHER_SELLER_ADDRESS.toLowerCase()]: true,
      [STRANGER.toLowerCase()]: false,
    };

    expect(isUnknownOrSandboxSpend(makeSpend({ payTo: STRANGER, isSandbox: true }), wl)).toBe(true);
    expect(isUnknownOrSandboxSpend(makeSpend({ payTo: WEATHER_SELLER_ADDRESS as Address, isSandbox: false }), wl)).toBe(
      false,
    );

    expect(isUnknownOrSandboxRejection(makeRejection({ code: "ExceedsSandboxPerTxCap", payTo: STRANGER }))).toBe(true);
    expect(isUnknownOrSandboxRejection(makeRejection({ code: "ExceedsDailyCap", payTo: WEATHER_SELLER_ADDRESS }))).toBe(
      false,
    );
    expect(isUnknownOrSandboxRejection(makeRejection({ code: "UNREGISTERED_API", payTo: null }))).toBe(false);
  });

  it("ẩn nút khi đã whitelist, chưa đọc xong whitelist hoặc payTo không hợp lệ", () => {
    const base = { isOwner: true, ownerReady: true, busy: false };

    expect(getPromoteButtonState({ ...base, payTo: null, whitelist: { [STRANGER]: false } }).visible).toBe(false);
    expect(getPromoteButtonState({ ...base, payTo: zeroAddress, whitelist: { [zeroAddress]: false } }).visible).toBe(
      false,
    );
    expect(getPromoteButtonState({ ...base, payTo: STRANGER, whitelist: null }).visible).toBe(false);
    expect(getPromoteButtonState({ ...base, payTo: STRANGER, whitelist: {} }).visible).toBe(false);

    const already = getPromoteButtonState({
      ...base,
      payTo: STRANGER,
      whitelist: { [STRANGER.toLowerCase()]: true },
    });
    expect(already.visible).toBe(false);
    expect(already.alreadyWhitelisted).toBe(true);
  });

  it("hiện nút khi chưa whitelist; disable khi ví chủ chưa sẵn sàng, không phải owner hoặc đang bận", () => {
    const wl = { [STRANGER.toLowerCase()]: false };

    const readyBtn = getPromoteButtonState({
      payTo: STRANGER.toLowerCase(),
      whitelist: wl,
      isOwner: true,
      ownerReady: true,
      busy: false,
    });
    expect(readyBtn).toEqual({
      visible: true,
      disabled: false,
      targetAddress: STRANGER,
      alreadyWhitelisted: false,
    });

    const notReady = getPromoteButtonState({
      payTo: STRANGER,
      whitelist: wl,
      isOwner: true,
      ownerReady: false,
      busy: false,
    });
    expect(notReady.visible).toBe(true);
    expect(notReady.disabled).toBe(true);
    expect(notReady.disabledReason).toContain("chưa sẵn sàng");

    const notOwner = getPromoteButtonState({
      payTo: STRANGER,
      whitelist: wl,
      isOwner: false,
      ownerReady: true,
      busy: false,
    });
    expect(notOwner.visible).toBe(true);
    expect(notOwner.disabled).toBe(true);
    expect(notOwner.disabledReason).toContain("chủ policy");

    const busy = getPromoteButtonState({
      payTo: STRANGER,
      whitelist: wl,
      isOwner: true,
      ownerReady: true,
      busy: true,
    });
    expect(busy.visible).toBe(true);
    expect(busy.disabled).toBe(true);
  });

  it("executeSetWhitelist gọi simulateContract + writeContract qua tx.run đúng tham số setWhitelist(target, true)", async () => {
    const writeContract = vi.fn().mockResolvedValue(TX_HASH);
    const simulateContract = vi.fn().mockResolvedValue({
      request: { address: POLICY, functionName: "setWhitelist", args: [STRANGER, true] },
    });
    const getWalletClient = vi.fn().mockResolvedValue({
      account: { address: OWNER },
      chain: { id: 43113 },
      writeContract,
    });
    const runTx = vi.fn(async (_label: string, send: () => Promise<Hex>) => {
      await send();
      return { status: "success" };
    });

    const ok = await executeSetWhitelist({
      policy: POLICY,
      targetAddress: STRANGER.toLowerCase() as Address,
      allowed: true,
      label: "Chuyển thành API quen",
      runTx,
      getWalletClient,
      simulateContract,
    });

    expect(ok).toBe(true);
    expect(runTx).toHaveBeenCalledWith("Chuyển thành API quen", expect.any(Function));
    expect(simulateContract).toHaveBeenCalledWith({
      address: POLICY,
      abi: policyOwnerAbi,
      functionName: "setWhitelist",
      args: [STRANGER, true],
      account: OWNER,
    });
    expect(writeContract).toHaveBeenCalledTimes(1);
  });

  it("executeSetWhitelist trả false khi tx thất bại/bị hủy và ném lỗi khi địa chỉ 0x0", async () => {
    const runTxNull = vi.fn().mockResolvedValue(null);
    const ok = await executeSetWhitelist({
      policy: POLICY,
      targetAddress: STRANGER,
      allowed: true,
      runTx: runTxNull,
      getWalletClient: vi.fn(),
      simulateContract: vi.fn(),
    });
    expect(ok).toBe(false);

    await expect(
      executeSetWhitelist({
        policy: POLICY,
        targetAddress: zeroAddress,
        allowed: true,
        runTx: runTxNull,
        getWalletClient: vi.fn(),
        simulateContract: vi.fn(),
      }),
    ).rejects.toThrow("không hợp lệ");
  });

  it("getExtraWhitelistedAddresses trả về các địa chỉ lạ đang bật whitelist (loại KNOWN_SELLERS và false)", () => {
    const extra = getExtraWhitelistedAddresses({
      [WEATHER_SELLER_ADDRESS.toLowerCase()]: true,
      [STRANGER.toLowerCase()]: true,
      [OTHER_UNKNOWN.toLowerCase()]: false,
    });
    expect(extra).toEqual([STRANGER]);

    const merged = collectWhitelistCandidates([], [], [OTHER_UNKNOWN]);
    expect(merged.map((a) => a.toLowerCase())).toContain(OTHER_UNKNOWN.toLowerCase());
  });
});
