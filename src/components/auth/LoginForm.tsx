import React, { useState } from "react";
import { User, Lock, Eye, EyeOff, ShieldCheck, KeyRound, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { LoginCredentials } from "@/types/auth";

interface LoginFormProps {
  onLoginSuccess?: (username: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    username: "",
    password: "",
    rememberMe: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const validate = (): boolean => {
    const newErrors: { username?: string; password?: string } = {};

    if (!credentials.username.trim()) {
      newErrors.username = "Username is required";
    } else if (credentials.username.trim().length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }

    if (!credentials.password) {
      newErrors.password = "Password is required";
    } else if (credentials.password.length < 4) {
      newErrors.password = "Password must be at least 4 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    // Development-only authentication simulation
    setTimeout(() => {
      setIsLoading(false);
      // Hardcoded dev credentials for Task 3 validation
      if (
        credentials.username.trim() === "admin" &&
        credentials.password === "admin123"
      ) {
        setAuthSuccess(
          `Welcome, ${credentials.username}! Test login successful. (Phase 1 development authentication verified; waiting for next feature authorization).`
        );
        if (onLoginSuccess) {
          onLoginSuccess(credentials.username);
        }
      } else {
        setAuthError(
          "Invalid username or password. For development testing, use username 'admin' and password 'admin123'."
        );
      }
    }, 700);
  };

  const handleFillTestCredentials = () => {
    setCredentials({
      username: "admin",
      password: "admin123",
      rememberMe: true,
    });
    setErrors({});
    setAuthError(null);
    setAuthSuccess(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Dev Mode Notification Banner */}
      <div className="rounded-xl border border-medical-navy-100 bg-medical-navy-50/60 p-3 text-xs text-medical-navy-800 flex items-start gap-2.5">
        <ShieldCheck className="h-4 w-4 text-medical-navy-600 mt-0.5 shrink-0" />
        <div className="flex-1 space-y-1">
          <div className="font-semibold text-medical-navy-900 flex items-center justify-between">
            <span>Development Mode Active</span>
            <span className="text-[10px] font-mono bg-medical-navy-100 text-medical-navy-800 px-1.5 py-0.5 rounded">
              v0.1.0-dev
            </span>
          </div>
          <p className="text-medical-slate-600 leading-normal text-[11px]">
            Test credentials: <strong className="text-medical-navy-900 font-mono">admin</strong> /{" "}
            <strong className="text-medical-navy-900 font-mono">admin123</strong>
          </p>
          <button
            type="button"
            onClick={handleFillTestCredentials}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-medical-navy-700 hover:text-medical-navy-900 hover:underline cursor-pointer pt-0.5"
          >
            <Sparkles className="h-3 w-3 text-medical-green-600" />
            Auto-fill test credentials
          </button>
        </div>
      </div>

      {/* Global Status Alerts */}
      {authError && (
        <Alert variant="destructive" title="Authentication Failed">
          {authError}
        </Alert>
      )}

      {authSuccess && (
        <Alert variant="success" title="Authentication Confirmed">
          {authSuccess}
        </Alert>
      )}

      {/* Username Field */}
      <div className="space-y-1">
        <Label htmlFor="username" required>
          Username
        </Label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-medical-slate-400">
            <User className="h-4 w-4" />
          </div>
          <Input
            id="username"
            name="username"
            type="text"
            placeholder="Enter your username"
            value={credentials.username}
            onChange={(e) => {
              setCredentials((prev) => ({ ...prev, username: e.target.value }));
              if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
              if (authError) setAuthError(null);
            }}
            error={!!errors.username}
            disabled={isLoading}
            className="pl-9"
            autoComplete="username"
            autoFocus
          />
        </div>
        {errors.username && (
          <p className="text-xs text-red-600 mt-1 font-medium">{errors.username}</p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" required>
            Password
          </Label>
          <span className="text-[11px] text-medical-slate-400 select-none">
            Min 4 characters
          </span>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-medical-slate-400">
            <Lock className="h-4 w-4" />
          </div>
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={credentials.password}
            onChange={(e) => {
              setCredentials((prev) => ({ ...prev, password: e.target.value }));
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              if (authError) setAuthError(null);
            }}
            error={!!errors.password}
            disabled={isLoading}
            className="pl-9 pr-10"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={isLoading}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-medical-slate-400 hover:text-medical-slate-600 transition-colors focus:outline-none cursor-pointer"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-600 mt-1 font-medium">{errors.password}</p>
        )}
      </div>

      {/* Options: Remember Me & Security Notice */}
      <div className="flex items-center justify-between pt-1">
        <Checkbox
          id="rememberMe"
          label="Remember my workstation"
          checked={credentials.rememberMe}
          onChange={(e) =>
            setCredentials((prev) => ({ ...prev, rememberMe: e.target.checked }))
          }
          disabled={isLoading}
        />
        <span className="text-[11px] text-medical-slate-400 flex items-center gap-1 select-none">
          <KeyRound className="h-3 w-3 text-medical-slate-400" />
          Secure local session
        </span>
      </div>

      {/* Login Button */}
      <Button
        type="submit"
        variant="default"
        size="lg"
        className="w-full text-sm font-semibold tracking-wide bg-medical-navy-800 hover:bg-medical-navy-900 border-medical-navy-900"
        isLoading={isLoading}
      >
        {isLoading ? "Signing in..." : "Sign In to IM MEDICOS"}
      </Button>

      {/* Footer Security Note */}
      <div className="pt-2 text-center">
        <p className="text-[11px] text-medical-slate-400 leading-relaxed">
          Authorized personnel only. All billing actions are audited.
        </p>
      </div>
    </form>
  );
};

