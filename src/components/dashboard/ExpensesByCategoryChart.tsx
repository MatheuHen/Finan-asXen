"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { PieChart as PieIcon } from "lucide-react";

import { formatBRL } from "@/lib/currency";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useHasMounted } from "@/hooks/useHasMounted";
import type { Transaction } from "@/services/financial/transactions.service";
import type { Category } from "@/services/financial/categories.service";

type Props = {
  transactions: Transaction[];
  categories: Category[];
  className?: string;
};

type Slice = { name: string; value: number; color?: string };

function TooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: Slice; value?: unknown }>;
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

function safeColor(input: unknown) {
  if (typeof input !== "string") return undefined;
  const s = input.trim();
  if (s.length === 0) return undefined;
  return s;
}

export function ExpensesByCategoryChart({ transactions, categories, className }: Props) {
  const { theme } = useTheme();
  const mounted = useHasMounted();

  const slices = useMemo<Slice[]>(() => {
    const categoryMap = new Map<string, Category>();
    for (const c of categories ?? []) categoryMap.set(c.id, c);

    const acc = new Map<string, number>();
    for (const t of transactions ?? []) {
      if (t.type !== "expense") continue;
      const amount = Number(t.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const key = t.category_id ?? "uncategorized";
      acc.set(key, (acc.get(key) ?? 0) + amount);
    }

    const rows = Array.from(acc.entries())
      .map(([key, value]) => {
        const cat = key !== "uncategorized" ? categoryMap.get(key) : undefined;
        return {
          key,
          name: cat?.name ?? "Sem categoria",
          value,
          color: safeColor(cat?.color),
        };
      })
      .sort((a, b) => b.value - a.value);

    return rows.slice(0, 7).map((r) => ({ name: r.name, value: r.value, color: r.color }));
  }, [transactions, categories]);

  const hasData = slices.length > 0;
  const palette =
    theme === "dark"
      ? ["#38bdf8", "#34d399", "#f472b6", "#a78bfa", "#fb7185", "#fbbf24", "#94a3b8"]
      : ["#2563eb", "#16a34a", "#db2777", "#7c3aed", "#dc2626", "#d97706", "#64748b"];

  if (!hasData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className={
          "relative flex flex-col items-center justify-center min-h-[220px] overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-white text-center p-6 shadow-sm " +
          "dark:border-slate-700 dark:bg-slate-900/20 " +
          (className ? " " + className : "")
        }
      >
        <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 dark:bg-slate-800/50">
          <PieIcon className="size-6 text-slate-500 dark:text-slate-400" />
        </div>
        <h3 className="text-sm font-medium text-slate-900 mb-1 dark:text-slate-200">
          Você ainda não tem movimentações suficientes para ver este gráfico
        </h3>
        <p className="text-xs text-slate-600 max-w-[260px] dark:text-slate-400">
          Você vai ver este gráfico assim que tiver despesas aqui.
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
      <div className="h-[220px] w-full min-w-0">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1, height: 1 }}>
            <PieChart>
              <Tooltip
                cursor={false}
                content={<TooltipContent />}
              />
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={86}
                paddingAngle={2}
                stroke={theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)"}
                isAnimationActive
                animationDuration={800}
                animationEasing="ease-out"
              >
                {slices.map((s, idx) => (
                  <Cell key={s.name + idx} fill={s.color ?? palette[idx % palette.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
