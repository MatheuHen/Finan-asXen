export type InvestmentDistributionSlice = {
  name: string;
  value: number;
  percent: number;
};

export function computeInvestmentDistribution(
  entries: Array<{ value?: unknown; category?: unknown }> | undefined
) {
  const acc = new Map<string, number>();
  for (const entry of entries ?? []) {
    const invested = Number(entry.value ?? 0);
    if (!Number.isFinite(invested) || invested <= 0) continue;
    const cat = typeof entry.category === "string" && entry.category.trim().length > 0 ? entry.category.trim() : "Outros";
    acc.set(cat, (acc.get(cat) ?? 0) + invested);
  }

  const total = Array.from(acc.values()).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
  if (!Number.isFinite(total) || total <= 0) {
    return { slices: [] as InvestmentDistributionSlice[], top: null as null | { name: string; percent: number } };
  }

  const slices = Array.from(acc.entries())
    .map(([name, value]) => {
      const pct = (value / total) * 100;
      const percent = Number.isFinite(pct) ? pct : 0;
      return { name, value: Number(value.toFixed(2)), percent: Number(percent.toFixed(2)) } satisfies InvestmentDistributionSlice;
    })
    .sort((a, b) => b.value - a.value);

  const top = slices[0] ? { name: slices[0].name, percent: slices[0].percent } : null;
  return { slices, top };
}

