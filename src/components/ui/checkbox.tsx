import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, checked, onChange, disabled, ...props }, ref) => {
    const inputId = id || React.useId();

    return (
      <div className="inline-flex items-center space-x-2 select-none">
        <div className="relative flex items-center justify-center">
          <input
            type="checkbox"
            id={inputId}
            ref={ref}
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="peer sr-only"
            {...props}
          />
          <div
            onClick={(e) => {
              if (disabled) return;
              const input = (e.currentTarget.previousSibling as HTMLInputElement);
              input?.click();
            }}
            className={cn(
              "h-4 w-4 shrink-0 rounded border border-medical-slate-300 bg-white transition-all cursor-pointer flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-medical-navy-600 peer-focus-visible:ring-offset-1 peer-checked:bg-medical-green-600 peer-checked:border-medical-green-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
              className
            )}
          >
            {checked && <Check className="h-3 w-3 text-white stroke-[3]" />}
          </div>
        </div>
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              "text-xs font-medium text-medical-slate-600 cursor-pointer",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };

