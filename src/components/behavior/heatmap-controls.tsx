"use client";

import { Monitor, Tablet, Smartphone, MousePointer, ArrowDown, Move, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ViewportBreakpoint } from "@/types/behavior";

type HeatmapType = "CLICK" | "SCROLL" | "MOVE" | "ATTENTION";

interface HeatmapControlsProps {
  selectedType: HeatmapType;
  selectedViewport: ViewportBreakpoint;
  onTypeChange: (type: HeatmapType) => void;
  onViewportChange: (viewport: ViewportBreakpoint) => void;
}

const heatmapTypes: Array<{ type: HeatmapType; label: string; icon: typeof MousePointer }> = [
  { type: "CLICK", label: "Clicks", icon: MousePointer },
  { type: "SCROLL", label: "Scroll Depth", icon: ArrowDown },
  { type: "MOVE", label: "Mouse Movement", icon: Move },
  { type: "ATTENTION", label: "Attention", icon: Eye },
];

const viewports: Array<{ type: ViewportBreakpoint; label: string; icon: typeof Monitor }> = [
  { type: "desktop", label: "Desktop", icon: Monitor },
  { type: "tablet", label: "Tablet", icon: Tablet },
  { type: "mobile", label: "Mobile", icon: Smartphone },
];

export function HeatmapControls({
  selectedType,
  selectedViewport,
  onTypeChange,
  onViewportChange,
}: HeatmapControlsProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white rounded-lg border p-4">
      {/* Heatmap type selector */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-600">Heatmap Type</span>
        <div className="flex gap-2">
          {heatmapTypes.map(({ type, label, icon: Icon }) => (
            <Button
              key={type}
              variant={selectedType === type ? "default" : "outline"}
              size="sm"
              onClick={() => onTypeChange(type)}
              className="gap-2"
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Viewport selector */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-600">Device</span>
        <div className="flex gap-2">
          {viewports.map(({ type, label, icon: Icon }) => (
            <Button
              key={type}
              variant={selectedViewport === type ? "default" : "outline"}
              size="sm"
              onClick={() => onViewportChange(type)}
              className="gap-2"
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
