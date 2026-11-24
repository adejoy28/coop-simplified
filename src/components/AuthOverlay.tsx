import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Lock, ShieldCheck } from "lucide-react";

interface AuthOverlayProps {
  isUnlocked: boolean;
  onAttemptPin: (pin: string) => boolean;
}

export const AuthOverlay: React.FC<AuthOverlayProps> = ({ isUnlocked, onAttemptPin }) => {
  const [pin, setPin] = useState("");
  const [hasError, setHasError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isUnlocked) {
      setPin("");
      setHasError(false);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isUnlocked]);

  if (isUnlocked) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPin(val);
    if (hasError) setHasError(false);
    if (val.trim().length > 0) {
      onAttemptPin(val);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onAttemptPin(pin);
    if (!ok) {
      setHasError(true);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  return (
    <div
      className="auth-layer fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 dark:bg-slate-950/85 backdrop-blur-md"
      id="authLayer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="authTitle"
    >
      <form
        className="w-full max-w-[380px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 sm:p-8 text-center shadow-2xl"
        id="authForm"
        onSubmit={handleSubmit}
      >
        <div
          className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        >
          <Lock size={20} strokeWidth={2} />
        </div>

        <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Secure Workspace
        </p>
        <h1
          id="authTitle"
          className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50"
        >
          Office Authentication
        </h1>
        <p className="mx-auto mt-2 mb-6 max-w-[280px] text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Enter your four-digit office passcode to unlock the appraisal desk.
        </p>

        <label className="sr-only" htmlFor="authPin">
          Office passcode
        </label>
        <input
          ref={inputRef}
          id="authPin"
          type="password"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          placeholder="••••"
          autoComplete="off"
          value={pin}
          onChange={handleChange}
          className="w-full min-h-[46px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 text-center font-mono-num text-lg tracking-[0.35em] text-slate-900 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
        />

        {hasError && (
          <p
            className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400"
            id="authError"
            role="alert"
          >
            <AlertCircle size={14} strokeWidth={2} />
            <span>Incorrect PIN. Please try again.</span>
          </p>
        )}

        <button
          className="mt-4 flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          type="submit"
        >
          <span>Unlock Desk</span>
          <ArrowRight size={16} strokeWidth={2} />
        </button>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck size={13} strokeWidth={2} />
          <span>Protected Cooperative Tool</span>
        </p>
      </form>
    </div>
  );
};
