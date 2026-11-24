import React, { useEffect, useRef, useState } from "react";
import { evaluateMathExpression, formatInputDisplay, parseNumber } from "../utils/formatters.ts";

interface MoneyInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const BASE_INPUT_CLASS =
  "w-full min-h-[42px] sm:min-h-[40px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono-num text-sm text-slate-900 dark:text-slate-50 placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-500 transition-colors";

export const MoneyInput: React.FC<MoneyInputProps> = ({
  id,
  value,
  onChange,
  placeholder = "0",
  disabled = false,
  className
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [calcFormula, setCalcFormula] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Clear formula if value was changed externally
  useEffect(() => {
    if (!isFocused && calcFormula) {
      const expected = evaluateMathExpression(calcFormula);
      if (expected === null || formatInputDisplay(expected) !== value) {
        setCalcFormula(null);
      }
    }
  }, [value, isFocused, calcFormula]);

  const handleFocus = () => {
    setIsFocused(true);
    if (calcFormula) {
      onChange(calcFormula);
      requestAnimationFrame(() => {
        inputRef.current?.select();
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (/[+\-*/]/.test(raw)) {
      onChange(raw);
      return;
    }

    setCalcFormula(null);
    const cursor = e.target.selectionStart ?? raw.length;
    const prevLength = raw.length;
    const formatted = formatInputDisplay(raw);
    onChange(formatted);

    const newPos = Math.max(0, cursor + (formatted.length - prevLength));
    requestAnimationFrame(() => {
      try {
        inputRef.current?.setSelectionRange(newPos, newPos);
      } catch {
        // ignore selection range errors
      }
    });
  };

  const evaluateAndFormat = () => {
    const raw = value.trim();
    if (!raw) {
      setCalcFormula(null);
      return;
    }
    const mathResult = evaluateMathExpression(raw);
    if (mathResult !== null) {
      setCalcFormula(raw);
      onChange(formatInputDisplay(mathResult));
    } else {
      const num = parseNumber(raw);
      onChange(formatInputDisplay(num));
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    evaluateAndFormat();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      evaluateAndFormat();
      inputRef.current?.blur();
    }
  };

  const title = calcFormula
    ? `Formula: ${calcFormula} = ${formatInputDisplay(evaluateMathExpression(calcFormula))}`
    : undefined;

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      id={id}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      className={className ? `${BASE_INPUT_CLASS} ${className}` : BASE_INPUT_CLASS}
      title={title}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
};
