"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnimatedCheckProps {
  isVisible: boolean;
  className?: string;
  size?: number;
}

export function AnimatedCheck({
  isVisible,
  className,
  size = 20,
}: AnimatedCheckProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 25,
          }}
          className={cn("text-green-500", className)}
        >
          <motion.div
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Check size={size} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface AnimatedXProps {
  isVisible: boolean;
  className?: string;
  size?: number;
}

export function AnimatedX({ isVisible, className, size = 20 }: AnimatedXProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ scale: 0, opacity: 0, rotate: -90 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0, opacity: 0, rotate: 90 }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 25,
          }}
          className={cn("text-red-500", className)}
        >
          <X size={size} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface AnimatedSpinnerProps {
  isLoading: boolean;
  className?: string;
  size?: number;
}

export function AnimatedSpinner({
  isLoading,
  className,
  size = 20,
}: AnimatedSpinnerProps) {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, rotate: 360 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{
            opacity: { duration: 0.2 },
            scale: { duration: 0.2 },
            rotate: { duration: 1, repeat: Infinity, ease: "linear" },
          }}
          className={className}
        >
          <Loader2 size={size} className="text-[#FF4F01]" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface PulseRingProps {
  isActive: boolean;
  className?: string;
  color?: string;
}

export function PulseRing({
  isActive,
  className,
  color = "#FF4F01",
}: PulseRingProps) {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className={cn("absolute inset-0 rounded-full", className)}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{
            scale: [1, 1.4, 1.8],
            opacity: [0.6, 0.3, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeOut",
          }}
          style={{
            border: `2px solid ${color}`,
          }}
        />
      )}
    </AnimatePresence>
  );
}

interface SuccessConfettiProps {
  isVisible: boolean;
}

export function SuccessConfetti({ isVisible }: SuccessConfettiProps) {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: (i * 30 * Math.PI) / 180,
    delay: i * 0.05,
    color: ["#FF4F01", "#c9c1ed", "#1a1a2e", "#dcd6f6"][i % 4],
  }));

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div className="absolute inset-0 pointer-events-none overflow-hidden">
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full"
              style={{ backgroundColor: particle.color }}
              initial={{
                x: 0,
                y: 0,
                scale: 0,
                opacity: 1,
              }}
              animate={{
                x: Math.cos(particle.angle) * 60,
                y: Math.sin(particle.angle) * 60,
                scale: [0, 1, 0.5],
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: 0.8,
                delay: particle.delay,
                ease: "easeOut",
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface CountUpProps {
  value: number;
  duration?: number;
  className?: string;
}

export function CountUp({ value, duration = 1, className }: CountUpProps) {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {value}
      </motion.span>
    </motion.span>
  );
}

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ProgressRing({
  progress,
  size = 48,
  strokeWidth = 4,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <motion.svg
      width={size}
      height={size}
      className={cn("-rotate-90", className)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#dcd6f6"
        strokeWidth={strokeWidth}
      />
      {/* Progress circle */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#FF4F01"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: "easeOut" }}
        style={{
          strokeDasharray: circumference,
        }}
      />
    </motion.svg>
  );
}
