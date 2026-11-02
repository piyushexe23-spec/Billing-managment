import React from "react";
import {
  IndianRupee,
  TrendingUp,
  Receipt,
  BarChart3,
  Pill,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SummaryCardData } from "@/types/dashboard";
import { cn } from "@/lib/utils";

interface SummaryCardsGridProps {
  cards: SummaryCardData[];
}

export const SummaryCardsGrid: React.FC<SummaryCardsGridProps> = ({ cards }) => {
  const getIcon = (name: string, color: string) => {
    const props = { className: cn("h-5 w-5", color) };
    switch (name) {
      case "IndianRupee":
        return <IndianRupee {...props} />;
      case "TrendingUp":
        return <TrendingUp {...props} />;
      case "Receipt":
        return <Receipt {...props} />;
      case "BarChart3":
        return <BarChart3 {...props} />;
      case "Pill":
        return <Pill {...props} />;
      case "AlertTriangle":
        return <AlertTriangle {...props} />;
      default:
        return <BarChart3 {...props} />;
    }
  };

  const getAccentConfig = (color?: string) => {
    switch (color) {
      case "green":
        return {
          iconBg: "bg-medical-green-50 border-medical-green-200/60",
          iconColor: "text-medical-green-700",
          badgeBg: "bg-medical-green-50 text-medical-green-800 border-medical-green-200",
        };
      case "amber":
        return {
          iconBg: "bg-amber-50 border-amber-200/80",
          iconColor: "text-amber-700",
          badgeBg: "bg-amber-100 text-amber-900 border-amber-300 font-semibold",
        };
      case "blue":
        return {
          iconBg: "bg-blue-50 border-blue-200/60",
          iconColor: "text-blue-700",
          badgeBg: "bg-blue-50 text-blue-800 border-blue-200",
        };
      case "navy":
      default:
        return {
          iconBg: "bg-medical-navy-50 border-medical-navy-100",
          iconColor: "text-medical-navy-800",
          badgeBg: "bg-medical-slate-100 text-medical-slate-700 border-medical-slate-200",
        };
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card) => {
        const config = getAccentConfig(card.accentColor);
        return (
          <Card
            key={card.id}
            className="border border-medical-slate-200/80 bg-white shadow-xs hover:shadow-md transition-all duration-200 rounded-xl overflow-hidden group"
          >
            <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
              {/* Header: Title and Icon */}
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold text-medical-slate-500 uppercase tracking-wider">
                  {card.title}
                </span>
                <div
                  className={cn(
                    "p-2 rounded-lg border transition-transform duration-150 group-hover:scale-105",
                    config.iconBg
                  )}
                >
                  {getIcon(card.iconName, config.iconColor)}
                </div>
              </div>

              {/* Value */}
              <div>
                <div className="text-2xl font-bold text-medical-navy-900 tracking-tight font-sans">
                  {card.value}
                </div>
              </div>

              {/* Supporting Label / Comparison */}
              <div className="pt-1 border-t border-medical-slate-100 flex items-center justify-between text-[11px]">
                {card.trendLabel && (
                  <span
                    className={cn(
                      "font-medium flex items-center gap-1",
                      card.trendDirection === "up"
                        ? "text-medical-green-700"
                        : card.trendDirection === "warning"
                        ? "text-amber-700 font-semibold"
                        : "text-medical-slate-500"
                    )}
                  >
                    {card.trendDirection === "up" && (
                      <ArrowUpRight className="h-3 w-3 inline text-medical-green-600" />
                    )}
                    {card.trendLabel}
                  </span>
                )}
                {card.badgeText && (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] border",
                      config.badgeBg
                    )}
                  >
                    {card.badgeText}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

