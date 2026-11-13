import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type AuditEventStatus =
  | "ALLOWED"
  | "REJECTED_OFFCHAIN"
  | "REJECTED_ONCHAIN"
  | "SETTLED";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  status: AuditEventStatus;
  api: string;
  endpoint: string;
  query: string;
  payTo?: string;
  amountUnits?: string;
  amountUsdc?: string;
  ruleCode?: string;
  reason?: string;
  txHash?: string;
  bypassRules?: boolean;
}

export type NewAuditLogInput = Omit<AuditLogEntry, "id" | "timestamp"> & {
  id?: string;
  timestamp?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_AUDIT_LOG_PATH = path.resolve(
  __dirname,
  "..",
  "logs",
  "audit.json",
);

/**
 * Reads all recorded audit log entries from the JSON file.
 * Returns an empty array if the file does not exist or is invalid JSON.
 */
export function readAuditLogs(
  filePath: string = DEFAULT_AUDIT_LOG_PATH,
): AuditLogEntry[] {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const raw = readFileSync(filePath, "utf-8").trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuditLogEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Appends a single audit log entry to the JSON log file so the Next.js dashboard
 * can display both off-chain rule rejections and on-chain settlements.
 */
export function appendAuditLog(
  input: NewAuditLogInput,
  filePath: string = DEFAULT_AUDIT_LOG_PATH,
): AuditLogEntry {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const entry: AuditLogEntry = {
    id: input.id ?? randomUUID(),
    timestamp: input.timestamp ?? new Date().toISOString(),
    status: input.status,
    api: input.api,
    endpoint: input.endpoint,
    query: input.query,
    ...(input.payTo !== undefined ? { payTo: input.payTo } : {}),
    ...(input.amountUnits !== undefined ? { amountUnits: input.amountUnits } : {}),
    ...(input.amountUsdc !== undefined ? { amountUsdc: input.amountUsdc } : {}),
    ...(input.ruleCode !== undefined ? { ruleCode: input.ruleCode } : {}),
    ...(input.reason !== undefined ? { reason: input.reason } : {}),
    ...(input.txHash !== undefined ? { txHash: input.txHash } : {}),
    ...(input.bypassRules !== undefined ? { bypassRules: input.bypassRules } : {}),
  };

  const current = readAuditLogs(filePath);
  current.push(entry);
  writeFileSync(filePath, JSON.stringify(current, null, 2) + "\n", "utf-8");

  return entry;
}

/**
 * Clears all entries in the given audit log file.
 */
export function clearAuditLogs(
  filePath: string = DEFAULT_AUDIT_LOG_PATH,
): void {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, "[]\n", "utf-8");
}
