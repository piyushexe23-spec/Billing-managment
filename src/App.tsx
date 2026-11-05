import React, { useState } from "react";
import { DashboardPage } from "@/pages/DashboardPage";
import { StoreDetailsPage } from "@/pages/StoreDetailsPage";
import { MedicinesPage } from "@/pages/MedicinesPage";
import { NewBillPage } from "@/pages/NewBillPage";
import { BillHistoryPage } from "@/pages/BillHistoryPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { BackupRestorePage } from "@/pages/BackupRestorePage";
import { ReportsPage } from "@/pages/ReportsPage";
import { AppLayout, NavItemKey } from "@/components/layout/AppLayout";

export const App: React.FC = () => {
  const [activeNav, setActiveNav] = useState<NavItemKey>("dashboard");

  return (
    <AppLayout activeItem={activeNav} onNavChange={setActiveNav}>
      {activeNav === "store_details" ? (
        <StoreDetailsPage />
      ) : activeNav === "medicines" ? (
        <MedicinesPage />
      ) : activeNav === "new_bill" ? (
        <NewBillPage />
      ) : activeNav === "bill_history" ? (
        <BillHistoryPage />
      ) : activeNav === "customers" ? (
        <CustomersPage />
      ) : activeNav === "reports" ? (
        <ReportsPage />
      ) : activeNav === "backup_restore" ? (
        <BackupRestorePage onRestoreSuccess={() => setActiveNav("dashboard")} />
      ) : (
        <DashboardPage />
      )}
    </AppLayout>
  );
};

export default App;
