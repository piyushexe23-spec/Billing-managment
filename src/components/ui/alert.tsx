import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "destructive";
  title?: string;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "info", title, children, ...props }, ref) => {
    const variants = {
      info: {
        container: "bg-blue-50/70 border-blue-200 text-blue-900",
        icon: <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />,
      },
      success: {
        container: "bg-medical-green-50/80 border-medical-green-200 text-medical-green-900",
        icon: <CheckCircle2 className="h-4 w-4 text-medical-green-600 mt-0.5 shrink-0" />,
      },
      warning: {
        container: "bg-amber-50/80 border-amber-200 text-amber-900",
        icon: <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />,
      },
      destructive: {
        container: "bg-red-50/80 border-red-200 text-red-900",
        icon: <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />,
      },
    };

    const currentVariant = variants[variant];

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "relative flex items-start gap-3 rounded-xl border p-3.5 text-xs transition-all",
          currentVariant.container,
          className
        )}
        {...props}
      >
        {currentVariant.icon}
        <div className="flex-1 space-y-0.5">
          {title && <h5 className="font-semibold leading-none tracking-tight">{title}</h5>}
          <div className="leading-relaxed opacity-90">{children}</div>
        </div>
      </div>
    );
  }
);
Alert.displayName = "Alert";

export { Alert };

