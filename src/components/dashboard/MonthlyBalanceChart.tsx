"use client";

import { useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";

import { useTheme } from "@/components/theme/ThemeProvider";
import { useHasMounted } from "@/hooks/useHasMounted";
import { formatBRL } from "@/lib/currency";
import type { Transaction } from "@/services/financial/transactions.service";

type Props = {
  transactions: Transaction[];
  className?: string;
};

type Point = { monthKey: string; month: string; value: number };

function monthLabel(monthKey: string) {
  const [yRaw, mRaw] = monthKey.split("-");
  const y = Number(yRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return monthKey;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function txDateKey(t: Transaction) {
  const raw = t.status === "paid" && t.paid_date ? t.paid_date : t.due_date;
  const date = raw?.split("T")[0];
  if (!date) return null;
  return date.slice(0, 7);
}

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
      <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{p.month}</div>
      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Saldo do mês</div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {formatBRL(p.value)}
      </div>
    </div>
  );
}

export function MonthlyBalanceChart({ transactions, className }: Props) {
  const { theme } = useTheme();
  const mounted = useHasMounted();

  const data = useMemo<Point[]>(() => {
    const acc = new Map<string, number>();
    for (const t of transactions ?? []) {
      const key = txDateKey(t);
      if (!key) continue;
      const amount = Number(t.amount);
      if (!Number.isFinite(amount)) continue;
      const delta = t.type === "income" ? amount : -amount;
      acc.set(key, (acc.get(key) ?? 0) + delta);
    }
    return Array.from(acc.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([monthKey, value]) => ({ monthKey, month: monthLabel(monthKey), value }));
  }, [transactions]);

  if (data.length < 2) {
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
          <TrendingUp className="size-6 text-slate-500 dark:text-slate-400" />
        </div>
        <h3 className="text-sm font-medium text-slate-900 mb-1 dark:text-slate-200">
          Você ainda não tem movimentações suficientes para ver este gráfico
        </h3>
        <p className="text-xs text-slate-600 max-w-[260px] dark:text-slate-400">
          Você vai ver a comparação por mês assim que tiver dados em pelo menos 2 meses.
        </p>
      </motion.div>
    );
  }

  const barColor = theme === "dark" ? "rgba(34,211,238,0.9)" : "rgba(37,99,235,0.9)";

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
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="currentColor" />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: theme === "dark" ? "rgba(148,163,184,0.08)" : "rgba(148,163,184,0.12)" }}
                content={<TooltipContent />}
              />
              <Bar
                dataKey="value"
                fill={barColor}
                radius={[10, 10, 10, 10]}
                isAnimationActive
                animationDuration={800}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
