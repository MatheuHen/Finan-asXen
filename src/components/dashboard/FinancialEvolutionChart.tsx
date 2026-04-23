"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useTheme } from "@/components/theme/ThemeProvider";
import { useHasMounted } from "@/hooks/useHasMounted";
import { formatBRL } from "@/lib/currency";
import { buildEvolutionPoints } from "@/lib/financial-evolution";

type Transaction = {
  id: string;
  amount: number | string;
  type: "income" | "expense";
  due_date: string;
  paid_date?: string | null;
  status: string;
  description?: string | null;
};

type FinancialEvolutionChartProps = {
  transactions: Transaction[];
  className?: string;
};

type ChartPoint = {
  rawDate: string;
  date: string;
  value: number;
  income: number;
  expense: number;
  balance: number;
};

function formatShortBRDate(rawDate: string) {
  const [y, m, d] = rawDate.split("-");
  if (!y || !m || !d) return rawDate;
  return `${d}/${m}`;
}

function formatLongBRDate(rawDate: string) {
  const [y, m, d] = rawDate.split("-");
  if (!y || !m || !d) return rawDate;
  return `${d}/${m}/${y}`;
}

function TooltipContent({ active, payload }: { active?: boolean; payload?: Array<{ payload?: ChartPoint; value?: unknown }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (!p) return null;

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/85">
      <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{formatLongBRDate(p.rawDate)}</div>
      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Saldo acumulado</div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatBRL(p.value)}</div>
    </div>
  );
}

export function FinancialEvolutionChart({ transactions, className }: FinancialEvolutionChartProps) {
  const { theme } = useTheme();
  const mounted = useHasMounted();

  const chartData = useMemo(() => {
    return buildEvolutionPoints(transactions).map((p) => {
      return {
        rawDate: p.rawDate,
        date: formatShortBRDate(p.rawDate),
        value: p.accumulated,
        income: p.income,
        expense: p.expense,
        balance: p.balance,
      } satisfies ChartPoint;
    });
  }, [transactions]);

  if (chartData.length < 2) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className={
          "relative flex flex-col items-center justify-center min-h-[160px] overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-white text-center p-6 shadow-sm " +
          "dark:border-slate-700 dark:bg-slate-900/20 " +
          (className ? " " + className : "")
        }
      >
        <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 dark:bg-slate-800/50">
          <BarChart3 className="size-6 text-slate-500 dark:text-slate-400" />
        </div>
        <h3 className="text-sm font-medium text-slate-900 mb-1 dark:text-slate-200">
          Você vê este gráfico assim que tiver dados
        </h3>
        <p className="text-xs text-slate-600 max-w-[250px] dark:text-slate-400">
          Você adiciona movimentações para ver sua evolução aqui
        </p>
      </motion.div>
    );
  }

  const stroke = theme === "dark" ? "#22d3ee" : "#2563eb";
  const referenceStroke = theme === "dark" ? "rgba(148,163,184,0.35)" : "rgba(100,116,139,0.45)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={
        "relative overflow-hidden rounded-2xl border bg-card/18 backdrop-blur-sm " +
        "shadow-[0_18px_70px_-55px_rgba(0,0,0,0.6)] " +
        (className ? " " + className : "")
      }
    >
      <div className="relative h-[160px] w-full min-w-0">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1, height: 1 }}>
            <LineChart data={chartData} margin={{ top: 8, right: 10, left: 10, bottom: 6 }}>
              <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} stroke="currentColor" />
              <YAxis
                hide
                domain={[
                  (dataMin: number) => Math.min(0, dataMin),
                  (dataMax: number) => Math.max(0, dataMax),
                ]}
              />
              <ReferenceLine y={0} stroke={referenceStroke} strokeDasharray="4 4" strokeWidth={1.5} />
              <Tooltip
                cursor={{ stroke: "rgba(148,163,184,0.35)", strokeWidth: 1 }}
                content={<TooltipContent />}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={stroke}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke }}
                isAnimationActive
                animationDuration={800}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
