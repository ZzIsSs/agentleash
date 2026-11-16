import { getAddress, isAddress, zeroAddress, type Address } from "viem";
import { shortAddress } from "./chain";

export const MIN_POLICY_PERIOD_SECONDS = 30n;
export const MAX_POLICY_PERIOD_SECONDS = 30n * 86_400n;

export type CreatePolicyField = "agent" | "periodSeconds";

export type CreatePolicyInput = {
  agent: string;
  periodSeconds: string;
};

export type ParsedCreatePolicy = {
  agent: Address;
  periodSeconds: bigint;
};

export type CreatePolicyValidation =
  | { ok: true; parsed: ParsedCreatePolicy; fieldErrors: Partial<Record<CreatePolicyField, string>>; errors: [] }
  | { ok: false; fieldErrors: Partial<Record<CreatePolicyField, string>>; errors: string[] };

export type PolicyOption = {
  address: Address;
  label: string;
  isDemo: boolean;
  isOwned: boolean;
};

/** Kiểm tra địa chỉ ví agent và chu kỳ hạn mức trước khi gửi Factory.createPolicy. */
export function validateCreatePolicyInput(input: CreatePolicyInput): CreatePolicyValidation {
  const fieldErrors: Partial<Record<CreatePolicyField, string>> = {};
  const trimmedAgent = input.agent.trim();
  const trimmedPeriod = input.periodSeconds.trim();

  let parsedAgent: Address | null = null;
  if (!trimmedAgent) {
    fieldErrors.agent = "Vui lòng nhập địa chỉ ví agent.";
  } else if (!isAddress(trimmedAgent, { strict: false })) {
    fieldErrors.agent = "Địa chỉ ví agent không đúng định dạng EVM (0x...).";
  } else {
    const checksummed = getAddress(trimmedAgent);
    if (checksummed === zeroAddress) {
      fieldErrors.agent = "Ví agent không được là địa chỉ 0x000…000.";
    } else {
      parsedAgent = checksummed;
    }
  }

  let parsedPeriod: bigint | null = null;
  if (!trimmedPeriod) {
    fieldErrors.periodSeconds = "Vui lòng nhập chu kỳ (giây).";
  } else if (!/^\d+$/.test(trimmedPeriod)) {
    fieldErrors.periodSeconds = "Chu kỳ phải là số nguyên dương (giây).";
  } else {
    const value = BigInt(trimmedPeriod);
    if (value < MIN_POLICY_PERIOD_SECONDS || value > MAX_POLICY_PERIOD_SECONDS) {
      fieldErrors.periodSeconds = `Chu kỳ nên từ ${MIN_POLICY_PERIOD_SECONDS} giây đến ${MAX_POLICY_PERIOD_SECONDS} giây (30 ngày).`;
    } else {
      parsedPeriod = value;
    }
  }

  const errors = Object.values(fieldErrors).filter((v): v is string => !!v);
  if (errors.length > 0 || !parsedAgent || parsedPeriod === null) {
    return { ok: false, fieldErrors, errors };
  }

  return {
    ok: true,
    parsed: { agent: parsedAgent, periodSeconds: parsedPeriod },
    fieldErrors: {},
    errors: [],
  };
}

/** Danh sách policy để chủ chuyển đổi: gồm mọi policy ví Privy đã tạo + policy demo mặc định (không trùng lặp). */
export function buildPolicyOptions(ownerPolicies: readonly Address[], defaultDemoPolicy: Address): PolicyOption[] {
  const seen = new Set<string>();
  const options: PolicyOption[] = [];
  const demoLower = defaultDemoPolicy.toLowerCase();

  // Mới nhất lên trước để vừa tạo là thấy ở đầu danh sách.
  const reversed = [...ownerPolicies].reverse();
  reversed.forEach((rawAddr, idx) => {
    const addr = getAddress(rawAddr);
    const key = addr.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const isDemo = key === demoLower;
    const seq = reversed.length - idx;
    options.push({
      address: addr,
      label: isDemo ? `Policy của bạn #${seq} · Demo (${shortAddress(addr)})` : `Policy của bạn #${seq} (${shortAddress(addr)})`,
      isDemo,
      isOwned: true,
    });
  });

  if (!seen.has(demoLower)) {
    const addr = getAddress(defaultDemoPolicy);
    options.push({
      address: addr,
      label: `Policy demo đội (${shortAddress(addr)})`,
      isDemo: true,
      isOwned: false,
    });
  }

  return options;
}

/** Chọn policy đang xem: ưu tiên lựa chọn hiện tại nếu còn hợp lệ, nếu không lấy policy mới nhất của chủ hoặc demo. */
export function resolveActivePolicy(
  selectedPolicy: Address | null,
  ownerPolicies: readonly Address[],
  defaultDemoPolicy: Address,
): Address {
  if (selectedPolicy) {
    const selectedLower = selectedPolicy.toLowerCase();
    const match =
      selectedLower === defaultDemoPolicy.toLowerCase() ||
      ownerPolicies.some((addr) => addr.toLowerCase() === selectedLower);
    if (match) return getAddress(selectedPolicy);
  }
  if (ownerPolicies.length > 0) {
    return getAddress(ownerPolicies[ownerPolicies.length - 1]);
  }
  return getAddress(defaultDemoPolicy);
}
