import React from "react";
import { Info, Database } from "lucide-react";

export const DevDataBanner: React.FC = () => {
  return (
    <div className="rounded-xl border border-blue-200/90 bg-blue-50/70 p-3 text-xs text-blue-900 flex items-start gap-3 select-none">
      <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
      <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="font-bold text-blue-950">Development Sample Data Active:</span>{" "}
          <span className="text-blue-800">
            Metrics, sales charts, and transaction lists currently display validated mock models. Production SQLite database binding will be wired during subsequent feature phases.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded border border-blue-200 font-semibold">
            <Database className="h-3 w-3" />
            Zero DB Seeding
          </span>
        </div>
      </div>
    </div>
  );
};
