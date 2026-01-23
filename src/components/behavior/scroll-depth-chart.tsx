"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ScrollDepthData } from "@/types/behavior";

interface ScrollDepthChartProps {
  data: ScrollDepthData[];
  questionTitles: Record<string, string>;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// Color scale from green (high engagement) to red (low engagement)
function getEngagementColor(depth: number): string {
  if (depth >= 80) return "#22c55e"; // green-500
  if (depth >= 60) return "#84cc16"; // lime-500
  if (depth >= 40) return "#eab308"; // yellow-500
  if (depth >= 20) return "#f97316"; // orange-500
  return "#ef4444"; // red-500
}

export function ScrollDepthChart({ data, questionTitles }: ScrollDepthChartProps) {
  // Transform data for the chart
  const chartData = data.map((item) => ({
    questionId: item.questionId,
    name: questionTitles[item.questionId] || `Question ${item.questionId.slice(0, 8)}`,
    depth: item.maxDepth,
    timeSpent: item.timeSpent,
    timeSpentFormatted: formatTime(item.timeSpent),
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No scroll depth data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scroll depth bars */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Scroll Depth by Question
        </h4>
        <ResponsiveContainer width="100%" height={chartData.length * 50 + 40}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 120, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value) => [`${value}%`, "Scroll Depth"]}
              labelStyle={{ fontWeight: "bold" }}
            />
            <Bar dataKey="depth" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getEngagementColor(entry.depth)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Time spent bars */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Time Spent by Question
        </h4>
        <ResponsiveContainer width="100%" height={chartData.length * 50 + 40}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 120, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(value) => formatTime(value)}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value) => [formatTime(value as number), "Time Spent"]}
              labelStyle={{ fontWeight: "bold" }}
            />
            <Bar
              dataKey="timeSpent"
              fill="#6366f1"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 pt-4 border-t">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-xs text-gray-600">High (80%+)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-lime-500" />
          <span className="text-xs text-gray-600">Good (60-80%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-yellow-500" />
          <span className="text-xs text-gray-600">Medium (40-60%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-orange-500" />
          <span className="text-xs text-gray-600">Low (20-40%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span className="text-xs text-gray-600">Very Low (&lt;20%)</span>
        </div>
      </div>
    </div>
  );
}
