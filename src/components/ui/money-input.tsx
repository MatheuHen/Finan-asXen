"use client";

import type { ComponentProps } from "react";
import { useId, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { formatMoneyForDisplay, formatMoneyForEdit, normalizeMoney, parseMoneyInput, sanitizeMoneyTyping } from "@/lib/money-input";

type MoneyInputProps = Omit<ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange"> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
  invalid?: boolean;
};

export function MoneyInput({ value, onValueChange, placeholder, invalid, id, onBlur, onFocus, ...props }: MoneyInputProps) {
  const generatedId = useId();
  const inputId = useMemo(() => id ?? generatedId, [generatedId, id]);

  const [draft, setDraft] = useState<string>("");
  const [focused, setFocused] = useState(false);

  const text = focused ? draft : value === null ? "" : formatMoneyForDisplay(value);

  return (
    <Input
      {...props}
      id={inputId}
      inputMode="decimal"
      placeholder={placeholder ?? "Ex: 200,00"}
      aria-invalid={invalid || undefined}
      value={text}
      onChange={(e) => {
        const nextText = sanitizeMoneyTyping(e.currentTarget.value);
        setDraft(nextText);
        onValueChange(parseMoneyInput(nextText));
      }}
      onFocus={(e) => {
        setFocused(true);
        setDraft(value === null ? "" : formatMoneyForEdit(value));
        e.currentTarget.select();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        const parsed = parseMoneyInput(draft);
        const normalized = parsed === null ? null : normalizeMoney(parsed);
        onValueChange(normalized);
        setDraft("");
        onBlur?.(e);
      }}
    />
  );
}
