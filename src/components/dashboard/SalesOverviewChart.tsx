import React, { useState } from "react";
import { SalesDataPoint, DateRangeKey } from "@/types/dashboard";
import { formatCurrencyINR } from "@/lib/formatters";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface SalesOverviewChartProps {
  data: SalesDataPoint[];
  selectedRange: DateRangeKey;
  onRangeChange: (range: DateRangeKey) => void;
  isLoading?: boolean;
}

export const SalesOverviewChart: React.FC<SalesOverviewChartProps> = ({
  data,
  selectedRange,
  onRangeChange,
  isLoading = false,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Calculate metrics
  const totalSales = data.reduce((acc, curr) => acc + curr.sales, 0);
  const avgSales = data.length > 0 ? Math.round(totalSales / data.length) : 0;
  const maxSales = Math.max(...data.map((d) => d.sales), 1000);
  const minSales = 0;

  // Chart dimensions inside SVG coordinate space
  const svgWidth = 720;
  const svgHeight = 220;
  const paddingLeft = 65;
  const paddingRight = 25;
  const paddingTop = 20;
  const paddingBottom = 35;

  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  // Coordinate mapping functions
  const getX = (index: number) => {
    if (data.length <= 1) return paddingLeft + plotWidth / 2;
    return paddingLeft + (index / (data.length - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    const ratio = (val - minSales) / (maxSales - minSales);
    return paddingTop + plotHeight - ratio * plotHeight;
  };

  // Generate SVG smooth path line
  const points = data.map((d, i) => `${getX(i)},${getY(d.sales)}`);
  const pathD = points.length > 0 ? `M ${points.join(" L ")}` : "";
  const areaD =
    points.length > 0
      ? `M ${getX(0)},${paddingTop + plotHeight} L ${points.join(" L ")} L ${getX(
          data.length - 1
        )},${paddingTop + plotHeight} Z`
      : "";

  // 4 Y-axis ticks
  const yTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const val = minSales + (maxSales - minSales) * pct;
    return {
      value: val,
      y: paddingTop + plotHeight - pct * plotHeight,
      label: formatCurrencyINR(val),
    };
  });

  return (
    <Card className="border border-medical-slate-200/80 bg-white shadow-xs rounded-xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-medical-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-medical-navy-700" />
            <CardTitle className="text-base font-bold text-medical-navy-900">
              Sales Revenue Overview
            </CardTitle>
          </div>
          <p className="text-xs text-medical-slate-500 mt-0.5">
            Range Revenue: <strong className="text-medical-navy-900 font-semibold">{formatCurrencyINR(totalSales)}</strong>
            <span className="mx-2">•</span>
            Avg Daily: <span className="text-medical-slate-700 font-medium">{formatCurrencyINR(avgSales)}</span>
          </p>
        </div>

        {/* Date Range Selector Buttons */}
        <div className="inline-flex items-center bg-medical-slate-100/90 p-1 rounded-lg border border-medical-slate-200/80 select-none">
          <button
            type="button"
            onClick={() => onRangeChange("7d")}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
              selectedRange === "7d"
                ? "bg-white text-medical-navy-900 shadow-xs border border-medical-slate-200/60"
                : "text-medical-slate-600 hover:text-medical-navy-900"
            )}
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => onRangeChange("30d")}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
              selectedRange === "30d"
                ? "bg-white text-medical-navy-900 shadow-xs border border-medical-slate-200/60"
                : "text-medical-slate-600 hover:text-medical-navy-900"
            )}
          >
            30 Days
          </button>
          <button
            type="button"
            onClick={() => onRangeChange("12m")}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
              selectedRange === "12m"
                ? "bg-white text-medical-navy-900 shadow-xs border border-medical-slate-200/60"
                : "text-medical-slate-600 hover:text-medical-navy-900"
            )}
          >
            12 Months
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-4">
        {/* Interactive SVG Chart Container */}
        <div className="relative w-full aspect-[21/8] min-h-[220px]">
          {isLoading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-20">
              <span className="text-xs text-medical-slate-500 font-medium">Updating trend...</span>
            </div>
          )}

          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-full overflow-visible select-none"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <defs>
              {/* Subtle Area Gradient */}
              <linearGradient id="salesAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#133560" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#133560" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines & Y-Axis Labels */}
            {yTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={tick.y}
                  x2={svgWidth - paddingRight}
                  y2={tick.y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray={i === 0 ? "0" : "3,3"}
                />
                <text
                  x={paddingLeft - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="text-[10px] fill-medical-slate-400 font-sans"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Area Fill */}
            {areaD && (
              <path d={areaD} fill="url(#salesAreaGradient)" />
            )}

            {/* Main Trend Line */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="#133560"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Hover Vertical Guide Line */}
            {hoveredIndex !== null && data[hoveredIndex] && (
              <line
                x1={getX(hoveredIndex)}
                y1={paddingTop}
                x2={getX(hoveredIndex)}
                y2={paddingTop + plotHeight}
                stroke="#059669"
                strokeWidth="1.5"
                strokeDasharray="2,2"
              />
            )}

            {/* Data Point Dots & Hover Hit Targets */}
            {data.map((d, i) => {
              const cx = getX(i);
              const cy = getY(d.sales);
              const isHovered = hoveredIndex === i;

              return (
                <g
                  key={i}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                >
                  {/* Invisible Hit Area */}
                  <rect
                    x={cx - 15}
                    y={paddingTop}
                    width={30}
                    height={plotHeight}
                    fill="transparent"
                  />

                  {/* Visual Node Dot */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6 : 3.5}
                    className={cn(
                      "transition-all duration-150",
                      isHovered
                        ? "fill-medical-green-600 stroke-white stroke-2"
                        : "fill-white stroke-medical-navy-800 stroke-2"
                    )}
                  />

                  {/* X-Axis Date Labels */}
                  <text
                    x={cx}
                    y={paddingTop + plotHeight + 18}
                    textAnchor="middle"
                    className={cn(
                      "text-[10px] font-medium transition-colors font-sans",
                      isHovered
                        ? "fill-medical-navy-900 font-bold"
                        : "fill-medical-slate-500"
                    )}
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Interactive Floating Tooltip */}
          {hoveredIndex !== null && data[hoveredIndex] && (
            <div
              className="absolute pointer-events-none z-30 transition-all duration-75 transform -translate-x-1/2 -translate-y-full"
              style={{
                left: `${(getX(hoveredIndex) / svgWidth) * 100}%`,
                top: `${(getY(data[hoveredIndex].sales) / svgHeight) * 100 - 8}%`,
              }}
            >
              <div className="bg-medical-navy-950 text-white px-3 py-2 rounded-lg shadow-xl border border-medical-navy-700/60 text-xs min-w-[130px]">
                <div className="text-[10px] text-medical-slate-300 font-medium border-b border-medical-navy-800 pb-1 flex items-center justify-between">
                  <span>{data[hoveredIndex].label}</span>
                  <span className="text-[9px] text-medical-slate-400 font-mono">
                    {data[hoveredIndex].date}
                  </span>
                </div>
                <div className="pt-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-white">
                    {formatCurrencyINR(data[hoveredIndex].sales)}
                  </span>
                  <span className="text-[10px] text-medical-green-400 font-medium">
                    {data[hoveredIndex].billCount} bills
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
