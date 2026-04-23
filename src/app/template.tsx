"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

import { isAuthRoute } from "@/lib/auth-routes";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isAuthRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: "easeOut", duration: 0.3 }}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  );
}
