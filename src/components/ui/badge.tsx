import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "highlight";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        "font-['Archivo']",
        {
          "bg-[#1a1a2e] text-white": variant === "default",
          "bg-[#dcd6f6] text-[#1a1a2e]": variant === "secondary",
          "border border-[#dcd6f6] text-[#1a1a2e]": variant === "outline",
          "bg-[#FF4F01] text-white": variant === "highlight",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
