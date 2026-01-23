"use client";

import { useEffect, useRef } from "react";
import type { HeatmapDataPayload } from "@/types/behavior";

interface HeatmapCanvasProps {
  data: HeatmapDataPayload;
  width: number;
  height: number;
  type: "CLICK" | "SCROLL" | "MOVE" | "ATTENTION";
  opacity?: number;
}

// Color gradients for different heatmap types
const COLOR_GRADIENTS = {
  CLICK: [
    { stop: 0, color: "rgba(0, 0, 255, 0)" },
    { stop: 0.25, color: "rgba(0, 255, 255, 0.5)" },
    { stop: 0.5, color: "rgba(0, 255, 0, 0.7)" },
    { stop: 0.75, color: "rgba(255, 255, 0, 0.8)" },
    { stop: 1, color: "rgba(255, 0, 0, 0.9)" },
  ],
  SCROLL: [
    { stop: 0, color: "rgba(100, 149, 237, 0)" },
    { stop: 0.5, color: "rgba(100, 149, 237, 0.4)" },
    { stop: 1, color: "rgba(100, 149, 237, 0.8)" },
  ],
  MOVE: [
    { stop: 0, color: "rgba(128, 0, 128, 0)" },
    { stop: 0.5, color: "rgba(128, 0, 128, 0.3)" },
    { stop: 1, color: "rgba(128, 0, 128, 0.6)" },
  ],
  ATTENTION: [
    { stop: 0, color: "rgba(255, 165, 0, 0)" },
    { stop: 0.5, color: "rgba(255, 165, 0, 0.5)" },
    { stop: 1, color: "rgba(255, 0, 0, 0.8)" },
  ],
};

// Gaussian blur radius for smooth heatmaps
const BLUR_RADIUS = 15;

/**
 * Interpolate between colors based on normalized value (0-1)
 */
function interpolateColor(
  value: number,
  gradient: Array<{ stop: number; color: string }>
): string {
  // Find the two stops to interpolate between
  let lowerStop = gradient[0];
  let upperStop = gradient[gradient.length - 1];

  for (let i = 0; i < gradient.length - 1; i++) {
    if (value >= gradient[i].stop && value <= gradient[i + 1].stop) {
      lowerStop = gradient[i];
      upperStop = gradient[i + 1];
      break;
    }
  }

  // Normalize value between the two stops
  const range = upperStop.stop - lowerStop.stop;
  const normalized = range > 0 ? (value - lowerStop.stop) / range : 0;

  // Parse colors
  const parseRgba = (color: string) => {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) return { r: 0, g: 0, b: 0, a: 1 };
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3]),
      a: match[4] ? parseFloat(match[4]) : 1,
    };
  };

  const lower = parseRgba(lowerStop.color);
  const upper = parseRgba(upperStop.color);

  // Interpolate
  const r = Math.round(lower.r + (upper.r - lower.r) * normalized);
  const g = Math.round(lower.g + (upper.g - lower.g) * normalized);
  const b = Math.round(lower.b + (upper.b - lower.b) * normalized);
  const a = lower.a + (upper.a - lower.a) * normalized;

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function HeatmapCanvas({
  data,
  width,
  height,
  type,
  opacity = 0.8,
}: HeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (data.points.length === 0 || data.maxCount === 0) {
      return;
    }

    // Calculate scale factors
    const scaleX = width / data.width;
    const scaleY = height / data.height;

    // Create a temporary canvas for the heatmap
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    // Draw each point as a radial gradient
    const gradient = COLOR_GRADIENTS[type];

    for (const point of data.points) {
      const x = point.x * scaleX;
      const y = point.y * scaleY;
      const intensity = point.count / data.maxCount;

      // Create radial gradient for this point
      const radius = BLUR_RADIUS + intensity * 20;
      const radialGradient = tempCtx.createRadialGradient(x, y, 0, x, y, radius);

      // Add color stops
      const color = interpolateColor(intensity, gradient);
      radialGradient.addColorStop(0, color);
      radialGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      // Draw the point
      tempCtx.globalAlpha = Math.min(1, intensity + 0.1);
      tempCtx.fillStyle = radialGradient;
      tempCtx.beginPath();
      tempCtx.arc(x, y, radius, 0, Math.PI * 2);
      tempCtx.fill();
    }

    // Apply Gaussian blur for smoother appearance
    ctx.filter = `blur(${BLUR_RADIUS / 2}px)`;
    ctx.globalAlpha = opacity;
    ctx.drawImage(tempCanvas, 0, 0);

    // Reset filter
    ctx.filter = "none";
  }, [data, width, height, type, opacity]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-lg"
        style={{
          background: "linear-gradient(to bottom, #f8fafc, #e2e8f0)",
        }}
      />

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white/90 rounded-lg p-3 shadow-sm">
        <div className="text-xs text-gray-600 mb-2">Intensity</div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">Low</span>
          <div
            className="w-24 h-3 rounded"
            style={{
              background: `linear-gradient(to right, ${COLOR_GRADIENTS[type]
                .map((g) => g.color)
                .join(", ")})`,
            }}
          />
          <span className="text-xs text-gray-400">High</span>
        </div>
        {data.maxCount > 0 && (
          <div className="text-xs text-gray-500 mt-1">
            Max: {data.maxCount} interactions
          </div>
        )}
      </div>

      {/* Empty state */}
      {data.points.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-gray-400">No data available</p>
        </div>
      )}
    </div>
  );
}
