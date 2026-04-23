"use client";

import { HexColorPicker } from "react-colorful";

import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function ColorPicker({ value, onChange, className }: Props) {
  return (
    <div className={cn("rounded-2xl border bg-background/40 p-3", className)}>
      <HexColorPicker color={value} onChange={onChange} className="!w-full !h-[160px]" />
    </div>
  );
}

