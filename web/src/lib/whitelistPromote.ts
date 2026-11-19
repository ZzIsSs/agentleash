import { getAddress, isAddress, zeroAddress, type Address, type Hex } from "viem";
import { policyOwnerAbi } from "./abi";
import type { Rejection } from "./rejections";
import { KNOWN_SELLERS, sellerName, type Spend } from "./spends";

export type PromoteButtonState = {
  /** Chỉ hiện khi địa chỉ `to` hợp lệ và xác nhận chưa nằm trong whitelist hiện tại. */
  visible: boolean;
  /** Disable khi ví chủ chưa sẵn sàng, không phải owner policy hoặc đang có tx chờ xác nhận. */
  disabled: boolean;
  targetAddress: Address | null;
  alreadyWhitelisted: boolean;
  disabledReason?: string;
};

export type WhitelistCheckParams = {
  payTo: string | null | undefined;
  whitelist: Record<string, boolean> | null;
  isOwner: boolean;
  ownerReady: boolean;
  busy: boolean;
};

const SANDBOX_REJECTION_CODES = new Set([
  "ExceedsSandboxPerTxCap",
  "ExceedsSandboxDailyCap",
  "UNREGISTERED_API",
  "INVALID_PAY_TO",
  "UNSAFE_URL",
  "NOT_WHITELISTED",
]);

function normalizeNonZeroAddress(raw: string | null | undefined): Address | null {
  if (!raw || !isAddress(raw)) return null;
  const addr = getAddress(raw);
  return addr === zeroAddress ? null : addr;
}

/**
 * Gom toàn bộ địa chỉ nhận tiền (KNOWN_SELLERS, WhitelistChanged, Dòng tiền và Bị từ chối)
 * để `useWhitelist` đọc trạng thái on-chain một lần cho đầy đủ.
 */
export function collectWhitelistCandidates(
  spends: readonly Spend[],
  rejections: readonly Rejection[],
  extraAddresses: readonly Address[] = [],
): Address[] {
  const unique = new Map<string, Address>();
  const add = (raw: string | null | undefined) => {
    const addr = normalizeNonZeroAddress(raw);
    if (addr) unique.set(addr.toLowerCase(), addr);
  };

  for (const addr of Object.keys(KNOWN_SELLERS)) add(addr);
  for (const addr of extraAddresses) add(addr);
  for (const s of spends) add(s.payTo);
  for (const r of rejections) add(r.payTo);

  return [...unique.values()];
}

/** Trả về các địa chỉ ngoài KNOWN_SELLERS hiện đang nằm trong whitelist (để bảng [3] có nút Gỡ). */
export function getExtraWhitelistedAddresses(whitelist: Record<string, boolean> | null): Address[] {
  if (!whitelist) return [];
  const out: Address[] = [];
  for (const [raw, allowed] of Object.entries(whitelist)) {
    if (!allowed) continue;
    const addr = normalizeNonZeroAddress(raw);
    if (!addr || sellerName(addr)) continue;
    out.push(addr);
  }
  return out;
}

export type WhitelistInputCheck =
  | { ok: true; address: Address; error: null }
  | { ok: false; address: null; error: string | null };

/**
 * Kiểm tra ô "Thêm API quen bằng địa chỉ" ở bảng [3]: dùng được cả trên bản Vercel, nơi mục Bị từ chối
 * có thể trống, để chủ ví dán địa chỉ `payTo` (ví dụ lấy từ gợi ý MCP) rồi ký `setWhitelist`.
 * Ô trống trả `error: null` (chưa nhập, không báo lỗi).
 */
export function parseWhitelistInput(
  raw: string,
  whitelist: Record<string, boolean> | null,
  policy?: Address | null,
): WhitelistInputCheck {
  const value = raw.trim();
  if (!value) return { ok: false, address: null, error: null };
  if (!isAddress(value, { strict: false })) {
    return { ok: false, address: null, error: "Địa chỉ không hợp lệ (cần dạng 0x + 40 ký tự hex)." };
  }
  const address = getAddress(value);
  if (address === zeroAddress) {
    return { ok: false, address: null, error: "Không thêm được địa chỉ 0x0." };
  }
  if (policy && address.toLowerCase() === policy.toLowerCase()) {
    return { ok: false, address: null, error: "Đây là địa chỉ policy, không phải địa chỉ nhận tiền của API." };
  }
  if (whitelist?.[address.toLowerCase()] === true) {
    return { ok: false, address: null, error: "Địa chỉ này đã nằm trong whitelist." };
  }
  return { ok: true, address, error: null };
}

/** Kiểm tra một khoản chi ở bảng Dòng tiền có phải API lạ / thuộc nhóm Sandbox hay không. */
export function isUnknownOrSandboxSpend(
  spend: Pick<Spend, "payTo" | "isSandbox">,
  whitelist: Record<string, boolean> | null,
): boolean {
  if (spend.isSandbox) return true;
  if (!sellerName(spend.payTo)) return true;
  const addr = normalizeNonZeroAddress(spend.payTo);
  return addr ? whitelist?.[addr.toLowerCase()] === false : false;
}

/** Kiểm tra một bản ghi ở bảng Bị từ chối có gắn với API lạ / vượt hạn mức Sandbox hay không. */
export function isUnknownOrSandboxRejection(
  rejection: Pick<Rejection, "payTo" | "code">,
): boolean {
  const addr = normalizeNonZeroAddress(rejection.payTo);
  if (!addr) return false;
  if (SANDBOX_REJECTION_CODES.has(rejection.code)) return true;
  return !sellerName(addr);
}

/**
 * Quyết định trạng thái hiển thị & khả dụng của nút 1-click "Chuyển thành API quen".
 * - Ẩn nếu `payTo` không hợp lệ/0x0, chưa đọc xong whitelist (`undefined`/`null`), hoặc đã whitelist (`true`).
 * - Hiện nhưng disable nếu `whitelist[addr] === false` nhưng ví chủ chưa sẵn sàng, không phải owner, hoặc đang `busy`.
 */
export function getPromoteButtonState(params: WhitelistCheckParams): PromoteButtonState {
  const targetAddress = normalizeNonZeroAddress(params.payTo);
  if (!targetAddress) {
    return {
      visible: false,
      disabled: true,
      targetAddress: null,
      alreadyWhitelisted: false,
    };
  }

  const key = targetAddress.toLowerCase();
  const status = params.whitelist?.[key];

  if (status === true) {
    return {
      visible: false,
      disabled: true,
      targetAddress,
      alreadyWhitelisted: true,
    };
  }

  if (status !== false) {
    return {
      visible: false,
      disabled: true,
      targetAddress,
      alreadyWhitelisted: false,
    };
  }

  if (!params.ownerReady) {
    return {
      visible: true,
      disabled: true,
      targetAddress,
      alreadyWhitelisted: false,
      disabledReason: "Ví chủ Privy chưa sẵn sàng.",
    };
  }

  if (!params.isOwner) {
    return {
      visible: true,
      disabled: true,
      targetAddress,
      alreadyWhitelisted: false,
      disabledReason: "Chỉ chủ policy hiện tại mới có quyền chuyển thành API quen.",
    };
  }

  if (params.busy) {
    return {
      visible: true,
      disabled: true,
      targetAddress,
      alreadyWhitelisted: false,
      disabledReason: "Đang có giao dịch khác chờ xác nhận.",
    };
  }

  return {
    visible: true,
    disabled: false,
    targetAddress,
    alreadyWhitelisted: false,
  };
}

export type SetWhitelistWalletClient = {
  account: { address: Address };
  chain?: unknown;
  writeContract: (request: Record<string, unknown>) => Promise<Hex>;
};

export type ExecuteSetWhitelistParams = {
  policy: Address;
  targetAddress: Address;
  allowed: boolean;
  label?: string;
  runTx: (label: string, send: () => Promise<Hex>) => Promise<unknown>;
  getWalletClient: () => Promise<SetWhitelistWalletClient>;
  simulateContract: (args: {
    address: Address;
    abi: typeof policyOwnerAbi;
    functionName: "setWhitelist";
    args: readonly [Address, boolean];
    account: Address;
  }) => Promise<{ request: Record<string, unknown> }>;
};

/**
 * Tái sử dụng đúng luồng ký Privy (`simulateContract` → `writeContract` → `tx.run`)
 * cho cả bảng Whitelist ở `[3]` và nút 1-click "Chuyển thành API quen".
 */
export async function executeSetWhitelist(params: ExecuteSetWhitelistParams): Promise<boolean> {
  const normalized = normalizeNonZeroAddress(params.targetAddress);
  if (!normalized) {
    throw new Error("Địa chỉ API đích không hợp lệ.");
  }

  const label = params.label ?? (params.allowed ? "Thêm vào whitelist" : "Gỡ khỏi whitelist");
  const receipt = await params.runTx(label, async () => {
    const wallet = await params.getWalletClient();
    const { request } = await params.simulateContract({
      address: params.policy,
      abi: policyOwnerAbi,
      functionName: "setWhitelist",
      args: [normalized, params.allowed],
      account: wallet.account.address,
    });
    return wallet.writeContract({
      ...request,
      account: wallet.account,
      chain: wallet.chain,
    });
  });

  return receipt !== null && receipt !== false;
}
