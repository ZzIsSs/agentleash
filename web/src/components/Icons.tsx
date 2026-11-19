import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Biểu tượng nhận diện AgentLeash: khiên khóa mạch + điểm neo dây xích x402. */
export function AgentLeashMark({ className = "h-7 w-7", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className} {...props}>
      <rect x="2" y="2" width="24" height="24" rx="7" fill="#131c31" stroke="#334155" strokeWidth="1.25" />
      <path
        d="M14 6.25L20 8.75V13.6C20 17.35 17.45 20.65 14 21.75C10.55 20.65 8 17.35 8 13.6V8.75L14 6.25Z"
        stroke="#22d3ee"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="13.5" r="2.25" fill="#22c55e" />
      <path d="M14 15.75V18.5" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ShieldCheckIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className} {...props}>
      <path d="M12 3l7 3v5.5c0 4.5-3 8.5-7 9.5-4-1-7-5-7-9.5V6l7-3z" strokeLinejoin="round" />
      <path d="M9.25 12.25l2 2 3.75-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ShieldBanIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className} {...props}>
      <path d="M12 3l7 3v5.5c0 4.5-3 8.5-7 9.5-4-1-7-5-7-9.5V6l7-3z" strokeLinejoin="round" />
      <path d="M9.5 9.5l5 5m0-5l-5 5" strokeLinecap="round" />
    </svg>
  );
}

export function AlertTriangleIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className} {...props}>
      <path
        d="M10.3 4.3a2 2 0 0 1 3.4 0l7.1 12.2A2 2 0 0 1 19.1 19.5H4.9a2 2 0 0 1-1.7-3l7.1-12.2z"
        strokeLinejoin="round"
      />
      <path d="M12 9.5v4" strokeLinecap="round" />
      <circle cx="12" cy="16.25" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LockIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className} {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" strokeLinejoin="round" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

export function UnlockIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className} {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" strokeLinejoin="round" />
      <path d="M8 11V8a4 4 0 0 1 7.6-1.7" strokeLinecap="round" />
    </svg>
  );
}

export function ActivityFlowIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className} {...props}>
      <path d="M3 12h4l2.5-6 5 12 2.5-6H21" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SlidersIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className} {...props}>
      <path d="M4 7h9m4 0h3M4 12h3m4 0h9M4 17h11m4 0h1" strokeLinecap="round" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className} {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className} {...props}>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowUpRightIcon({ className = "h-3.5 w-3.5", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className} {...props}>
      <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CopyIcon({ className = "h-3.5 w-3.5", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className} {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" strokeLinejoin="round" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronDownIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className} {...props}>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlayIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className} {...props}>
      <path d="M7 5.5l11 6.5-11 6.5V5.5z" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className} {...props}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export function BadgeIdIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" strokeLinejoin="round" />
      <circle cx="8.5" cy="11.5" r="2" />
      <path d="M13.5 10h4.5m-4.5 3.5h3.5" strokeLinecap="round" />
    </svg>
  );
}

export function WalletIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className} {...props}>
      <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" strokeLinejoin="round" />
      <path d="M15 12h5" strokeLinecap="round" />
      <circle cx="15.5" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TerminalIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" strokeLinejoin="round" />
      <path d="M7.5 9.5L10.5 12l-3 2.5M12.5 14.5h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MenuIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}
