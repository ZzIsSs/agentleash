import { useCallback, useSyncExternalStore } from "react";
import { shortAddress } from "./chain";
import type { Rejection } from "./rejections";
import { KNOWN_SELLERS, sellerName } from "./spends";

export const SELLER_ALIASES_STORAGE_KEY = "agentleash:seller-aliases:v1";
const MAX_ALIAS_LENGTH = 48;
const EMPTY_ALIASES: Record<string, string> = {};

let cachedRaw: string | null | undefined;
let cachedParsed: Record<string, string> = EMPTY_ALIASES;
let listeners: Set<() => void> | null = null;
let storageListening = false;

function getListeners(): Set<() => void> {
  if (!listeners) listeners = new Set();
  return listeners;
}

function notifyAliasChange() {
  for (const listener of getListeners()) {
    listener();
  }
}

function ensureStorageListener() {
  if (typeof window === "undefined" || storageListening) return;
  storageListening = true;
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === SELLER_ALIASES_STORAGE_KEY) {
      cachedRaw = undefined;
      notifyAliasChange();
    }
  });
}

/** Chuẩn hóa tên gợi nhớ: cắt khoảng trắng thừa và giới hạn độ dài hiển thị gọn trên sơ đồ. */
export function normalizeSellerAlias(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const collapsed = raw.trim().replace(/\s+/g, " ");
  if (!collapsed) return null;
  return collapsed.slice(0, MAX_ALIAS_LENGTH);
}

/** Đọc bản đồ alias theo `payTo.toLowerCase()` từ localStorage (an toàn SSR & reference-stable). */
export function readSellerAliases(): Record<string, string> {
  if (typeof window === "undefined") return EMPTY_ALIASES;
  try {
    const raw = window.localStorage.getItem(SELLER_ALIASES_STORAGE_KEY);
    if (raw === cachedRaw) return cachedParsed;
    cachedRaw = raw;
    if (!raw) {
      cachedParsed = EMPTY_ALIASES;
      return cachedParsed;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      cachedParsed = EMPTY_ALIASES;
      return cachedParsed;
    }
    const clean: Record<string, string> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val !== "string") continue;
      const normalizedKey = key.trim().toLowerCase();
      const normalizedVal = normalizeSellerAlias(val);
      if (normalizedKey && normalizedVal && !KNOWN_SELLERS[normalizedKey]) {
        clean[normalizedKey] = normalizedVal;
      }
    }
    cachedParsed = Object.keys(clean).length === 0 ? EMPTY_ALIASES : clean;
    return cachedParsed;
  } catch {
    cachedRaw = undefined;
    cachedParsed = EMPTY_ALIASES;
    return EMPTY_ALIASES;
  }
}

/** Ghi hoặc xóa alias của một địa chỉ `payTo` trên localStorage và thông báo cho các subscriber. */
export function saveSellerAlias(
  payTo: string,
  alias: string | null | undefined,
): Record<string, string> {
  const key = payTo.trim().toLowerCase();
  if (!key || KNOWN_SELLERS[key]) return readSellerAliases();

  const current = readSellerAliases();
  const normalizedAlias = normalizeSellerAlias(alias);
  const next: Record<string, string> = { ...current };

  if (normalizedAlias) {
    if (next[key] === normalizedAlias) return current;
    next[key] = normalizedAlias;
  } else {
    if (!(key in next)) return current;
    delete next[key];
  }

  const finalMap = Object.keys(next).length === 0 ? EMPTY_ALIASES : next;
  if (typeof window !== "undefined") {
    try {
      if (finalMap === EMPTY_ALIASES) {
        window.localStorage.removeItem(SELLER_ALIASES_STORAGE_KEY);
        cachedRaw = null;
      } else {
        const serialized = JSON.stringify(finalMap);
        window.localStorage.setItem(SELLER_ALIASES_STORAGE_KEY, serialized);
        cachedRaw = serialized;
      }
      cachedParsed = finalMap;
    } catch {
      cachedParsed = finalMap;
    }
  } else {
    cachedParsed = finalMap;
  }

  notifyAliasChange();
  return finalMap;
}

/**
 * Thứ tự phân giải tên hiển thị dùng chung ở Dòng tiền, Setup và Bị từ chối:
 * `KNOWN_SELLERS[addr]` → `aliases[addr]` → `shortAddress(addr)`.
 */
export function resolveSellerName(
  payTo: string,
  aliases?: Record<string, string> | null,
): string {
  const known = sellerName(payTo);
  if (known) return known;
  const key = payTo.trim().toLowerCase();
  const alias = aliases ? normalizeSellerAlias(aliases[key] ?? aliases[payTo]) : null;
  if (alias) return alias;
  return shortAddress(payTo);
}

/** Lấy tên API gợi ý từ danh sách bị từ chối khi bấm 1-click "Chuyển thành API quen". */
export function findRejectionApiAlias(
  payTo: string,
  rejections: readonly Pick<Rejection, "payTo" | "api">[],
): string | null {
  const target = payTo.trim().toLowerCase();
  if (!target || KNOWN_SELLERS[target]) return null;
  for (const r of rejections) {
    if (!r.payTo || r.payTo.trim().toLowerCase() !== target) continue;
    const candidate = normalizeSellerAlias(r.api);
    if (!candidate || candidate.toLowerCase() === "không rõ") continue;
    return candidate;
  }
  return null;
}

function subscribeAliases(onStoreChange: () => void): () => void {
  ensureStorageListener();
  const set = getListeners();
  set.add(onStoreChange);
  return () => {
    set.delete(onStoreChange);
  };
}

function getServerSnapshot(): Record<string, string> {
  return EMPTY_ALIASES;
}

/** Hook React đồng bộ SSR-safe để đọc và cập nhật tên gợi nhớ API trong localStorage. */
export function useSellerAliases() {
  const aliases = useSyncExternalStore(subscribeAliases, readSellerAliases, getServerSnapshot);
  const updateAlias = useCallback((payTo: string, alias: string | null | undefined) => {
    saveSellerAlias(payTo, alias);
  }, []);
  return [aliases, updateAlias] as const;
}

/** Reset cache bộ nhớ trong unit test khi thay mock localStorage. */
export function __resetSellerAliasCacheForTests() {
  cachedRaw = undefined;
  cachedParsed = EMPTY_ALIASES;
}
