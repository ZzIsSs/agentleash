"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { rejectionFromJson, type Rejection, type RejectionJson } from "./rejections";

export type RejectionsResponse = {
  /** false khi không có agent/logs/audit.json (ví dụ bản deploy Vercel, agent không chạy cùng máy). */
  available: boolean;
  items: RejectionJson[];
  /** Tổng số lượt bị chặn trước khi cắt limit (50); optional để tương thích payload cũ. */
  total?: number;
};

/** Đọc /api/rejections 3 giây một lần. File đang được agent ghi dở thì giữ danh sách cũ. */
export function useRejections(enabled: boolean) {
  const [items, setItems] = useState<Rejection[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [available, setAvailable] = useState<boolean | null>(null);
  const loadRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    loadRef.current = null;
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/rejections", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as RejectionsResponse;
        if (cancelled) return;
        setAvailable(body.available);
        setItems(body.items.map(rejectionFromJson));
        setTotal(typeof body.total === "number" ? body.total : body.items.length);
      } catch {
        // Giữ danh sách cũ.
      }
    };
    loadRef.current = load;
    void load();
    const id = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) {
        void load();
      }
    }, 3_000);
    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        void load();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
      cancelled = true;
      loadRef.current = null;
      clearInterval(id);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, [enabled]);

  const refresh = useCallback(() => {
    void loadRef.current?.();
  }, []);

  return { items, total, available, refresh };
}
