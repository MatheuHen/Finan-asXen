"use client";

import Image from "next/image";
import { memo } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type FloatingMoneyIconProps = {
  className?: string;
  size?: number;
};

const particles = [
  { top: "16%", left: "18%", size: 4, delay: 0 },
  { top: "24%", left: "74%", size: 3, delay: 0.6 },
  { top: "58%", left: "12%", size: 3, delay: 1.1 },
  { top: "66%", left: "82%", size: 4, delay: 1.6 },
  { top: "84%", left: "46%", size: 2, delay: 2.1 },
] as const;

export const FloatingMoneyIcon = memo(function FloatingMoneyIcon({
  className,
  size = 92,
}: FloatingMoneyIconProps) {
  return (
    <motion.div
      className={cn("group pointer-events-auto select-none", className)}
      style={{
        width: size,
        height: size,
        perspective: 900,
        willChange: "transform, filter",
      }}
      animate={{
        y: [-10, 10, -10],
        rotateY: [0, 360],
        scale: [1, 1.08, 1],
        boxShadow: [
          "0 10px 30px rgba(250, 204, 21, 0.10), 0 0 0 rgba(0,0,0,0)",
          "0 18px 45px rgba(250, 204, 21, 0.18), 0 0 26px rgba(250, 204, 21, 0.18)",
          "0 10px 30px rgba(250, 204, 21, 0.10), 0 0 0 rgba(0,0,0,0)",
        ],
      }}
      transition={{
        y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
        rotateY: { duration: 8, repeat: Infinity, ease: "linear" },
        scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
        boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" },
      }}
      whileHover={{
        scale: 1.15,
        rotateX: 10,
        rotateY: 24,
        boxShadow:
          "0 22px 70px rgba(250, 204, 21, 0.22), 0 0 40px rgba(250, 204, 21, 0.22)",
      }}
    >
      <div className="relative h-full w-full rounded-full">
        <div
          className={cn(
            "pointer-events-none absolute -inset-6 rounded-full opacity-0 blur-2xl transition-opacity duration-300",
            "group-hover:opacity-100",
            "bg-[radial-gradient(circle_at_30%_30%,rgba(250,204,21,0.28),transparent_62%)]"
          )}
          aria-hidden
        />

        {particles.map((p, idx) => (
          <motion.span
            key={idx}
            className="pointer-events-none absolute rounded-full"
            style={{
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size,
              background: "rgba(250, 204, 21, 0.85)",
              boxShadow: "0 0 18px rgba(250, 204, 21, 0.22)",
            }}
            animate={{
              opacity: [0, 0.9, 0],
              scale: [0.6, 1, 0.7],
            }}
            transition={{
              duration: 3.6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: p.delay,
            }}
          />
        ))}

        <motion.div
          className="relative h-full w-full"
          style={{
            transformStyle: "preserve-3d",
            willChange: "transform",
          }}
        >
          <Image
            src="/coin-3d.svg"
            alt="Moeda 3D"
            fill
            sizes="96px"
            priority
            className="object-contain"
          />
        </motion.div>
      </div>
    </motion.div>
  );
});
