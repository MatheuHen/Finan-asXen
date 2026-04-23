import type { ReactNode } from "react";

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-slate-100 to-background dark:from-[#0f172a] dark:via-[#0b1120] dark:to-[#020617]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(56,189,248,0.14),transparent_45%)] dark:bg-[radial-gradient(circle_at_18%_8%,rgba(56,189,248,0.22),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_28%,rgba(139,92,246,0.12),transparent_48%)] dark:bg-[radial-gradient(circle_at_82%_28%,rgba(139,92,246,0.2),transparent_48%)]" />
      </div>
      <div className="w-full max-w-md rounded-3xl border bg-card/25 p-8 shadow-[0_28px_120px_-80px_rgba(0,0,0,0.7)] backdrop-blur-sm">
        {children}
      </div>
    </div>
  );
}
