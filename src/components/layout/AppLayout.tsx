import React, { useState, useEffect } from "react";
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
  ChevronLeft,
  ChevronRight,
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
  activeItem?: NavItemKey;
  onNavChange?: (item: NavItemKey) => void;
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
  { key: "new_bill", label: "New Bill", icon: Receipt, isImplemented: true },
  { key: "bill_history", label: "Bill History", icon: History, isImplemented: true },
  { key: "medicines", label: "Medicines", icon: Pill, isImplemented: true },
  { key: "customers", label: "Customers", icon: Users, isImplemented: true },
  { key: "reports", label: "Reports", icon: BarChart3, isImplemented: true },
  { key: "store_details", label: "Store Details", icon: Store, isImplemented: true },
  { key: "backup_restore", label: "Backup & Restore", icon: DatabaseBackup, isImplemented: true },
];

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentUser = "admin",
  onLogout,
  children,
  activeItem: activeItemProp,
  onNavChange,
}) => {
  const [internalActiveItem, setInternalActiveItem] = useState<NavItemKey>("dashboard");
  const activeItem = activeItemProp ?? internalActiveItem;

  // Single source of truth for desktop collapse state (expanded by default)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Separate, isolated state for mobile drawer
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  // User feedback notification for unimplemented screens
  const [notImplementedNotice, setNotImplementedNotice] = useState<string | null>(null);

  // Close mobile drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileSidebarOpen) {
        setIsMobileSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileSidebarOpen]);

  // Lock background scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileSidebarOpen]);

  const toggleDesktopSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  const handleNavClick = (item: NavItemConfig) => {
    if (item.isImplemented) {
      setInternalActiveItem(item.key);
      if (onNavChange) {
        onNavChange(item.key);
      }
      setNotImplementedNotice(null);
    } else {
      setNotImplementedNotice(
        `The "${item.label}" screen is scheduled for ${item.phaseText || "a future phase"}. Under the single-screen development rule, this screen is intentionally not built yet.`
      );
      // Auto-clear notice after 4.5 seconds
      setTimeout(() => setNotImplementedNotice(null), 4500);
    }
    // Always close mobile drawer upon selecting any navigation item
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="h-screen max-h-screen w-screen overflow-hidden flex bg-medical-slate-100 text-medical-slate-900 select-none font-sans">
      {/* Mobile Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-medical-navy-950/70 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ============================================================ */}
      {/* 1. SIDEBAR (Stationary & Independent Layout)                  */}
      {/* ============================================================ */}
      <aside
        className={cn(
          "h-full flex-shrink-0 flex flex-col bg-medical-navy-950 text-white border-r border-medical-navy-900 shadow-xl transition-all duration-200 z-50",
          // Desktop sizing: either w-64 (expanded) or w-20 (collapsed)
          isSidebarCollapsed ? "lg:w-20" : "lg:w-64",
          // Mobile sizing: fixed drawer from left
          "fixed inset-y-0 left-0 w-64 lg:static lg:translate-x-0",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Sidebar Brand Header */}
        <div className="h-16 flex-shrink-0 flex items-center justify-between px-4 border-b border-medical-navy-900/80">
          <div className="flex items-center gap-2 min-w-0">
            {!isSidebarCollapsed ? (
              <Logo size="sm" showSubtitle={false} variant="dark" />
            ) : (
              <div className="mx-auto flex justify-center w-full">
                <Logo size="sm" iconOnly variant="dark" />
              </div>
            )}
          </div>

          {/* Mobile Close 'X' Button */}
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-medical-slate-400 hover:text-white hover:bg-medical-navy-900 transition-colors cursor-pointer"
            aria-label="Close navigation drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sidebar Navigation Items (Independent vertical scroll if screen height is constrained) */}
        <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto overflow-x-hidden min-h-0">
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
                    : "text-medical-slate-400 hover:bg-medical-navy-900/60 hover:text-medical-slate-200 opacity-80"
                )}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive
                      ? "text-medical-green-400"
                      : "text-medical-slate-400 group-hover:text-white",
                    isSidebarCollapsed && "mx-auto"
                  )}
                />

                {!isSidebarCollapsed && (
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="truncate">{item.label}</span>
                    {!item.isImplemented && (
                      <span className="text-[9px] uppercase tracking-wider bg-medical-navy-900 text-medical-slate-400 px-1.5 py-0.5 rounded font-mono border border-medical-navy-800 shrink-0 ml-1">
                        Soon
                      </span>
                    )}
                  </div>
                )}

                {/* Active Indicator Accent Bar */}
                {isActive && (
                  <div className="absolute right-0 top-2 bottom-2 w-1 bg-medical-green-500 rounded-l" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Controls: User Session Badge & Logout */}
        <div className="p-3 flex-shrink-0 border-t border-medical-navy-900/80 bg-medical-navy-950 space-y-2">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-medical-navy-900/80 border border-medical-navy-800">
              <div className="w-8 h-8 rounded-full bg-medical-navy-700 border border-medical-navy-600 flex items-center justify-center font-bold text-xs text-medical-green-400 shrink-0">
                {currentUser.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <span className="text-xs font-bold text-white block truncate">
                  {currentUser}
                </span>
                <span className="text-[10px] text-medical-slate-400 block truncate font-mono">
                  Station #01 • Local
                </span>
              </div>
            </div>
          )}

          {/* Logout Button */}
          <button
            type="button"
            onClick={onLogout}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-300 hover:text-white hover:bg-red-600/20 border border-red-500/20 transition-all cursor-pointer",
              isSidebarCollapsed && "p-2"
            )}
            title="Log out of IM MEDICOS"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isSidebarCollapsed && <span>Log Out</span>}
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* 2. MAIN AREA (Sticky Navbar + Primary Vertical Scroll Content)*/}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col h-full min-w-0 min-h-0 overflow-hidden">
        {/* Sticky Top Navbar */}
        <header className="h-16 flex-shrink-0 border-b border-medical-slate-200 bg-white/95 backdrop-blur-sm px-4 sm:px-6 flex items-center justify-between z-20 select-none shadow-xs">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Drawer Trigger */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-medical-slate-600 hover:bg-medical-slate-100 hover:text-medical-navy-900 transition-colors cursor-pointer"
              aria-label="Open mobile navigation drawer"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Desktop Sidebar Collapse Toggle Button */}
            <button
              type="button"
              onClick={toggleDesktopSidebar}
              className="hidden lg:flex items-center justify-center p-2 rounded-lg text-medical-slate-600 hover:bg-medical-slate-100 hover:text-medical-navy-950 transition-colors cursor-pointer border border-medical-slate-200/70"
              title={isSidebarCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
              aria-label="Toggle desktop sidebar"
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>

            {/* Header Titles */}
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base font-bold text-medical-navy-950 truncate">
                {activeItem === "store_details"
                  ? "Store Details & Settings"
                  : activeItem === "medicines"
                  ? "Medicine Inventory"
                  : "Dashboard Overview"}
              </h1>
              <span className="text-medical-slate-300 hidden sm:inline">•</span>
              <span className="text-xs text-medical-slate-500 hidden sm:inline font-medium truncate">
                {activeItem === "store_details"
                  ? "Pharmacy Configuration & Invoicing Setup"
                  : activeItem === "medicines"
                  ? "Manage medicines, stock levels and expiry."
                  : "IM MEDICOS Billing & Pharmacy System"}
              </span>
            </div>
          </div>

          {/* Right Header Badges */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Local Offline Status Badge */}
            <div className="flex items-center gap-1.5 bg-medical-green-50 text-medical-green-800 px-2.5 py-1 rounded-full border border-medical-green-200 font-semibold text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-medical-green-600 animate-pulse" />
              <span className="hidden sm:inline">Offline SQLite Ready</span>
              <span className="sm:hidden">Ready</span>
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
                <span className="text-[10px] text-medical-slate-400 block leading-tight font-medium">
                  Administrator
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Global Notice Toast (when clicking unimplemented navigation routes) */}
        {notImplementedNotice && (
          <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs px-4 py-2 font-medium flex items-center justify-between animate-in fade-in select-none z-10">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600" />
              <span>{notImplementedNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotImplementedNotice(null)}
              className="text-amber-700 hover:text-amber-950 font-bold ml-2 p-1 text-sm leading-none cursor-pointer"
              aria-label="Dismiss notice"
            >
              ×
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* 3. PRIMARY VERTICAL SCROLL CONTAINER                         */}
        {/* ============================================================ */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden focus:outline-none">
          {children}
        </main>

        {/* Sticky Desktop Bottom Footer */}
        <footer className="h-9 flex-shrink-0 border-t border-medical-slate-200 bg-white/95 px-6 flex items-center justify-between text-[11px] text-medical-slate-400 select-none z-10">
          <div className="flex items-center gap-2">
            <span>IM MEDICOS v0.1.0</span>
            <span>•</span>
            <span className="text-medical-slate-500 font-medium hidden sm:inline">
              Pharmacy Management & POS
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px]">Session: Active</span>
            <span>•</span>
            <span>Windows Desktop Edition</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
