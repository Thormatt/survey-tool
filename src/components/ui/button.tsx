import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "highlight";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dcd6f6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf5ea]",
          "disabled:pointer-events-none disabled:opacity-50",
          "font-['Archivo']",
          {
            "bg-[#1a1a2e] text-white hover:bg-[#2a2a3e]": variant === "default",
            "bg-[#dcd6f6] text-[#1a1a2e] hover:bg-[#c9c1ed]": variant === "secondary",
            "border border-[#dcd6f6] bg-transparent text-[#1a1a2e] hover:bg-[#dcd6f6]/20": variant === "outline",
            "text-[#1a1a2e] hover:bg-[#dcd6f6]/30": variant === "ghost",
            "bg-[#FF4F01] text-white hover:bg-[#e54600]": variant === "highlight",
          },
          {
            "h-10 px-5 py-2 text-sm": size === "default",
            "h-8 px-3 text-xs": size === "sm",
            "h-12 px-8 text-base": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
