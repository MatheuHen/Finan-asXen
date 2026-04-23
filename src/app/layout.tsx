import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

import { AppShell } from "@/components/layout/AppShell";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "AppControleDeVidaXen",
  description: "Sistema AppControleDeVidaXen",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full">
        <Script id="theme-init" strategy="beforeInteractive">
          {`(() => {
  try {
    const stored = localStorage.getItem("theme");
    const shouldDark = stored === "dark";
    document.documentElement.classList.toggle("dark", shouldDark);
  } catch {}
})();`}
        </Script>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
