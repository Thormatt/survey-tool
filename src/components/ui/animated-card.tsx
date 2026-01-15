"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export interface AnimatedCardProps
  extends Omit<HTMLMotionProps<"div">, "ref"> {
  variant?: "default" | "elevated" | "interactive";
  delay?: number;
}

const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ className, variant = "default", delay = 0, children, ...props }, ref) => {
    const variants = {
      default: {
        initial: { opacity: 0, y: 20 },
        animate: {
          opacity: 1,
          y: 0,
          transition: {
            type: "spring" as const,
            stiffness: 260,
            damping: 20,
            delay,
          },
        },
      },
      elevated: {
        initial: { opacity: 0, y: 30, scale: 0.95 },
        animate: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            type: "spring" as const,
            stiffness: 300,
            damping: 25,
            delay,
          },
        },
        whileHover: {
          y: -8,
          scale: 1.02,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
          transition: {
            type: "spring" as const,
            stiffness: 400,
            damping: 20,
          },
        },
      },
      interactive: {
        initial: { opacity: 0, scale: 0.9 },
        animate: {
          opacity: 1,
          scale: 1,
          transition: {
            type: "spring" as const,
            stiffness: 400,
            damping: 25,
            delay,
          },
        },
        whileHover: {
          scale: 1.05,
          transition: {
            type: "spring" as const,
            stiffness: 400,
            damping: 15,
          },
        },
        whileTap: {
          scale: 0.98,
        },
      },
    };

    const selectedVariant = variants[variant];

    return (
      <motion.div
        className={cn(
          "rounded-xl border border-[#dcd6f6] bg-white shadow-sm",
          className
        )}
        ref={ref}
        initial={selectedVariant.initial}
        animate={selectedVariant.animate}
        whileHover={"whileHover" in selectedVariant ? selectedVariant.whileHover : undefined}
        whileTap={"whileTap" in selectedVariant ? selectedVariant.whileTap : undefined}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
AnimatedCard.displayName = "AnimatedCard";

// Card content wrapper with stagger effect
const AnimatedCardContent = forwardRef<
  HTMLDivElement,
  HTMLMotionProps<"div"> & { staggerDelay?: number }
>(({ className, staggerDelay = 0.1, children, ...props }, ref) => {
  return (
    <motion.div
      className={cn("p-6", className)}
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: staggerDelay }}
      {...props}
    >
      {children}
    </motion.div>
  );
});
AnimatedCardContent.displayName = "AnimatedCardContent";

export { AnimatedCard, AnimatedCardContent };
