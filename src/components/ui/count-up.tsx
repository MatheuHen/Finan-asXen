"use client";

import { animate } from "framer-motion";
import { useEffect, useRef } from "react";

type CountUpProps = {
  value: number;
  duration?: number;
  format: (value: number) => string;
  className?: string;
};

export function CountUp({ value, duration = 0.95, format, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const lastValueRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const from = Number.isFinite(lastValueRef.current) ? lastValueRef.current : 0;
    const to = Number.isFinite(value) ? value : 0;

    el.textContent = format(from);

    const controls = animate(from, to, {
      duration,
      ease: "easeOut",
      onUpdate: (latest) => {
        const node = ref.current;
        if (!node) return;
        node.textContent = format(latest);
      },
    });

    lastValueRef.current = to;
    return () => controls.stop();
  }, [value, duration, format]);

  return <span ref={ref} className={className} />;
}

