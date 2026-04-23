"use client";

import { format } from "date-fns";
import { Repeat } from "lucide-react";

import type { RecurrenceType, RecurrenceUnit, TransactionStatus } from "@/services/financial/transactions.service";

const unitLabel: Record<RecurrenceUnit, string> = {
  day: "dia(s)",
  week: "semana(s)",
  month: "mês(es)",
  year: "ano(s)",
};

const statusLabel: Record<TransactionStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  late: "Atrasado",
  cancelled: "Cancelado",
};

type RecurrenceRuleCardProps = {
  enabled: boolean;
  recurrenceType: RecurrenceType | undefined;
  recurrenceInterval: number | undefined;
  recurrenceUnit: RecurrenceUnit | undefined;
  startDate: Date | undefined;
  status: TransactionStatus;
  recurrenceSourceId?: string | null;
  isOccurrence: boolean;
};

export function RecurrenceRuleCard({
  enabled,
  recurrenceType,
  recurrenceInterval,
  recurrenceUnit,
  startDate,
  status,
  recurrenceSourceId,
  isOccurrence,
}: RecurrenceRuleCardProps) {
  void recurrenceSourceId;
  if (isOccurrence) {
    return (
      <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-2">
          <Repeat className="size-3.5" />
          <span className="font-medium">Você está vendo uma repetição</span>
        </div>
        <div>Você pode editar só este item.</div>
      </div>
    );
  }

  if (!enabled || !recurrenceType) return null;

  const interval = Number.isFinite(recurrenceInterval) && (recurrenceInterval ?? 0) > 0 ? Math.trunc(recurrenceInterval as number) : 1;
  const resolvedUnit: RecurrenceUnit =
    recurrenceType === "daily"
      ? "day"
      : recurrenceType === "weekly"
        ? "week"
        : recurrenceType === "monthly"
          ? "month"
          : recurrenceType === "yearly"
            ? "year"
            : recurrenceUnit ?? "month";
  const ruleText =
    recurrenceType === "custom"
      ? `Você repete a cada ${interval} ${unitLabel[resolvedUnit]}`
      : recurrenceType === "daily"
        ? "Você repete todos os dias"
        : recurrenceType === "weekly"
          ? "Você repete toda semana"
          : recurrenceType === "monthly"
            ? "Você repete todo mês"
            : "Você repete todo ano";

  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
      <div className="flex items-center gap-2">
        <Repeat className="size-3.5" />
        <span className="font-medium">Você repete</span>
      </div>
      <div>{ruleText}</div>
      <div>Você começou em: {startDate ? format(startDate, "dd/MM/yyyy") : "Você ainda não definiu"}</div>
      <div>Você deixou como: {statusLabel[status]}</div>
    </div>
  );
}
