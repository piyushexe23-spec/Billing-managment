import React from "react";
import { TopMedicine } from "@/types/dashboard";
import { formatCurrencyINR } from "@/lib/formatters";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Flame } from "lucide-react";

interface TopSellingMedicinesProps {
  medicines: TopMedicine[];
}

export const TopSellingMedicines: React.FC<TopSellingMedicinesProps> = ({ medicines }) => {
  const maxQty = Math.max(...medicines.map((m) => m.quantitySold), 1);

  return (
    <Card className="border border-medical-slate-200/80 bg-white shadow-xs rounded-xl overflow-hidden flex flex-col h-full">
      <CardHeader className="p-5 pb-3 border-b border-medical-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-medical-navy-900">
              Top Selling Medicines
            </CardTitle>
            <p className="text-xs text-medical-slate-500">
              Ranked by quantity sold this period
            </p>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-medical-slate-500 bg-medical-slate-100 px-2 py-0.5 rounded-full">
          Top 5
        </span>
      </CardHeader>

      <CardContent className="p-5 flex-1 divide-y divide-medical-slate-100">
        {medicines.map((med, index) => {
          const percentage = Math.round((med.quantitySold / maxQty) * 100);

          return (
            <div key={med.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-medical-slate-100 text-medical-slate-700 font-bold text-[11px] shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-medical-navy-900 leading-tight">
                      {med.name}
                    </h4>
                    {med.genericName && (
                      <p className="text-[11px] text-medical-slate-500 mt-0.5">
                        {med.genericName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-medical-navy-900">
                    {formatCurrencyINR(med.totalSalesAmount)}
                  </span>
                  <p className="text-[11px] text-medical-slate-500 font-medium">
                    {med.quantitySold} {med.unit}
                  </p>
                </div>
              </div>

              {/* Relative performance progress track */}
              <div className="mt-2 w-full bg-medical-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-medical-navy-700 h-full rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
