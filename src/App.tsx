import React, { useState, useEffect } from "react";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { StoreDetailsPage } from "@/pages/StoreDetailsPage";
import { MedicinesPage } from "@/pages/MedicinesPage";
import { NewBillPage } from "@/pages/NewBillPage";
import { BillHistoryPage } from "@/pages/BillHistoryPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { AppLayout, NavItemKey } from "@/components/layout/AppLayout";
import { authService, AuthUser } from "@/services/authService";
import { Loader2, ShieldCheck } from "lucide-react";

export const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeNav, setActiveNav] = useState<NavItemKey>("dashboard");

  // Restore authenticated session on startup/refresh
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        const result = await authService.restoreSession();
        if (isMounted) {
          if (result.isAuthenticated && result.user) {
            setCurrentUser(result.user);
            setIsAuthenticated(true);
          } else {
            setCurrentUser(null);
            setIsAuthenticated(false);
          }
        }
      } catch (err) {
        console.error("Session verification failed:", err);
        if (isMounted) {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLoginSuccess = async (user: {
    username: string;
    role: string;
    displayName: string;
    rememberMe: boolean;
  }) => {
    const authUser: AuthUser = {
      username: user.username,
      role: user.role,
      displayName: user.displayName,
    };

    // Cryptographically sign and persist session token
    await authService.saveSession(authUser, user.rememberMe);

    setCurrentUser(authUser);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    authService.clearSession();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  // Loading state while restoring session to prevent login screen flash
  if (isInitializing) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-medical-navy-950 text-white select-none">
        <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-medical-navy-900/80 border border-medical-navy-800 shadow-2xl">
          <Loader2 className="h-8 w-8 animate-spin text-medical-green-400" />
          <div className="text-center space-y-1">
            <h3 className="text-sm font-bold text-white tracking-wide">
              IM MEDICOS
            </h3>
            <p className="text-xs text-medical-slate-400 flex items-center justify-center gap-1.5 font-mono">
              <ShieldCheck className="h-3.5 w-3.5 text-medical-green-400" />
              Verifying workstation security session...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Protected route: unauthenticated access always shows Login
  if (!isAuthenticated || !currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <AppLayout
      currentUser={currentUser.username}
      onLogout={handleLogout}
      activeItem={activeNav}
      onNavChange={setActiveNav}
    >
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
      ) : (
        <DashboardPage />
      )}
    </AppLayout>
  );
};

export default App;
