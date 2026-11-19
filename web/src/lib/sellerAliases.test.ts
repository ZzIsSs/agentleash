import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RATES_SELLER_ADDRESS, WEATHER_SELLER_ADDRESS } from "./spends";
import {
  SELLER_ALIASES_STORAGE_KEY,
  __resetSellerAliasCacheForTests,
  findRejectionApiAlias,
  normalizeSellerAlias,
  readSellerAliases,
  resolveSellerName,
  saveSellerAlias,
} from "./sellerAliases";

const CUSTOM_ADDR = "0x3333333333333333333333333333333333333333";

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
}

describe("sellerAliases", () => {
  beforeEach(() => {
    __resetSellerAliasCacheForTests();
    const storage = createMemoryStorage();
    vi.stubGlobal("window", {
      localStorage: storage,
      addEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    __resetSellerAliasCacheForTests();
  });

  it("trả về object rỗng an toàn khi chạy SSR không có window", () => {
    vi.unstubAllGlobals();
    __resetSellerAliasCacheForTests();
    expect(readSellerAliases()).toEqual({});
    expect(resolveSellerName(CUSTOM_ADDR)).toBe("0x3333…3333");
  });

  it("lưu, đọc và xóa alias theo lowercase payTo trên localStorage", () => {
    expect(readSellerAliases()).toEqual({});

    saveSellerAlias(CUSTOM_ADDR.toUpperCase(), "  API   Chuyến   bay  ");
    expect(readSellerAliases()).toEqual({ [CUSTOM_ADDR]: "API Chuyến bay" });

    // Đọc thẳng từ localStorage để xác nhận đã persist.
    const raw = window.localStorage.getItem(SELLER_ALIASES_STORAGE_KEY);
    expect(raw).toContain("API Chuyến bay");

    saveSellerAlias(CUSTOM_ADDR, "   ");
    expect(readSellerAliases()).toEqual({});
  });

  it("ưu tiên KNOWN_SELLERS → alias → shortAddress trong resolveSellerName", () => {
    const aliases = {
      [WEATHER_SELLER_ADDRESS]: "Tên đè (không được dùng)",
      [CUSTOM_ADDR]: "API Chuyến bay",
    };

    expect(resolveSellerName(WEATHER_SELLER_ADDRESS, aliases)).toBe("API Thời tiết");
    expect(resolveSellerName(RATES_SELLER_ADDRESS, aliases)).toBe("API Tỷ giá");
    expect(resolveSellerName(CUSTOM_ADDR.toUpperCase(), aliases)).toBe("API Chuyến bay");
    expect(resolveSellerName("0x4444444444444444444444444444444444444444", aliases)).toBe("0x4444…4444");
  });

  it("findRejectionApiAlias lấy tên từ rejections nếu khác 'không rõ'", () => {
    const picked = findRejectionApiAlias(CUSTOM_ADDR, [
      { payTo: CUSTOM_ADDR, api: "không rõ" },
      { payTo: CUSTOM_ADDR.toUpperCase(), api: "Flight Quote API" },
    ]);
    expect(picked).toBe("Flight Quote API");

    expect(
      findRejectionApiAlias(CUSTOM_ADDR, [{ payTo: CUSTOM_ADDR, api: "không rõ" }]),
    ).toBeNull();
    expect(
      findRejectionApiAlias(WEATHER_SELLER_ADDRESS, [{ payTo: WEATHER_SELLER_ADDRESS, api: "Weather" }]),
    ).toBeNull();
    expect(normalizeSellerAlias("   ")).toBeNull();
  });
});
