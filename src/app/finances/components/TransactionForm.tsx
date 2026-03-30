"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { parseDateOnly } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Checkbox } from "@/components/ui/checkbox";
import type {
  Transaction,
  TransactionType,
  TransactionStatus,
  RecurrenceType,
  RecurrenceUnit,
} from "@/services/financial/transactions.service";

const typeLabels: Record<TransactionType, string> = {
  income: "Receita",
  expense: "Despesa",
};

const statusLabels: Record<TransactionStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  late: "Atrasado",
  cancelled: "Cancelado",
};

const recurrenceLabels: Record<RecurrenceType, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
  custom: "Personalizado",
};

const recurrenceUnitLabels: Record<RecurrenceUnit, string> = {
  day: "dia(s)",
  week: "semana(s)",
  month: "mês(es)",
  year: "ano(s)",
};

const transactionSchema = z
  .object({
    description: z.string().optional(),
    amount: z.number().nullable(),
    type: z.enum(["income", "expense"] as const),
    status: z.enum(["pending", "paid", "late", "cancelled"] as const),
    due_date: z.date({
      message: "A data de vencimento é obrigatória",
    }),
    is_recurring: z.boolean().optional(),
    recurrence_type: z.enum(["daily", "weekly", "monthly", "yearly", "custom"] as const).optional(),
    recurrence_interval: z.number().int().min(1, "O intervalo deve ser >= 1").optional(),
    recurrence_unit: z.enum(["day", "week", "month", "year"] as const).optional(),
    recurrence_start_date: z.date().optional(),
    recurrence_end_date: z.date().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.amount === null || !Number.isFinite(data.amount) || data.amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "O valor deve ser maior que zero",
      });
    }
    if (!data.is_recurring) return;
    if (!data.recurrence_start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurrence_start_date"],
        message: "Selecione a data inicial",
      });
    }
    if (!data.recurrence_end_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurrence_end_date"],
        message: "Selecione a data final",
      });
    }
    if (data.recurrence_start_date && data.recurrence_end_date) {
      const from = new Date(
        data.recurrence_start_date.getFullYear(),
        data.recurrence_start_date.getMonth(),
        data.recurrence_start_date.getDate()
      );
      const to = new Date(
        data.recurrence_end_date.getFullYear(),
        data.recurrence_end_date.getMonth(),
        data.recurrence_end_date.getDate()
      );
      if (from.getTime() > to.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recurrence_end_date"],
          message: "A data final deve ser maior ou igual à inicial",
        });
      }
    }
    if (!data.recurrence_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurrence_type"],
        message: "Selecione a recorrência",
      });
      return;
    }
    if (data.recurrence_type !== "custom") return;
    if (!data.recurrence_interval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurrence_interval"],
        message: "Informe o intervalo",
      });
    }
    if (!data.recurrence_unit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurrence_unit"],
        message: "Selecione a unidade",
      });
    }
  });

export type TransactionFormValues = z.infer<typeof transactionSchema>;

type TransactionFormProps = {
  initialData?: Transaction | null;
  onSubmit: (data: TransactionFormValues) => void;
  isSubmitting?: boolean;
  defaultDueDate?: Date;
};

function buildDefaults(initialData?: Transaction | null, defaultDueDate?: Date) {
  const due =
    initialData?.due_date
      ? parseDateOnly(initialData.due_date) ?? new Date()
      : defaultDueDate ?? new Date();

  return {
    description: initialData?.description || "",
    amount: typeof initialData?.amount === "number" ? initialData.amount : null,
    type: initialData?.type || "expense",
    status: initialData?.status || "pending",
    due_date: due,
    is_recurring: Boolean(initialData?.is_recurring),
    recurrence_type: (initialData?.recurrence_type as RecurrenceType) || "monthly",
    recurrence_interval: initialData?.recurrence_interval ?? 1,
    recurrence_unit: (initialData?.recurrence_unit as RecurrenceUnit) || "month",
    recurrence_start_date: initialData?.recurrence_start_date
      ? parseDateOnly(initialData.recurrence_start_date) ?? due
      : due,
    recurrence_end_date: initialData?.recurrence_end_date
      ? parseDateOnly(initialData.recurrence_end_date) ?? due
      : due,
  } satisfies TransactionFormValues;
}

export function TransactionForm({ initialData, onSubmit, isSubmitting, defaultDueDate }: TransactionFormProps) {
  const isRecurringOccurrence = Boolean(initialData?.recurrence_source_id);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: buildDefaults(initialData, defaultDueDate),
  });

  useEffect(() => {
    form.reset(buildDefaults(initialData, defaultDueDate));
  }, [form, initialData, defaultDueDate]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <span className="flex flex-1 text-left">{typeLabels[field.value]}</span>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor (R$)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={field.value !== null && Number.isFinite(field.value) ? field.value : ""}
                  onChange={(e) => {
                    const raw = e.currentTarget.value;
                    if (raw === "") {
                      field.onChange(null);
                      return;
                    }
                    const n = e.currentTarget.valueAsNumber;
                    field.onChange(Number.isFinite(n) ? n : null);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Supermercado" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="due_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data</FormLabel>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    />
                  }
                >
                  {field.value ? format(field.value, "dd/MM/yyyy") : <span>Escolha uma data</span>}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <span className="flex flex-1 text-left">{statusLabels[field.value]}</span>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="late">Atrasado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <FormField
            control={form.control}
            name="is_recurring"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-3 space-y-0">
                <div>
                  <FormLabel>Conta recorrente</FormLabel>
                  <div className="text-xs text-muted-foreground">
                    {isRecurringOccurrence
                      ? "Gerada automaticamente. Edite a recorrência no lançamento original."
                      : "Repete automaticamente (ideal para contas fixas)."}
                  </div>
                </div>
                <FormControl>
                  <Checkbox
                    checked={Boolean(field.value)}
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                    disabled={isRecurringOccurrence}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {form.watch("is_recurring") && !isRecurringOccurrence && (
            <FormField
              control={form.control}
              name="recurrence_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recorrência</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "monthly"}>
                    <FormControl>
                      <SelectTrigger>
                        <span className="flex flex-1 text-left">
                          {recurrenceLabels[(field.value as RecurrenceType) ?? "monthly"]}
                        </span>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {form.watch("is_recurring") && !isRecurringOccurrence && (
            <div className="grid grid-cols-12 gap-3">
              <FormField
                control={form.control}
                name="recurrence_start_date"
                render={({ field }) => (
                  <FormItem className="col-span-6 flex flex-col">
                    <FormLabel>Início</FormLabel>
                    <Popover>
                      <PopoverTrigger
                        render={
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          />
                        }
                      >
                        {field.value ? format(field.value, "dd/MM/yyyy") : <span>Escolha</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recurrence_end_date"
                render={({ field }) => (
                  <FormItem className="col-span-6 flex flex-col">
                    <FormLabel>Fim</FormLabel>
                    <Popover>
                      <PopoverTrigger
                        render={
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          />
                        }
                      >
                        {field.value ? format(field.value, "dd/MM/yyyy") : <span>Escolha</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {form.watch("is_recurring") && !isRecurringOccurrence && form.watch("recurrence_type") === "custom" && (
            <div className="grid grid-cols-12 gap-3">
              <FormField
                control={form.control}
                name="recurrence_interval"
                render={({ field }) => (
                  <FormItem className="col-span-6">
                    <FormLabel>Repetir a cada</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="2"
                        value={Number.isFinite(field.value) ? field.value : ""}
                        onChange={(e) => {
                          const raw = e.currentTarget.value;
                          if (raw === "") {
                            field.onChange(undefined);
                            return;
                          }
                          const n = e.currentTarget.valueAsNumber;
                          field.onChange(Number.isFinite(n) ? n : undefined);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recurrence_unit"
                render={({ field }) => (
                  <FormItem className="col-span-6">
                    <FormLabel>Unidade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? "month"}>
                      <FormControl>
                        <SelectTrigger>
                          <span className="flex flex-1 text-left">
                            {recurrenceUnitLabels[(field.value as RecurrenceUnit) ?? "month"]}
                          </span>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="day">dia(s)</SelectItem>
                        <SelectItem value="week">semana(s)</SelectItem>
                        <SelectItem value="month">mês(es)</SelectItem>
                        <SelectItem value="year">ano(s)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : initialData ? "Atualizar" : "Criar Transação"}
        </Button>
      </form>
    </Form>
  );
}
