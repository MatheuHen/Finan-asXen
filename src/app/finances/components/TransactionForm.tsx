"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { parseDateOnly } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import { IconPicker } from "@/components/ui/icon-picker";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCategories, useCreateCategory } from "@/hooks/financial/useCategories";
import type {
  Transaction,
  TransactionType,
  TransactionStatus,
  RecurrenceType,
  RecurrenceUnit,
} from "@/services/financial/transactions.service";
import type { CategoryType } from "@/services/financial/categories.service";
import { RecurrenceRuleCard } from "@/app/finances/components/RecurrenceRuleCard";

const typeLabels: Record<TransactionType, string> = {
  income: "Receita",
  expense: "Despesa",
};

const DEFAULT_CATEGORY_COLOR = "#94a3b8";

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
    category_id: z.string().nullable().optional(),
    due_date: z.date({
      message: "Você precisa escolher uma data de vencimento",
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
        message: "Você precisa informar um valor maior que zero",
      });
    }
    if (!data.is_recurring) return;
    if (!data.recurrence_start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurrence_start_date"],
        message: "Você precisa escolher a data inicial da repetição",
      });
    }
    if (!data.recurrence_end_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurrence_end_date"],
        message: "Você precisa escolher a data final da repetição",
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
          message: "Você precisa usar uma data final igual ou depois da inicial",
        });
      }
    }
    if (!data.recurrence_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurrence_type"],
        message: "Você precisa escolher como vai repetir",
      });
      return;
    }
    if (data.recurrence_type !== "custom") return;
    if (!data.recurrence_interval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurrence_interval"],
        message: "Você precisa informar o intervalo da repetição",
      });
    }
    if (!data.recurrence_unit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurrence_unit"],
        message: "Você precisa escolher a unidade da repetição",
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
    category_id: initialData?.category_id ?? null,
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

  const txType = useWatch({ control: form.control, name: "type" });
  const isRecurring = useWatch({ control: form.control, name: "is_recurring" });
  const recurrenceType = useWatch({ control: form.control, name: "recurrence_type" });
  const recurrenceInterval = useWatch({ control: form.control, name: "recurrence_interval" });
  const recurrenceUnit = useWatch({ control: form.control, name: "recurrence_unit" });
  const recurrenceStartDate = useWatch({ control: form.control, name: "recurrence_start_date" });
  const txStatus = useWatch({ control: form.control, name: "status" });

  const categories = useCategories();
  const { mutate: createCategory, isPending: isCreatingCategory, error: createCategoryError } = useCreateCategory();
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [newCategoryIcon, setNewCategoryIcon] = useState("");

  const filteredCategories = useMemo(() => {
    const list = categories.data ?? [];
    return list.filter((c) => c.type === txType);
  }, [categories.data, txType]);

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
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-2">
                <FormLabel>Categoria</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewCategoryName("");
                    setNewCategoryColor(DEFAULT_CATEGORY_COLOR);
                    setNewCategoryIcon("");
                    setIsCategoryDialogOpen(true);
                  }}
                >
                  Nova
                </Button>
              </div>
              <Select
                value={field.value ?? "none"}
                onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                disabled={categories.isLoading}
              >
                <FormControl>
                  <SelectTrigger>
                    <span className="flex flex-1 items-center gap-2 text-left">
                      {(() => {
                        if (!field.value) {
                          return (
                            <>
                              <span
                                className="size-2.5 rounded-full border border-black/5 dark:border-white/10"
                                style={{ backgroundColor: "#94a3b8" }}
                                aria-hidden
                              />
                              <span>Sem categoria</span>
                            </>
                          );
                        }

                        const c = filteredCategories.find((x) => x.id === field.value);
                        const color = (c?.color ?? "").trim();
                        return (
                          <>
                            <span
                              className="size-2.5 rounded-full border border-black/5 dark:border-white/10"
                              style={{ backgroundColor: color.length > 0 ? color : "#94a3b8" }}
                              aria-hidden
                            />
                            <span>{c?.name ?? "Sem categoria"}</span>
                          </>
                        );
                      })()}
                    </span>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full border border-black/5 dark:border-white/10"
                        style={{ backgroundColor: "#94a3b8" }}
                        aria-hidden
                      />
                      <span>Sem categoria</span>
                    </div>
                  </SelectItem>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full border border-black/5 dark:border-white/10"
                          style={{
                            backgroundColor: (c.color ?? "").trim().length > 0 ? (c.color ?? "").trim() : "#94a3b8",
                          }}
                          aria-hidden
                        />
                        <span>{c.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />

              <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova categoria</DialogTitle>
                    <DialogDescription>
                      Crie uma categoria para organizar suas {txType === "income" ? "receitas" : "despesas"}.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <FormLabel>Nome</FormLabel>
                      <Input
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.currentTarget.value)}
                        placeholder="Ex: Alimentação"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <FormLabel>Cor</FormLabel>
                        <div
                          className="size-4 rounded-full border border-black/5 dark:border-white/10"
                          style={{ backgroundColor: newCategoryColor }}
                          aria-hidden
                        />
                      </div>
                      <ColorPicker value={newCategoryColor} onChange={setNewCategoryColor} />
                    </div>
                    <div className="space-y-2">
                      <FormLabel>Ícone (opcional)</FormLabel>
                      <IconPicker value={newCategoryIcon} onChange={setNewCategoryIcon} />
                    </div>
                    {createCategoryError && (
                      <div className="text-sm text-destructive">{createCategoryError.message}</div>
                    )}
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCategoryDialogOpen(false)}
                      disabled={isCreatingCategory}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        const name = newCategoryName.trim();
                        if (!name) return;
                        const type = (txType ?? "expense") as CategoryType;
                        createCategory(
                          {
                            name,
                            type,
                            color: newCategoryColor,
                            icon: newCategoryIcon.length > 0 ? newCategoryIcon : null,
                          },
                          {
                            onSuccess: (created) => {
                              form.setValue("category_id", created.id, { shouldValidate: true, shouldDirty: true });
                              setIsCategoryDialogOpen(false);
                            },
                          }
                        );
                      }}
                      disabled={isCreatingCategory || newCategoryName.trim().length === 0}
                    >
                      {isCreatingCategory ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
                  <FormLabel>Repetição</FormLabel>
                  <div className="text-xs text-muted-foreground">
                    {isRecurringOccurrence
                      ? "Você está vendo uma conta repetida. Você ajusta a repetição no lançamento original."
                      : "Você repete automaticamente (ideal para contas fixas)."}
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

          {Boolean(isRecurring) && !isRecurringOccurrence && (
            <FormField
              control={form.control}
              name="recurrence_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repetição</FormLabel>
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

          {Boolean(isRecurring) && !isRecurringOccurrence && (
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

          {Boolean(isRecurring) && !isRecurringOccurrence && recurrenceType === "custom" && (
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

          <RecurrenceRuleCard
            enabled={Boolean(isRecurring)}
            recurrenceType={recurrenceType}
            recurrenceInterval={recurrenceInterval}
            recurrenceUnit={recurrenceUnit}
            startDate={recurrenceStartDate}
            status={txStatus}
            recurrenceSourceId={initialData?.recurrence_source_id ?? null}
            isOccurrence={isRecurringOccurrence}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : initialData ? "Salvar" : "Adicionar"}
        </Button>
      </form>
    </Form>
  );
}
