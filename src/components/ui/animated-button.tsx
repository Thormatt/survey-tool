"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export interface AnimatedButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "highlight";
  size?: "default" | "sm" | "lg" | "icon";
}

const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  (
    { className, variant = "default", size = "default", children, ...props },
    ref
  ) => {
    return (
      <motion.button
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dcd6f6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf5ea]",
          "disabled:pointer-events-none disabled:opacity-50",
          "font-['Archivo']",
          {
            "bg-[#1a1a2e] text-white": variant === "default",
            "bg-[#dcd6f6] text-[#1a1a2e]": variant === "secondary",
            "border border-[#dcd6f6] bg-transparent text-[#1a1a2e]":
              variant === "outline",
            "text-[#1a1a2e]": variant === "ghost",
            "bg-[#FF4F01] text-white": variant === "highlight",
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
        whileHover={{
          scale: 1.02,
          y: -2,
          boxShadow:
            variant === "highlight"
              ? "0 10px 25px -5px rgba(255, 79, 1, 0.4)"
              : variant === "default"
                ? "0 10px 25px -5px rgba(26, 26, 46, 0.3)"
                : "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
        whileTap={{
          scale: 0.98,
          y: 0,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25,
        }}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);
AnimatedButton.displayName = "AnimatedButton";

export { AnimatedButton };
