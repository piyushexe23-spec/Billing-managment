import React, { useState } from "react";
import { Logo } from "@/components/brand/logo";
import {
  LayoutDashboard,
  Receipt,
  History,
  Pill,
  Users,
  BarChart3,
  Store,
  DatabaseBackup,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItemKey =
  | "dashboard"
  | "new_bill"
  | "bill_history"
  | "medicines"
  | "customers"
  | "reports"
  | "store_details"
  | "backup_restore";

interface AppLayoutProps {
  currentUser?: string;
  onLogout: () => void;
  children: React.ReactNode;
}

interface NavItemConfig {
  key: NavItemKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isImplemented: boolean;
  phaseText?: string;
}

const NAV_ITEMS: NavItemConfig[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, isImplemented: true },
  { key: "new_bill", label: "New Bill", icon: Receipt, isImplemented: false, phaseText: "Phase 4" },
  { key: "bill_history", label: "Bill History", icon: History, isImplemented: false, phaseText: "Phase 4" },
  { key: "medicines", label: "Medicines", icon: Pill, isImplemented: false, phaseText: "Phase 3" },
  { key: "customers", label: "Customers", icon: Users, isImplemented: false, phaseText: "Phase 3" },
  { key: "reports", label: "Reports", icon: BarChart3, isImplemented: false, phaseText: "Phase 5" },
  { key: "store_details", label: "Store Details", icon: Store, isImplemented: false, phaseText: "Phase 6" },
  { key: "backup_restore", label: "Backup & Restore", icon: DatabaseBackup, isImplemented: false, phaseText: "Phase 6" },
];

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentUser = "admin",
  onLogout,
  children,
}) => {
  const [activeItem, setActiveItem] = useState<NavItemKey>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notImplementedNotice, setNotImplementedNotice] = useState<string | null>(null);

  const handleNavClick = (item: NavItemConfig) => {
    if (item.isImplemented) {
      setActiveItem(item.key);
      setNotImplementedNotice(null);
    } else {
      setNotImplementedNotice(
        `The "${item.label}" screen is part of ${item.phaseText || "a future phase"}. Under the single-screen development rule, this screen is intentionally not built yet.`
      );
      // Auto-clear notification after 4 seconds
      setTimeout(() => setNotImplementedNotice(null), 4000);
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen w-full flex bg-medical-slate-100/90 text-medical-slate-900 selection:bg-medical-navy-100 font-sans">
      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-medical-navy-950 text-white border-r border-medical-navy-900 transition-all duration-200 lg:static lg:translate-x-0 shadow-lg",
          sidebarCollapsed ? "w-20" : "w-64",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Area */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-medical-navy-900/80">
          {!sidebarCollapsed ? (
            <Logo size="sm" showSubtitle={false} className="text-white" />
          ) : (
            <div className="mx-auto">
              <Logo size="sm" showSubtitle={false} className="text-white" />
            </div>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-medical-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavClick(item)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative cursor-pointer",
                  isActive
                    ? "bg-medical-navy-800 text-white font-bold shadow-xs border border-medical-navy-700/80"
                    : item.isImplemented
                    ? "text-medical-slate-300 hover:bg-medical-navy-900 hover:text-white"
                    : "text-medical-slate-400/80 hover:bg-medical-navy-900/60 hover:text-medical-slate-200"
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive
                      ? "text-medical-green-400"
                      : "text-medical-slate-400 group-hover:text-white"
                  )}
                />

                {!sidebarCollapsed && (
                  <div className="flex-1 flex items-center justify-between">
                    <span className="truncate">{item.label}</span>
                    {!item.isImplemented && (
                      <span className="text-[9px] uppercase tracking-wider bg-medical-navy-900 text-medical-slate-400 px-1.5 py-0.5 rounded font-mono border border-medical-navy-800">
                        Soon
                      </span>
                    )}
                  </div>
                )}

                {/* Active Pill Indicator */}
                {isActive && (
                  <div className="absolute right-0 top-2 bottom-2 w-1 bg-medical-green-500 rounded-l" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User Card & Logout Area */}
        <div className="p-3 border-t border-medical-navy-900/80 bg-medical-navy-950/90 space-y-2">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-medical-navy-900/80 border border-medical-navy-800">
              <div className="w-8 h-8 rounded-full bg-medical-navy-700 border border-medical-navy-600 flex items-center justify-center font-bold text-xs text-medical-green-400 shrink-0">
                {currentUser.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <span className="text-xs font-bold text-white block truncate">
                  {currentUser}
                </span>
                <span className="text-[10px] text-medical-slate-400 block truncate">
                  Workstation #01
                </span>
              </div>
            </div>
          ) : null}

          {/* Logout Button */}
          <button
            type="button"
            onClick={onLogout}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-300 hover:text-white hover:bg-red-600/20 border border-red-500/20 transition-all cursor-pointer",
              sidebarCollapsed && "p-2"
            )}
            title="Log out of IM MEDICOS"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Log Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-medical-slate-200 bg-white/95 backdrop-blur-sm px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-medical-slate-600 hover:bg-medical-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex p-1.5 rounded-lg text-medical-slate-500 hover:bg-medical-slate-100 hover:text-medical-navy-900 transition-colors"
              title="Toggle sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-medical-navy-950">
                Dashboard Overview
              </h1>
              <span className="text-medical-slate-300 hidden sm:inline">•</span>
              <span className="text-xs text-medical-slate-500 hidden sm:inline font-medium">
                IM MEDICOS Billing & Pharmacy System
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* System Status Indicator */}
            <div className="flex items-center gap-1.5 bg-medical-green-50 text-medical-green-800 px-2.5 py-1 rounded-full border border-medical-green-200 font-semibold text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-medical-green-600 animate-pulse" />
              <span>Offline SQLite Ready</span>
            </div>

            {/* Profile Avatar Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-medical-slate-200">
              <div className="w-8 h-8 rounded-full bg-medical-navy-800 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {currentUser.slice(0, 1).toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <span className="text-xs font-bold text-medical-navy-900 block leading-tight">
                  {currentUser}
                </span>
                <span className="text-[10px] text-medical-slate-400 block leading-tight">
                  Admin Role
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Global Notice Toast (when clicking unimplemented screens) */}
        {notImplementedNotice && (
          <div className="bg-amber-500 text-amber-950 text-xs px-4 py-2 font-medium flex items-center justify-between border-b border-amber-600/30 animate-in fade-in select-none">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-900" />
              <span>{notImplementedNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotImplementedNotice(null)}
              className="text-amber-950 hover:text-black font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Main Viewport Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Footer Bar */}
        <footer className="h-9 border-t border-medical-slate-200 bg-white/80 px-6 flex items-center justify-between text-[11px] text-medical-slate-400 select-none">
          <div className="flex items-center gap-2">
            <span>IM MEDICOS v0.1.0</span>
            <span>•</span>
            <span className="text-medical-slate-500 font-medium">Stage: Task 2 (Dashboard Screen Only)</span>
          </div>
          <div>
            <span>Desktop Edition</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
