import { formatUnits, parseUnits } from "viem";
import { DEMO_POLICY_PARAMS } from "./chain";
import { USDC_DECIMALS, type PolicyRaw } from "./policy";

export type CapsField = "perTxCap" | "dailyCap" | "sandboxPerTxCap" | "sandboxDailyCap";

export type CapsInput = Record<CapsField, string>;

export type ParsedCaps = Record<CapsField, bigint>;

export type CapsValidationResult =
  | {
      ok: true;
      caps: ParsedCaps;
      fieldErrors: Partial<Record<CapsField, string>>;
      errors: string[];
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<CapsField, string>>;
      errors: string[];
    };

const MAX_UINT256 = (1n << 256n) - 1n;

export const CAPS_FIELD_LABELS: Record<CapsField, string> = {
  perTxCap: "Whitelist mỗi lần",
  dailyCap: "Whitelist chu kỳ (chung)",
  sandboxPerTxCap: "Sandbox mỗi lần",
  sandboxDailyCap: "Sandbox chu kỳ",
};

/** Giá trị mặc định demo theo docs/SPEC.md: 0.002 / 0.003 / 0.0005 / 0.001 USDC. */
export const DEMO_CAPS_INPUT: CapsInput = {
  perTxCap: formatUnits(DEMO_POLICY_PARAMS.perTxCap, USDC_DECIMALS),
  dailyCap: formatUnits(DEMO_POLICY_PARAMS.dailyCap, USDC_DECIMALS),
  sandboxPerTxCap: formatUnits(DEMO_POLICY_PARAMS.sandboxPerTxCap, USDC_DECIMALS),
  sandboxDailyCap: formatUnits(DEMO_POLICY_PARAMS.sandboxDailyCap, USDC_DECIMALS),
};

export function capsFromRaw(raw: Pick<PolicyRaw, CapsField>): CapsInput {
  return {
    perTxCap: formatUnits(raw.perTxCap, USDC_DECIMALS),
    dailyCap: formatUnits(raw.dailyCap, USDC_DECIMALS),
    sandboxPerTxCap: formatUnits(raw.sandboxPerTxCap, USDC_DECIMALS),
    sandboxDailyCap: formatUnits(raw.sandboxDailyCap, USDC_DECIMALS),
  };
}

export function capsEqual(a: Pick<PolicyRaw, CapsField>, b: Pick<PolicyRaw, CapsField>): boolean {
  return (
    a.perTxCap === b.perTxCap &&
    a.dailyCap === b.dailyCap &&
    a.sandboxPerTxCap === b.sandboxPerTxCap &&
    a.sandboxDailyCap === b.sandboxDailyCap
  );
}

/** Parse một chuỗi USDC không âm tối đa 6 chữ số thập phân sang đơn vị nhỏ nhất (10^-6). */
export function parseUsdcInput(raw: string): { ok: true; value: bigint } | { ok: false; error: string } {
  const s = raw.trim();
  if (!s) return { ok: false, error: "Không được để trống." };
  if (s.includes(",")) {
    return { ok: false, error: "Dùng dấu chấm (.) cho phần thập phân, ví dụ 0.002." };
  }
  if (s.startsWith("-")) {
    return { ok: false, error: "Hạn mức phải lớn hơn hoặc bằng 0." };
  }
  if (!/^\d+(?:\.\d+)?$/.test(s)) {
    return { ok: false, error: "Nhập số hợp lệ không âm, ví dụ 0.002." };
  }

  const [, frac = ""] = s.split(".");
  if (frac.length > USDC_DECIMALS) {
    return { ok: false, error: "USDC chỉ hỗ trợ tối đa 6 chữ số thập phân (nhỏ nhất 0.000001)." };
  }

  const value = parseUnits(s, USDC_DECIMALS);
  if (value > MAX_UINT256) {
    return { ok: false, error: "Số quá lớn, vượt giới hạn uint256." };
  }
  return { ok: true, value };
}

/**
 * Parse và kiểm tra 4 ngưỡng hạn mức khớp ràng buộc trong contracts/src/AgentPolicy.sol:
 * - perTxCap <= dailyCap
 * - sandboxPerTxCap <= sandboxDailyCap
 * - sandboxDailyCap <= dailyCap
 */
export function validateCaps(input: CapsInput): CapsValidationResult {
  const fields: CapsField[] = ["perTxCap", "dailyCap", "sandboxPerTxCap", "sandboxDailyCap"];
  const fieldErrors: Partial<Record<CapsField, string>> = {};
  const errors: string[] = [];
  const parsed: Partial<ParsedCaps> = {};

  for (const field of fields) {
    const res = parseUsdcInput(input[field]);
    if (!res.ok) {
      fieldErrors[field] = res.error;
      errors.push(`${CAPS_FIELD_LABELS[field]}: ${res.error}`);
    } else {
      parsed[field] = res.value;
    }
  }

  if (errors.length > 0) {
    return { ok: false, fieldErrors, errors };
  }

  const caps = parsed as ParsedCaps;

  if (caps.perTxCap > caps.dailyCap) {
    const msg = "Trần mỗi lần (Whitelist) phải ≤ trần chu kỳ chung.";
    fieldErrors.perTxCap ??= msg;
    errors.push(msg);
  }
  if (caps.sandboxPerTxCap > caps.sandboxDailyCap) {
    const msg = "Trần mỗi lần (Sandbox) phải ≤ trần chu kỳ Sandbox.";
    fieldErrors.sandboxPerTxCap ??= msg;
    errors.push(msg);
  }
  if (caps.sandboxDailyCap > caps.dailyCap) {
    const msg = "Trần chu kỳ Sandbox phải ≤ trần chu kỳ chung.";
    fieldErrors.sandboxDailyCap ??= msg;
    errors.push(msg);
  }

  if (errors.length > 0) {
    return { ok: false, fieldErrors, errors };
  }

  return { ok: true, caps, fieldErrors: {}, errors: [] };
}
