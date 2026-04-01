import * as React from "react";
import { cn } from "../lib/utils.js";

type LogoProps = {
  className?: string;
  compact?: boolean;
};

/* Windows 2000-style application icon + name */
export function Logo({ className, compact = false }: LogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {/* Pixel-art style 16x16-ish program icon */}
      <svg
        aria-hidden="true"
        className={cn("shrink-0", compact ? "h-6 w-6" : "h-8 w-8")}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* icon background – raised bevel */}
        <rect x="0" y="0" width="32" height="32" fill="#d4d0c8" />
        <line x1="0" y1="0" x2="32" y2="0" stroke="white" strokeWidth="2" />
        <line x1="0" y1="0" x2="0" y2="32" stroke="white" strokeWidth="2" />
        <line x1="32" y1="0" x2="32" y2="32" stroke="#404040" strokeWidth="2" />
        <line x1="0" y1="32" x2="32" y2="32" stroke="#404040" strokeWidth="2" />
        {/* simple EKG / pulse line */}
        <polyline
          points="3,19 8,19 11,9 16,25 20,14 24,14 27,19 29,19"
          stroke="#cc0000"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {!compact ? (
        <div className="min-w-0">
          <p
            className="text-[13px] font-bold leading-none text-black"
            style={{ fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif" }}
          >
            RedPulse
          </p>
          <p
            className="text-[9px] leading-none text-[#808080] mt-[2px]"
            style={{ fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif" }}
          >
            Social Feed
          </p>
        </div>
      ) : null}
    </div>
  );
}
