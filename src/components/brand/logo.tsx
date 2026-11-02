import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "default" | "lg";
  showSubtitle?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className,
  size = "default",
  showSubtitle = true,
}) => {
  const iconSizes = {
    sm: "w-8 h-8",
    default: "w-11 h-11",
    lg: "w-14 h-14",
  };

  const titleSizes = {
    sm: "text-lg",
    default: "text-2xl",
    lg: "text-3xl",
  };

  const subtitleSizes = {
    sm: "text-[9px] tracking-widest",
    default: "text-[10px] tracking-widest",
    lg: "text-xs tracking-[0.2em]",
  };

  return (
    <div className={cn("inline-flex items-center gap-3 select-none", className)}>
      {/* Premium Medical Emblem */}
      <div
        className={cn(
          "relative flex items-center justify-center rounded-xl bg-gradient-to-br from-medical-navy-800 to-medical-navy-950 text-white shadow-md border border-medical-navy-700/50",
          iconSizes[size]
        )}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-3/5 h-3/5"
        >
          {/* Medical Cross Base */}
          <rect
            x="13"
            y="6"
            width="6"
            height="20"
            rx="2.5"
            className="fill-medical-green-400"
          />
          <rect
            x="6"
            y="13"
            width="20"
            height="6"
            rx="2.5"
            className="fill-medical-green-400"
          />
          {/* Central Pulse/Shield Accent */}
          <path
            d="M9 16H13L15 12L17 20L19 16H23"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* Subtle glowing pill badge indicator */}
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-medical-green-500 ring-2 ring-white" />
      </div>

      {/* Typography */}
      <div className="flex flex-col text-left">
        <div className={cn("font-extrabold tracking-tight text-medical-navy-900 leading-none", titleSizes[size])}>
          IM <span className="text-medical-navy-700 font-black">MEDICOS</span>
          <span className="text-medical-green-600 ml-0.5">.</span>
        </div>
        {showSubtitle && (
          <span
            className={cn(
              "font-semibold uppercase text-medical-slate-500 mt-1",
              subtitleSizes[size]
            )}
          >
            Medical Billing Software
          </span>
        )}
      </div>
    </div>
  );
};

