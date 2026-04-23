import { formatDateOnly } from "@/lib/date";

export type PeriodPreset = "today" | "7d" | "30d" | "month" | "year" | "custom";

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  month: "Mês atual",
  year: "Ano",
  custom: "Personalizado",
};

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function endOfYear(date: Date) {
  return new Date(date.getFullYear(), 11, 31);
}

export function getPresetRange(preset: PeriodPreset) {
  const today = startOfDay(new Date());
  if (preset === "today") return { from: today, to: today };
  if (preset === "7d")
    return { from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6), to: today };
  if (preset === "30d")
    return { from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29), to: today };
  if (preset === "month") return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: endOfMonth(today) };
  if (preset === "year") return { from: new Date(today.getFullYear(), 0, 1), to: endOfYear(today) };
  return {};
}

export function normalizeRangeKey(range: { from?: Date; to?: Date }) {
  return {
    from: range.from ? formatDateOnly(startOfDay(range.from)) : null,
    to: range.to ? formatDateOnly(startOfDay(range.to)) : null,
  };
}

export function formatPeriodHint(preset: PeriodPreset, range: { from?: Date; to?: Date }) {
  if (preset !== "custom") {
    if (preset === "month" && range.from) {
      return range.from.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    }
    if (preset === "year" && range.from) {
      return String(range.from.getFullYear());
    }
    return PERIOD_PRESET_LABELS[preset];
  }

  const from = range.from ? startOfDay(range.from) : null;
  const to = range.to ? startOfDay(range.to) : null;
  if (from && to && from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return from.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }
  if (from && to) {
    return from.toLocaleDateString("pt-BR") + " – " + to.toLocaleDateString("pt-BR");
  }
  if (from) return "A partir de " + from.toLocaleDateString("pt-BR");
  if (to) return "Até " + to.toLocaleDateString("pt-BR");
  return PERIOD_PRESET_LABELS.custom;
}
