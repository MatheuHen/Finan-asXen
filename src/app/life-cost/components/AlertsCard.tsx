"use client";

import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type SmartAlert = {
  id: string;
  title: string;
  message: string;
};

type AlertsCardProps = {
  alerts: SmartAlert[];
};

export function AlertsCard({ alerts }: AlertsCardProps) {
  if (alerts.length === 0) return null;

  return (
    <Card className="rounded-3xl border-amber-500/25 bg-gradient-to-br from-amber-50 via-white to-white shadow-sm dark:from-amber-500/10 dark:via-slate-950/20 dark:to-transparent dark:border-amber-400/25">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Alertas inteligentes</CardTitle>
        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-300" />
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert) => (
          <div key={alert.id} className="rounded-2xl border border-amber-400/20 bg-amber-50/50 px-3 py-2 dark:bg-amber-500/10">
            <div className="text-sm font-medium text-amber-800 dark:text-amber-200">{alert.title}</div>
            <div className="text-sm text-amber-700/90 dark:text-amber-100/90">{alert.message}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
