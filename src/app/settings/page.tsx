"use client";

import { useMemo, useState } from "react";
import { Moon, Settings, Sun } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme, type ThemeMode } from "@/components/theme/ThemeProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile, useUpdateHourlyRate } from "@/hooks/auth/useProfile";
import { formatBRL } from "@/lib/currency";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useHasMounted } from "@/hooks/useHasMounted";

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
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatBRLInput(raw: string) {
  if (raw.trim().length === 0) return "";
  const value = parseNumberInput(raw);
  if (value === null) return "";
  return formatBRL(Number(value.toFixed(2)));
}

function parseTimeToHoursDetailed(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { value: null, error: "Você precisa informar as horas no formato HH:MM." };
  const m = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!m) return { value: null, error: "Você precisa usar o formato HH:MM (ex.: 8:48 ou 08:48)." };
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return { value: null, error: "Você precisa informar um horário válido." };
  if (h < 0 || min < 0) return { value: null, error: "Você não pode usar horas ou minutos negativos." };
  if (min >= 60) return { value: null, error: "Você precisa usar minutos menores que 60." };
  const total = h + min / 60;
  if (total <= 0) return { value: null, error: "Você precisa informar um tempo maior que 00:00." };
  if (total > 24) return { value: null, error: "Você pode informar no máximo 24:00 por dia." };
  return { value: total, error: null };
}

function parseTimeToHours(raw: string) {
  return parseTimeToHoursDetailed(raw).value;
}

const WEEKS_PER_MONTH = 4.33;

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const mounted = useHasMounted();
  const profile = useProfile();
  const { mutate: updateHourlyRate, isPending: isSaving, error: saveError } = useUpdateHourlyRate();

  const initialHourlyRate = useMemo(() => {
    const v = profile.data?.hourly_rate;
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  }, [profile.data?.hourly_rate]);

  const [hourlyRateInput, setHourlyRateInput] = useState<string>("");
  const [hourlyRateTouched, setHourlyRateTouched] = useState(false);
  const hourlyRateValue = useMemo(() => {
    if (hourlyRateTouched) return hourlyRateInput;
    return initialHourlyRate === null ? "" : String(initialHourlyRate);
  }, [hourlyRateTouched, hourlyRateInput, initialHourlyRate]);

  const [autoOpen, setAutoOpen] = useState(false);
  const [autoTab, setAutoTab] = useState<"standard" | "custom">("standard");

  const [salaryMonthlyInput, setSalaryMonthlyInput] = useState("");
  const [hourlyRateMessage, setHourlyRateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [hoursPerDayInput, setHoursPerDayInput] = useState("");
  const [daysPerWeekInput, setDaysPerWeekInput] = useState("5");

  const [customDays, setCustomDays] = useState(() => {
    return [
      { key: "mon", label: "Segunda", works: true, time: "08:00" },
      { key: "tue", label: "Terça", works: true, time: "08:00" },
      { key: "wed", label: "Quarta", works: true, time: "08:00" },
      { key: "thu", label: "Quinta", works: true, time: "08:00" },
      { key: "fri", label: "Sexta", works: true, time: "08:00" },
      { key: "sat", label: "Sábado", works: false, time: "00:00" },
      { key: "sun", label: "Domingo", works: false, time: "00:00" },
    ];
  });

  const salaryMonthly = useMemo(() => {
    const salary = parseNumberInput(salaryMonthlyInput);
    if (salary === null || salary <= 0) return null;
    return salary;
  }, [salaryMonthlyInput]);

  const salaryValidation = useMemo(() => {
    const raw = salaryMonthlyInput.trim();
    if (raw.length === 0) return "Você precisa informar o seu salário mensal líquido.";
    const salary = parseNumberInput(raw);
    if (salary === null) return "Você precisa informar um salário válido.";
    if (salary <= 0) return "Você precisa informar um salário maior que zero.";
    return null;
  }, [salaryMonthlyInput]);

  const standardPreview = useMemo(() => {
    if (!salaryMonthly) return null;
    const hoursPerDay = parseTimeToHours(hoursPerDayInput);
    const days = parseNumberInput(daysPerWeekInput);
    if (!hoursPerDay || days === null) return null;
    if (days <= 0 || days > 7) return null;
    const hoursWeekly = hoursPerDay * days;
    if (!Number.isFinite(hoursWeekly) || hoursWeekly <= 0 || hoursWeekly > 168) return null;
    const hoursMonthly = hoursWeekly * WEEKS_PER_MONTH;
    if (!Number.isFinite(hoursMonthly) || hoursMonthly <= 0) return null;
    const hourly = salaryMonthly / hoursMonthly;
    if (!Number.isFinite(hourly) || hourly <= 0) return null;
    return {
      hoursWeekly,
      hoursMonthly,
      hourlyRate: Number(hourly.toFixed(2)),
    };
  }, [salaryMonthly, hoursPerDayInput, daysPerWeekInput]);

  const customPreview = useMemo(() => {
    if (!salaryMonthly) return null;
    let hoursWeekly = 0;
    for (const d of customDays) {
      if (!d.works) continue;
      const h = parseTimeToHours(d.time);
      if (!h) return null;
      hoursWeekly += h;
    }
    if (!Number.isFinite(hoursWeekly) || hoursWeekly <= 0 || hoursWeekly > 168) return null;
    const hoursMonthly = hoursWeekly * WEEKS_PER_MONTH;
    if (!Number.isFinite(hoursMonthly) || hoursMonthly <= 0) return null;
    const hourly = salaryMonthly / hoursMonthly;
    if (!Number.isFinite(hourly) || hourly <= 0) return null;
    return {
      hoursWeekly,
      hoursMonthly,
      hourlyRate: Number(hourly.toFixed(2)),
    };
  }, [salaryMonthly, customDays]);

  const activePreview = autoTab === "standard" ? standardPreview : customPreview;
  const standardValidation = useMemo(() => {
    if (salaryValidation) return salaryValidation;
    const hoursPerDay = parseTimeToHoursDetailed(hoursPerDayInput);
    if (hoursPerDay.error) return hoursPerDay.error;
    if (daysPerWeekInput.trim().length === 0) return "Você precisa informar quantos dias você trabalha por semana.";
    const days = parseNumberInput(daysPerWeekInput);
    if (days === null) return "Você precisa informar um número válido de dias por semana.";
    if (days <= 0 || days > 7) return "Você precisa informar entre 1 e 7 dias por semana.";
    const hoursWeekly = (hoursPerDay.value ?? 0) * days;
    if (!Number.isFinite(hoursWeekly) || hoursWeekly <= 0) return "Você precisa ter uma carga semanal maior que zero.";
    if (hoursWeekly > 168) return "Você não pode ter uma carga semanal acima de 168 horas.";
    if (!standardPreview) return "Você não conseguiu calcular quanto vale sua hora agora.";
    return null;
  }, [salaryValidation, hoursPerDayInput, daysPerWeekInput, standardPreview]);

  const customValidation = useMemo(() => {
    if (salaryValidation) return salaryValidation;
    const workedDays = customDays.filter((d) => d.works);
    if (workedDays.length === 0) return "Você precisa selecionar pelo menos um dia trabalhado.";
    let weeklyHours = 0;
    for (const day of workedDays) {
      const parsed = parseTimeToHoursDetailed(day.time);
      if (parsed.error) return `${day.label}: ${parsed.error}`;
      weeklyHours += parsed.value ?? 0;
    }
    if (!Number.isFinite(weeklyHours) || weeklyHours <= 0) return "Você precisa ter uma carga semanal maior que zero.";
    if (weeklyHours > 168) return "Você não pode ter uma carga semanal acima de 168 horas.";
    if (!customPreview) return "Você não conseguiu calcular quanto vale sua hora agora.";
    return null;
  }, [salaryValidation, customDays, customPreview]);

  const activeValidation = autoTab === "standard" ? standardValidation : customValidation;
  const psychologicalInsights = useMemo(() => {
    if (!activePreview) return null;
    const hourlyRate = activePreview.hourlyRate;
    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) return null;
    let workdayHours = 0;
    if (autoTab === "standard") {
      workdayHours = parseTimeToHours(hoursPerDayInput) ?? 0;
    } else {
      const activeDaysCount = customDays.filter((d) => d.works).length;
      if (activeDaysCount <= 0) return null;
      workdayHours = activePreview.hoursWeekly / activeDaysCount;
    }
    if (!Number.isFinite(workdayHours) || workdayHours <= 0) return null;
    const dailyValue = hourlyRate * workdayHours;
    if (!Number.isFinite(dailyValue) || dailyValue <= 0) return null;
    const expenseValue = 100;
    const expenseHours = expenseValue / hourlyRate;
    if (!Number.isFinite(expenseHours) || expenseHours <= 0) return null;
    const expenseDays = expenseHours > 8 ? expenseHours / workdayHours : null;
    return {
      hourlyRate,
      dailyValue: Number(dailyValue.toFixed(2)),
      expenseHours,
      expenseDays,
    };
  }, [activePreview, autoTab, hoursPerDayInput, customDays]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="relative overflow-hidden rounded-4xl border bg-gradient-to-br from-white via-slate-50 to-white text-slate-900 shadow-sm dark:from-[#050816] dark:via-[#11123a] dark:to-black dark:text-white dark:shadow-[0_30px_120px_-70px_rgba(0,0,0,0.85)]">
        <div className="pointer-events-none absolute inset-0 opacity-90" aria-hidden>
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_20%_18%,rgba(59,130,246,0.14),transparent_55%)] dark:bg-[radial-gradient(circle_at_20%_18%,rgba(56,189,248,0.18),transparent_55%)]" />
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_78%_55%,rgba(99,102,241,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_78%_55%,rgba(139,92,246,0.18),transparent_55%)]" />
          <div className="absolute inset-0 ring-1 ring-slate-200/70 dark:ring-white/10" />
        </div>
        <div className="relative p-6">
          <h2 className="text-3xl font-semibold tracking-tight">Você ajusta suas configurações</h2>
          <p className="mt-2 text-slate-600 dark:text-white/70">Você ajusta sua experiência e define quanto vale uma hora da sua vida.</p>
        </div>
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Preferências</CardTitle>
          <Settings className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Tema</div>
              <div className="text-sm text-muted-foreground">Escolha entre Light futurista e Dark futurista.</div>
            </div>
            {mounted ? (
              <Select value={theme} onValueChange={(v) => setTheme(v as ThemeMode)}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
                      {theme === "dark" ? "Dark" : "Light"}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <span className="flex items-center gap-2">
                      <Sun className="size-4" />
                      Light
                    </span>
                  </SelectItem>
                  <SelectItem value="dark">
                    <span className="flex items-center gap-2">
                      <Moon className="size-4" />
                      Dark
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Skeleton className="h-10 w-full sm:w-[220px]" />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Horas de vida</CardTitle>
          <Settings className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">Quanto você ganha por hora?</div>

          {profile.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-9 w-32" />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex-1 space-y-2">
                <div className="text-sm font-medium text-foreground">Valor/hora</div>
                <Input
                  inputMode="decimal"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 35.50"
                  value={hourlyRateValue}
                  onChange={(e) => {
                    setHourlyRateTouched(true);
                    setHourlyRateInput(e.currentTarget.value);
                    setHourlyRateMessage(null);
                  }}
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setHourlyRateMessage(null);
                    setSalaryMonthlyInput("");
                    setAutoTab("standard");
                    setHoursPerDayInput("");
                    setDaysPerWeekInput("5");
                    setCustomDays([
                      { key: "mon", label: "Segunda", works: true, time: "08:00" },
                      { key: "tue", label: "Terça", works: true, time: "08:00" },
                      { key: "wed", label: "Quarta", works: true, time: "08:00" },
                      { key: "thu", label: "Quinta", works: true, time: "08:00" },
                      { key: "fri", label: "Sexta", works: true, time: "08:00" },
                      { key: "sat", label: "Sábado", works: false, time: "00:00" },
                      { key: "sun", label: "Domingo", works: false, time: "00:00" },
                    ]);
                    setAutoOpen(true);
                  }}
                >
                  Calcular automaticamente
                </Button>
                <Button
                  onClick={() => {
                    const raw = hourlyRateValue.trim();
                    if (raw.length === 0) {
                      setHourlyRateMessage(null);
                      updateHourlyRate(null, {
                        onSuccess: () => {
                          setHourlyRateTouched(false);
                          setHourlyRateMessage({ type: "success", text: "Valor/hora removido com sucesso." });
                        },
                        onError: () => {
                          setHourlyRateMessage({ type: "error", text: "Não foi possível salvar o valor/hora." });
                        },
                      });
                      return;
                    }
                    const n = parseNumberInput(raw);
                    if (n === null) {
                      setHourlyRateMessage({ type: "error", text: "Valor/hora inválido." });
                      return;
                    }
                    if (!Number.isFinite(n)) {
                      setHourlyRateMessage({ type: "error", text: "Valor/hora inválido." });
                      return;
                    }
                    if (n <= 0) {
                      setHourlyRateMessage({ type: "error", text: "Valor/hora deve ser maior que zero." });
                      return;
                    }
                    const sanitizedValue = Number(n.toFixed(2));
                    if (!Number.isFinite(sanitizedValue) || sanitizedValue <= 0) {
                      setHourlyRateMessage({ type: "error", text: "Valor/hora inválido." });
                      return;
                    }
                    setHourlyRateMessage(null);
                    updateHourlyRate(sanitizedValue, {
                      onSuccess: () => {
                        setHourlyRateTouched(false);
                        setHourlyRateMessage({ type: "success", text: "Valor/hora salvo com sucesso." });
                      },
                      onError: () => {
                        setHourlyRateMessage({ type: "error", text: "Não foi possível salvar o valor/hora." });
                      },
                    });
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
              {hourlyRateMessage && (
                <div className={`text-sm ${hourlyRateMessage.type === "success" ? "text-emerald-600" : "text-destructive"}`}>
                  {hourlyRateMessage.text}
                </div>
              )}
            </div>
          )}

          {saveError && <div className="text-sm text-destructive">{saveError.message}</div>}
          {profile.error && <div className="text-sm text-destructive">{profile.error.message}</div>}
        </CardContent>
      </Card>

      <Dialog open={autoOpen} onOpenChange={setAutoOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Calcular valor/hora</DialogTitle>
            <DialogDescription>O cálculo usa a média de 4,33 semanas por mês.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            <div className="space-y-2">
              <div className="text-sm font-medium">Quanto você ganha por mês (líquido)?</div>
              <Input
                inputMode="decimal"
                placeholder="Ex: R$ 4.500,00"
                value={salaryMonthlyInput}
                onChange={(e) => setSalaryMonthlyInput(formatBRLInput(e.currentTarget.value))}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={autoTab === "standard" ? "default" : "outline"}
                onClick={() => setAutoTab("standard")}
                className="flex-1"
              >
                Padrão
              </Button>
              <Button
                type="button"
                variant={autoTab === "custom" ? "default" : "outline"}
                onClick={() => setAutoTab("custom")}
                className="flex-1"
              >
                Personalizado
              </Button>
            </div>

            {autoTab === "standard" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Quantas horas você trabalha por dia?</div>
                  <Input
                    inputMode="text"
                    placeholder="Ex: 08:48"
                    value={hoursPerDayInput}
                    onChange={(e) => setHoursPerDayInput(e.currentTarget.value)}
                  />
                  <div className="text-xs text-muted-foreground">Formato HH:MM (ex.: 8:48 ou 08:48)</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Quantos dias você trabalha por semana?</div>
                  <Input
                    inputMode="numeric"
                    type="number"
                    min="1"
                    max="7"
                    step="1"
                    placeholder="Ex: 5"
                    value={daysPerWeekInput}
                    onChange={(e) => setDaysPerWeekInput(e.currentTarget.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm font-medium">Sua semana</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {customDays.map((d) => (
                    <div key={d.key} className="rounded-2xl border bg-card/18 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{d.label}</div>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Checkbox
                            checked={d.works}
                            onChange={(e) => {
                              const checked = e.currentTarget.checked;
                              setCustomDays((prev) =>
                                prev.map((x) => (x.key === d.key ? { ...x, works: checked } : x))
                              );
                            }}
                          />
                          Trabalha neste dia?
                        </label>
                      </div>
                      {d.works && (
                        <div className="mt-2">
                          <Input
                            inputMode="text"
                            placeholder="Ex: 08:48"
                            value={d.time}
                            onChange={(e) => {
                              const value = e.currentTarget.value;
                              setCustomDays((prev) => prev.map((x) => (x.key === d.key ? { ...x, time: value } : x)));
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activePreview && (
              <div className="rounded-2xl border bg-card/18 px-3 py-2 text-sm space-y-1">
                <div className="text-muted-foreground">
                  Horas semanais:{" "}
                  <span className="font-medium">
                    {activePreview.hoursWeekly.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  Horas mensais (estim.):{" "}
                  <span className="font-medium">
                    {activePreview.hoursMonthly.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  Seu valor/hora estimado é: <span className="font-semibold">{formatBRL(activePreview.hourlyRate)}</span>
                </div>
                {psychologicalInsights && (
                  <div className="mt-2 space-y-1 border-t pt-2">
                    <div className="text-muted-foreground">
                      Você ganha{" "}
                      <span className="font-medium">{formatBRL(psychologicalInsights.hourlyRate)}</span> por hora
                    </div>
                    <div className="text-muted-foreground">
                      1 dia de trabalho vale{" "}
                      <span className="font-medium">{formatBRL(psychologicalInsights.dailyValue)}</span>
                    </div>
                    <div className="text-muted-foreground">
                      Um gasto de R$ 100 custa{" "}
                      <span className="font-medium">
                        {psychologicalInsights.expenseHours.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>{" "}
                      horas da sua vida
                    </div>
                    {psychologicalInsights.expenseDays !== null && (
                      <div className="text-muted-foreground">
                        Isso também equivale a{" "}
                        <span className="font-medium">
                          {psychologicalInsights.expenseDays.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>{" "}
                        dias de trabalho
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {activeValidation && <div className="text-sm text-destructive">{activeValidation}</div>}
          </div>

          <DialogFooter className="gap-2 border-t pt-3 sm:gap-0">
            <Button variant="outline" onClick={() => setAutoOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!activePreview || activeValidation) {
                  setHourlyRateMessage({
                    type: "error",
                    text: activeValidation ?? "Preencha os campos corretamente para usar o valor calculado.",
                  });
                  return;
                }
                setHourlyRateMessage(null);
                setHourlyRateTouched(true);
                setHourlyRateInput(String(activePreview.hourlyRate));
                try {
                  let hoursPerDay = 0;
                  const hoursWeekly = activePreview.hoursWeekly;
                  if (autoTab === "standard") {
                    hoursPerDay = parseTimeToHours(hoursPerDayInput) ?? 0;
                  } else {
                    const activeDaysCount = customDays.filter((d) => d.works).length;
                    hoursPerDay = activeDaysCount > 0 ? hoursWeekly / activeDaysCount : 0;
                  }
                  if (
                    Number.isFinite(hoursPerDay) &&
                    hoursPerDay > 0 &&
                    Number.isFinite(hoursWeekly) &&
                    hoursWeekly > 0
                  ) {
                    window.localStorage.setItem(
                      "work_schedule_v1",
                      JSON.stringify({
                        hoursPerDay: Number(hoursPerDay.toFixed(4)),
                        hoursWeekly: Number(hoursWeekly.toFixed(4)),
                      })
                    );
                    window.dispatchEvent(new Event("work_schedule_updated"));
                  }
                } catch {}
                updateHourlyRate(activePreview.hourlyRate, {
                  onSuccess: () => {
                    setHourlyRateTouched(false);
                    setAutoOpen(false);
                    setHourlyRateMessage({ type: "success", text: "Valor/hora salvo com sucesso." });
                  },
                  onError: () => {
                    setHourlyRateMessage({ type: "error", text: "Não foi possível salvar o valor/hora." });
                  },
                });
              }}
              disabled={isSaving || activePreview === null || Boolean(activeValidation)}
            >
              Usar esse valor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
