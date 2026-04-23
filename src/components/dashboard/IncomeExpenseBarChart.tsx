"use client";

import { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";

import { formatBRL } from "@/lib/currency";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useHasMounted } from "@/hooks/useHasMounted";
import type { Transaction } from "@/services/financial/transactions.service";

type Props = {
  transactions: Transaction[];
  className?: string;
};

type Point = { name: "Receitas" | "Despesas"; value: number };

function TooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: Point; value?: unknown }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/85">
      <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{p.name}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {formatBRL(p.value)}
      </div>
    </div>
  );
}

export function IncomeExpenseBarChart({ transactions, className }: Props) {
  const { theme } = useTheme();
  const mounted = useHasMounted();

  const data = useMemo<Point[]>(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions ?? []) {
      const amount = Number(t.amount);
      if (!Number.isFinite(amount)) continue;
      if (t.type === "income") income += amount;
      else expense += amount;
    }
    return [
      { name: "Receitas", value: income },
      { name: "Despesas", value: expense },
    ];
  }, [transactions]);

  const hasData = data.some((d) => d.value > 0);
  const incomeColor = theme === "dark" ? "rgba(34,197,94,0.95)" : "rgba(22,163,74,0.92)";
  const expenseColor = theme === "dark" ? "rgba(244,63,94,0.92)" : "rgba(220,38,38,0.9)";

  if (!hasData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className={
          "relative flex flex-col items-center justify-center min-h-[200px] overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-white text-center p-6 shadow-sm " +
          "dark:border-slate-700 dark:bg-slate-900/20 " +
          (className ? " " + className : "")
        }
      >
        <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 dark:bg-slate-800/50">
          <BarChart3 className="size-6 text-slate-500 dark:text-slate-400" />
        </div>
        <h3 className="text-sm font-medium text-slate-900 mb-1 dark:text-slate-200">
          Você ainda não tem movimentações suficientes para ver este gráfico
        </h3>
        <p className="text-xs text-slate-600 max-w-[260px] dark:text-slate-400">
          Você vai ver este gráfico assim que tiver receitas e despesas aqui.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={className}
    >
      <div className="h-[200px] w-full min-w-0">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1, height: 1 }}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 6 }}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke="currentColor" />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: theme === "dark" ? "rgba(148,163,184,0.08)" : "rgba(148,163,184,0.12)" }}
                content={<TooltipContent />}
              />
              <Bar dataKey="value" radius={[10, 10, 10, 10]} isAnimationActive animationDuration={800} animationEasing="ease-out">
                <Cell fill={incomeColor} />
                <Cell fill={expenseColor} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
