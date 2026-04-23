"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/currency";

function parseNumberInput(raw: string) {
  let normalized = raw.trim();
  if (normalized.length === 0) return null;
  normalized = normalized.replace(/\s/g, "").replace(/[R$]/gi, "").replace(/[^\d,.-]/g, "");
  if (normalized.length === 0) return null;
  const minusCount = (normalized.match(/-/g) ?? []).length;
  if (minusCount > 1) return null;
  if (minusCount === 1 && !normalized.startsWith("-")) return null;
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");
  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = normalized.replace(",", ".");
  } else if (hasDot && /^-?\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

type LifeCostCalculatorProps = {
  hourlyRate: number;
  workSchedule: { hoursPerDay: number; hoursWeekly: number };
};

export function LifeCostCalculator({ hourlyRate, workSchedule }: LifeCostCalculatorProps) {
  const [amountInput, setAmountInput] = useState("");
  const [touched, setTouched] = useState(false);

  const amount = useMemo(() => {
    const n = parseNumberInput(amountInput);
    if (n === null || n <= 0) return null;
    return n;
  }, [amountInput]);

  const error = useMemo(() => {
    if (!touched) return null;
    if (amountInput.trim().length === 0) return "Você precisa informar um valor para simular.";
    const n = parseNumberInput(amountInput);
    if (n === null) return "Você precisa informar um valor válido.";
    if (n <= 0) return "Você precisa informar um valor maior que zero.";
    return null;
  }, [touched, amountInput]);

  const result = useMemo(() => {
    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) return null;
    if (!amount) return null;
    const hours = amount / hourlyRate;
    if (!Number.isFinite(hours) || hours <= 0) return null;

    const workDays =
      Number.isFinite(workSchedule.hoursPerDay) && workSchedule.hoursPerDay > 0
        ? hours / workSchedule.hoursPerDay
        : null;
    const workWeeks =
      Number.isFinite(workSchedule.hoursWeekly) && workSchedule.hoursWeekly > 0
        ? hours / workSchedule.hoursWeekly
        : null;

    const weeksPerMonth = 4.33;
    const workMonths = workWeeks !== null && Number.isFinite(workWeeks) ? workWeeks / weeksPerMonth : null;
    const workYears = workMonths !== null && Number.isFinite(workMonths) ? workMonths / 12 : null;

    return {
      hours: Number(hours.toFixed(2)),
      workDays: workDays && Number.isFinite(workDays) ? Number(workDays.toFixed(2)) : null,
      workWeeks: workWeeks && Number.isFinite(workWeeks) ? Number(workWeeks.toFixed(2)) : null,
      workMonths: workMonths && Number.isFinite(workMonths) ? Number(workMonths.toFixed(2)) : null,
      workYears: workYears && Number.isFinite(workYears) ? Number(workYears.toFixed(2)) : null,
    };
  }, [hourlyRate, amount, workSchedule]);

  return (
    <Card className="rounded-4xl border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white shadow-sm dark:border-white/10 dark:from-white/5 dark:via-white/3 dark:to-transparent">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Você simula um gasto</CardTitle>
        <Calculator className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">Você vê quanto um gasto custa em vida com base no seu valor/hora.</div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <div className="text-sm font-medium text-foreground">Valor (R$)</div>
            <Input
              inputMode="decimal"
              placeholder="Ex: 100"
              value={amountInput}
              onChange={(e) => {
                setTouched(true);
                setAmountInput(e.currentTarget.value);
              }}
            />
          </div>
          <Button
            type="button"
            onClick={() => setTouched(true)}
            disabled={!Number.isFinite(hourlyRate) || hourlyRate <= 0}
          >
            Ver
          </Button>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        {result && (
          <div className="rounded-2xl border bg-card/18 px-3 py-2 text-sm space-y-1">
            <div className="text-muted-foreground">
              {formatBRL(amount ?? 0)} custam:
            </div>
            <div>
              -{" "}
              <span className="font-medium text-sky-700 dark:text-sky-200">
                {result.hours.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>{" "}
              horas da sua vida
            </div>
            {result.workDays !== null && (
              <div>
                -{" "}
                <span className="font-medium">
                  {result.workDays.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>{" "}
                dias de trabalho
              </div>
            )}
            {result.workWeeks !== null && (
              <div>
                -{" "}
                <span className="font-medium">
                  {result.workWeeks.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>{" "}
                semanas de trabalho
              </div>
            )}
            {result.workMonths !== null && (
              <div>
                -{" "}
                <span className="font-medium">
                  {result.workMonths.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>{" "}
                meses de trabalho
              </div>
            )}
            {result.workYears !== null && (
              <div>
                -{" "}
                <span className="font-medium">
                  {result.workYears.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>{" "}
                anos de trabalho
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
