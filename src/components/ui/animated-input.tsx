"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef, useState } from "react";

export interface AnimatedInputProps
  extends InputHTMLAttributes<HTMLInputElement> {}

const AnimatedInput = forwardRef<HTMLInputElement, AnimatedInputProps>(
  ({ className, type, onFocus, onBlur, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <motion.div
        className="relative"
        animate={{
          scale: isFocused ? 1.01 : 1,
        }}
        transition={{ type: "spring" as const, stiffness: 400, damping: 25 }}
      >
        <input
          type={type}
          className={cn(
            "flex h-11 w-full rounded-md border border-[#dcd6f6] bg-white px-4 py-2 text-sm",
            "font-['Archivo'] text-[#1a1a2e]",
            "placeholder:text-[#6b6b7b]",
            "transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dcd6f6] focus-visible:border-[#c9c1ed]",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#fbf5ea]",
            isFocused && "shadow-lg shadow-purple-100",
            className
          )}
          ref={ref}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
      </motion.div>
    );
  }
);
AnimatedInput.displayName = "AnimatedInput";

export { AnimatedInput };
