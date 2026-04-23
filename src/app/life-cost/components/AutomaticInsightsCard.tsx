"use client";

import { Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AutomaticInsightsData = {
  periodSummary: string;
  topImpact: string | null;
  periodComparison: string | null;
  smartInsight: string;
};

type AutomaticInsightsCardProps = {
  data: AutomaticInsightsData | null;
  isPreviousLoading: boolean;
};

export function AutomaticInsightsCard({ data, isPreviousLoading }: AutomaticInsightsCardProps) {
  if (!data && !isPreviousLoading) return null;

  return (
    <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Você em resumo</CardTitle>
        <Clock className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-2">
        {data && <div className="text-sm text-muted-foreground">{data.periodSummary}</div>}
        {data?.topImpact && <div className="text-sm text-muted-foreground">{data.topImpact}</div>}
        {data?.periodComparison && <div className="text-sm text-muted-foreground">{data.periodComparison}</div>}
        {data && <div className="text-sm text-muted-foreground">{data.smartInsight}</div>}
        {isPreviousLoading && <div className="text-sm text-muted-foreground">Carregando comparação com antes...</div>}
      </CardContent>
    </Card>
  );
}
