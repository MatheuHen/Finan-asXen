"use client";

export type EvolutionTransaction = {
  amount: number | string;
  type: "income" | "expense";
  due_date: string;
  paid_date?: string | null;
  status: string;
};

export type EvolutionPoint = {
  rawDate: string;
  income: number;
  expense: number;
  balance: number;
  accumulated: number;
};

export function buildEvolutionPoints(transactions: EvolutionTransaction[]) {
  if (!transactions || transactions.length === 0) return [];

  const grouped = transactions.reduce((acc, t) => {
    const rawDate = t.status === "paid" && t.paid_date ? t.paid_date : t.due_date;
    if (!rawDate) return acc;

    const date = rawDate.split("T")[0];
    if (!acc[date]) acc[date] = { income: 0, expense: 0 };

    const amount = Number(t.amount);
    if (!Number.isFinite(amount)) return acc;

    if (t.type === "income") acc[date].income += amount;
    else acc[date].expense += amount;
    return acc;
  }, {} as Record<string, { income: number; expense: number }>);

  const sortedDates = Object.keys(grouped).sort();

  let accumulated = 0;
  return sortedDates.map((rawDate) => {
    const { income, expense } = grouped[rawDate];
    const balance = income - expense;
    accumulated += balance;
    return { rawDate, income, expense, balance, accumulated } satisfies EvolutionPoint;
  });
}

