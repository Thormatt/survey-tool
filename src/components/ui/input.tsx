import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-md border border-[#dcd6f6] bg-white px-4 py-2 text-sm",
          "font-['Archivo'] text-[#1a1a2e]",
          "placeholder:text-[#6b6b7b]",
          "transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dcd6f6] focus-visible:border-[#c9c1ed]",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#fbf5ea]",
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
