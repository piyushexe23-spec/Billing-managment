import React, { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/components/auth/LoginForm";
import { Card, CardContent } from "@/components/ui/card";
import { Database, Shield, Activity, Laptop } from "lucide-react";

interface LoginPageProps {
  onLoginSuccess?: (user: {
    username: string;
    role: string;
    displayName: string;
    rememberMe: boolean;
  }) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  const handleLogin = (user: {
    username: string;
    role: string;
    displayName: string;
    rememberMe: boolean;
  }) => {
    setCurrentUser(user.username);
    if (onLoginSuccess) {
      setTimeout(() => {
        onLoginSuccess(user);
      }, 400);
    }
  };

  return (
    <div className="h-screen w-screen overflow-y-auto flex flex-col justify-between bg-medical-slate-100/90 text-medical-slate-900 selection:bg-medical-navy-100">
      {/* Top Application Header / Status Bar */}
      <header className="h-12 border-b border-medical-slate-200 bg-white/80 backdrop-blur-sm px-6 flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <Logo size="sm" showSubtitle={false} />
          <span className="hidden sm:inline-block text-xs font-medium text-medical-slate-400">
            |
          </span>
          <span className="hidden sm:inline-block text-xs font-medium text-medical-slate-500">
            Billing & Pharmacy Management System
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-medical-slate-500">
          <div className="flex items-center gap-1.5 bg-medical-green-50 text-medical-green-700 px-2.5 py-1 rounded-full border border-medical-green-200/80 font-medium text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-medical-green-600 animate-pulse" />
            System Online
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-medical-slate-500 text-[11px]">
            <Database className="h-3.5 w-3.5 text-medical-slate-400" />
            <span>SQLite Embedded</span>
          </div>
        </div>
      </header>

      {/* Main Centered Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          {/* Main Login Card */}
          <Card className="border border-medical-slate-200/90 shadow-xl shadow-medical-navy-950/5 bg-white overflow-hidden rounded-2xl">
            {/* Card Header with Brand Logo */}
            <div className="p-8 pb-6 border-b border-medical-slate-100 text-center bg-gradient-to-b from-medical-slate-50/70 to-white">
              <div className="flex justify-center mb-4">
                <Logo size="lg" />
              </div>
              <h1 className="text-lg font-bold text-medical-navy-900 tracking-tight">
                Workstation Authentication
              </h1>
              <p className="text-xs text-medical-slate-500 mt-1">
                Enter your credentials to access the medical billing portal
              </p>
            </div>

            {/* Form Content */}
            <CardContent className="p-8 pt-6">
              <LoginForm onLoginSuccess={handleLogin} />
            </CardContent>

            {/* Card Bottom Feature Preview Info */}
            {currentUser && (
              <div className="border-t border-medical-green-100 bg-medical-green-50/50 p-3.5 text-center text-xs text-medical-green-900">
                <p className="font-semibold flex items-center justify-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-medical-green-700" />
                  Active Session: {currentUser}
                </p>
                <p className="text-[11px] text-medical-green-700/90 mt-0.5">
                  (Single-screen milestone reached. Awaiting authorization to begin Dashboard development.)
                </p>
              </div>
            )}
          </Card>

          {/* Sub-card security & audit features */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center select-none">
            <div className="flex flex-col items-center p-2.5 rounded-xl bg-white/70 border border-medical-slate-200/80 shadow-xs">
              <Shield className="h-4 w-4 text-medical-navy-700 mb-1" />
              <span className="text-[10px] font-bold text-medical-navy-900">HIPAA Compliant</span>
              <span className="text-[9px] text-medical-slate-400">Data Encryption</span>
            </div>
            <div className="flex flex-col items-center p-2.5 rounded-xl bg-white/70 border border-medical-slate-200/80 shadow-xs">
              <Database className="h-4 w-4 text-medical-navy-700 mb-1" />
              <span className="text-[10px] font-bold text-medical-navy-900">Offline SQLite</span>
              <span className="text-[9px] text-medical-slate-400">Zero Cloud Leak</span>
            </div>
            <div className="flex flex-col items-center p-2.5 rounded-xl bg-white/70 border border-medical-slate-200/80 shadow-xs">
              <Laptop className="h-4 w-4 text-medical-navy-700 mb-1" />
              <span className="text-[10px] font-bold text-medical-navy-900">Tauri Native</span>
              <span className="text-[9px] text-medical-slate-400">Fast & Low Memory</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-10 border-t border-medical-slate-200 bg-white/60 px-6 flex items-center justify-between text-[11px] text-medical-slate-400 select-none">
        <div>
          <span>IM MEDICOS v0.1.0</span>
          <span className="mx-2">•</span>
          <span>Build 2026.11.02</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Desktop Edition</span>
          <span>•</span>
          <span className="text-medical-slate-500 font-medium">Stage: Task 1 - 5 (Login Screen Only)</span>
        </div>
      </footer>
    </div>
  );
};

