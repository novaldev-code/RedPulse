import * as React from "react";
import { cn } from "../lib/utils.js";

type LogoProps = {
  className?: string;
  compact?: boolean;
};

export function Logo({ className, compact = false }: LogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <svg
        aria-hidden="true"
        className={cn("shrink-0", compact ? "h-9 w-9" : "h-11 w-11")}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="2" y="2" width="44" height="44" rx="16" fill="#050505" />
        <rect x="2" y="2" width="44" height="44" rx="16" stroke="rgba(255,255,255,0.12)" />
        <path
          d="M11 27H18L22 18L27 31L31 23H37"
          stroke="#FF0000"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!compact ? (
        <div className="min-w-0">
          <p className="text-lg font-black tracking-tight text-white">RedPulse</p>
          <p className="text-[11px] uppercase tracking-[0.26em] text-white/38">Social Feed</p>
        </div>
      ) : null}
    </div>
  );
}
