import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "link" | "accent";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-navy-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer";

    const variantStyles = {
      default:
        "bg-medical-navy-700 text-white shadow-sm hover:bg-medical-navy-800 active:bg-medical-navy-900 border border-medical-navy-800",
      secondary:
        "bg-medical-slate-100 text-medical-slate-800 hover:bg-medical-slate-200 border border-medical-slate-200",
      outline:
        "border border-medical-slate-300 bg-white text-medical-slate-700 hover:bg-medical-slate-50 hover:text-medical-navy-900 shadow-sm",
      ghost:
        "text-medical-slate-600 hover:bg-medical-slate-100 hover:text-medical-navy-900",
      link:
        "text-medical-navy-600 underline-offset-4 hover:underline p-0 h-auto",
      accent:
        "bg-medical-green-600 text-white shadow-sm hover:bg-medical-green-700 active:bg-medical-green-800 border border-medical-green-700",
    };

    const sizeStyles = {
      default: "h-10 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-11 rounded-lg px-6 text-base font-semibold",
      icon: "h-10 w-10 p-0",
    };

    return (
      <button
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };

