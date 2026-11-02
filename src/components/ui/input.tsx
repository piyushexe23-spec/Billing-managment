import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-medical-slate-900 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-medical-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200"
            : "border-medical-slate-300 focus-visible:border-medical-navy-600 focus-visible:ring-medical-navy-100",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
