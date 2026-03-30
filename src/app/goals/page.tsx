"use client";

import { useState } from "react";
import { CalendarIcon, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { formatPeriodHint, getPresetRange, PERIOD_PRESET_LABELS, type PeriodPreset } from "@/lib/period";

export default function GoalsPage() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("month");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const r = getPresetRange("month");
    return r.from ? ({ from: r.from, to: r.to } as DateRange) : undefined;
  });

  const periodHint = formatPeriodHint(periodPreset, dateRange ?? {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-bold tracking-tight">Metas</h2>
            <p className="text-muted-foreground">
              Acompanhe seus objetivos e evolução por período.
            </p>
            <div className="text-sm text-muted-foreground">Exibindo dados de: {periodHint}</div>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={periodPreset}
              onValueChange={(v) => {
                const preset = v as PeriodPreset;
                setPeriodPreset(preset);
                if (preset !== "custom") {
                  const r = getPresetRange(preset);
                  setDateRange(r.from ? ({ from: r.from, to: r.to } as DateRange) : undefined);
                }
              }}
            >
              <SelectTrigger className="w-[200px]">
                <span className="flex flex-1 text-left">{PERIOD_PRESET_LABELS[periodPreset]}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="month">Mês atual</SelectItem>
                <SelectItem value="year">Ano</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger render={<Button variant="outline" size="icon" />}>
                <CalendarIcon className="size-4 opacity-60" />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    setPeriodPreset("custom");
                    setDateRange(range);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Resumo das metas</CardTitle>
          <Target className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Em breve: metas filtradas por período usando services, mantendo consistência com o restante do app.
        </CardContent>
      </Card>
    </div>
  );
}
