"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "./Icons";

function legacyCopyText(text: string): boolean {
  const field = Object.assign(document.createElement("textarea"), { value: text });
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;inset-block-start:0;opacity:0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

/** Nút sao chép chuẩn WCAG (kèm fallback khi thiếu Clipboard API, không disable nút lúc phản hồi). */
export function CopyButton({
  text,
  idleLabel = "Chép lệnh",
  copiedLabel = "Đã chép",
  failedLabel = "Không chép được",
  ariaLabel,
  className = "",
}: {
  text: string;
  idleLabel?: string;
  copiedLabel?: string;
  failedLabel?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [liveText, setLiveText] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAnnouncedRef = useRef("");

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const announce = (msg: string) => {
    const next = msg === lastAnnouncedRef.current ? `${msg}\u00A0` : msg;
    lastAnnouncedRef.current = next;
    setLiveText(next);
  };

  const handleCopy = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    let ok = false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      } else {
        ok = legacyCopyText(text);
      }
    } catch {
      ok = legacyCopyText(text);
    }

    setStatus(ok ? "copied" : "failed");
    announce(ok ? copiedLabel : failedLabel);
    timerRef.current = setTimeout(() => {
      setStatus("idle");
      setLiveText("");
    }, 2000);
  };

  const visibleLabel = status === "copied" ? copiedLabel : status === "failed" ? failedLabel : idleLabel;

  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label={ariaLabel}
        data-copied={status === "copied" ? "" : undefined}
        data-failed={status === "failed" ? "" : undefined}
        className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border-control bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-elevated ${className}`}
      >
        {status === "copied" ? (
          <CheckIcon className="h-3.5 w-3.5 shrink-0 text-trusted-text" />
        ) : (
          <CopyIcon className="h-3.5 w-3.5 shrink-0 text-flow" />
        )}
        <span>{visibleLabel}</span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {liveText}
      </span>
    </span>
  );
}
