import React, { useState, useEffect } from "react";
import { SummaryCardsGrid } from "@/components/dashboard/SummaryCardsGrid";
import { SalesOverviewChart } from "@/components/dashboard/SalesOverviewChart";
import { TopSellingMedicines } from "@/components/dashboard/TopSellingMedicines";
import { LowStockMedicines } from "@/components/dashboard/LowStockMedicines";
import { RecentBillsTable } from "@/components/dashboard/RecentBillsTable";
import { DevDataBanner } from "@/components/dashboard/DevDataBanner";
import { dashboardService } from "@/services/dashboardService";
import {
  DashboardOverview,
  SalesDataPoint,
  DateRangeKey,
  TopMedicine,
  LowStockItem,
  RecentBillItem,
} from "@/types/dashboard";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const DashboardPage: React.FC = () => {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [salesData, setSalesData] = useState<SalesDataPoint[]>([]);
  const [selectedRange, setSelectedRange] = useState<DateRangeKey>("7d");
  const [topMedicines, setTopMedicines] = useState<TopMedicine[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [recentBills, setRecentBills] = useState<RecentBillItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChartLoading, setIsChartLoading] = useState(false);

  // Initial load
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [overviewRes, chartRes, topMedsRes, lowStockRes, billsRes] =
        await Promise.all([
          dashboardService.getOverview(),
          dashboardService.getSalesChart(selectedRange),
          dashboardService.getTopSellingMedicines(),
          dashboardService.getLowStockMedicines(),
          dashboardService.getRecentBills(),
        ]);

      setOverview(overviewRes);
      setSalesData(chartRes);
      setTopMedicines(topMedsRes);
      setLowStockItems(lowStockRes);
      setRecentBills(billsRes);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRangeChange = async (range: DateRangeKey) => {
    setSelectedRange(range);
    setIsChartLoading(true);
    try {
      const newChartData = await dashboardService.getSalesChart(range);
      setSalesData(newChartData);
    } finally {
      setIsChartLoading(false);
    }
  };

  if (isLoading || !overview) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2 text-medical-slate-500">
          <RefreshCw className="h-6 w-6 animate-spin text-medical-navy-700" />
          <span className="text-xs font-semibold">Loading IM MEDICOS Dashboard...</span>
        </div>
      </div>
    );
  }

  const cardsList = [
    overview.summary.todaySales,
    overview.summary.todayProfit,
    overview.summary.todayBills,
    overview.summary.monthSales,
    overview.summary.totalMedicines,
    overview.summary.lowStockMedicines,
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Sample Data Disclaimer Banner */}
      {overview.isDevSampleData && <DevDataBanner />}

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-medical-navy-950 tracking-tight">
            Pharmacy Executive Dashboard
          </h2>
          <p className="text-xs text-medical-slate-500 mt-0.5">
            Real-time financial summaries, stock depletion, and daily prescription sales.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs text-medical-slate-400 font-mono hidden sm:inline-block">
            Last updated: {overview.lastUpdated}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllData}
            className="text-xs gap-1.5 h-8 bg-white"
          >
            <RefreshCw className="h-3 w-3 text-medical-slate-500" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Section A: 6 Summary Cards */}
      <section aria-label="Key Performance Indicators">
        <SummaryCardsGrid cards={cardsList} />
      </section>

      {/* Section B: Sales Overview Chart */}
      <section aria-label="Sales Overview">
        <SalesOverviewChart
          data={salesData}
          selectedRange={selectedRange}
          onRangeChange={handleRangeChange}
          isLoading={isChartLoading}
        />
      </section>

      {/* Section C & D: Top Selling Medicines (50%) & Low Stock Alerts (50%) */}
      <section aria-label="Medicine Inventory Analytics" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopSellingMedicines medicines={topMedicines} />
        <LowStockMedicines items={lowStockItems} />
      </section>

      {/* Section E: Recent Bills */}
      <section aria-label="Recent Bills">
        <RecentBillsTable bills={recentBills} />
      </section>
    </div>
  );
};
