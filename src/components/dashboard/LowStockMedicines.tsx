import React, { useState } from "react";
import { LowStockItem } from "@/types/dashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AlertTriangle, PackageCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface LowStockMedicinesProps {
  items: LowStockItem[];
}

export const LowStockMedicines: React.FC<LowStockMedicinesProps> = ({ items }) => {
  const [filterMode, setFilterMode] = useState<"all" | "empty_test">("all");

  const displayItems = filterMode === "empty_test" ? [] : items;

  return (
    <Card className="border border-medical-slate-200/80 bg-white shadow-xs rounded-xl overflow-hidden flex flex-col h-full">
      <CardHeader className="p-5 pb-3 border-b border-medical-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-medical-navy-900">
              Low Stock Alerts
            </CardTitle>
            <p className="text-xs text-medical-slate-500">
              At or below minimum safety stock threshold
            </p>
          </div>
        </div>

        {/* Test empty state toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterMode(filterMode === "all" ? "empty_test" : "all")}
            className="text-[11px] text-medical-slate-400 hover:text-medical-navy-800 underline cursor-pointer"
            title="Toggle to test empty stock alert state"
          >
            {filterMode === "all" ? "Test Empty State" : "Show Alerts"}
          </button>
          <span
            className={cn(
              "text-[11px] font-bold px-2 py-0.5 rounded-full border",
              displayItems.length > 0
                ? "bg-amber-100 text-amber-900 border-amber-300"
                : "bg-medical-green-50 text-medical-green-800 border-medical-green-200"
            )}
          >
            {displayItems.length} Items
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-5 flex-1">
        {displayItems.length === 0 ? (
          /* Empty State as explicitly required */
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center h-full">
            <div className="w-12 h-12 rounded-full bg-medical-green-50 border border-medical-green-200/80 flex items-center justify-center text-medical-green-600 mb-3">
              <PackageCheck className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-medical-navy-900">
              Optimal Inventory Levels
            </h4>
            <p className="text-xs text-medical-slate-500 max-w-[260px] mt-1 leading-relaxed">
              All medicines are currently above minimum safety stock thresholds. No urgent reorders required.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayItems.map((item) => {
              const isCritical = item.urgency === "critical";

              return (
                <div
                  key={item.id}
                  className="p-3 rounded-lg border border-medical-slate-200/80 bg-medical-slate-50/50 hover:bg-white hover:border-medical-slate-300 transition-all flex items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-medical-navy-900">
                        {item.name}
                      </span>
                      <span className="text-[10px] font-mono text-medical-slate-400">
                        {item.batchNo}
                      </span>
                    </div>
                    <div className="text-[11px] text-medical-slate-500 flex items-center gap-3">
                      <span>
                        Min Threshold: <strong className="text-medical-slate-700">{item.minThreshold} {item.unit}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right shrink-0">
                    <div>
                      <span
                        className={cn(
                          "text-sm font-bold block",
                          isCritical ? "text-red-600" : "text-amber-700"
                        )}
                      >
                        {item.availableStock} {item.unit}
                      </span>
                      <span className="text-[10px] text-medical-slate-400">Available</span>
                    </div>

                    <span
                      className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border",
                        isCritical
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      )}
                    >
                      {isCritical ? "Critical" : "Reorder"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
