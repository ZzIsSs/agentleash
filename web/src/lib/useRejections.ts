"use client";

import { useEffect, useState } from "react";
import { rejectionFromJson, type Rejection, type RejectionJson } from "./rejections";

export type RejectionsResponse = {
  /** false khi không có agent/logs/audit.json (ví dụ bản deploy Vercel, agent không chạy cùng máy). */
  available: boolean;
  items: RejectionJson[];
};

/** Đọc /api/rejections 3 giây một lần. File đang được agent ghi dở thì giữ danh sách cũ. */
export function useRejections(enabled: boolean) {
  const [items, setItems] = useState<Rejection[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
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
      } catch {
        // Giữ danh sách cũ.
      }
    };
    void load();
    const id = setInterval(() => void load(), 3_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled]);

  return { items, available };
}
