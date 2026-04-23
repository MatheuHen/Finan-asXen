"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Baby,
  Banknote,
  BarChart3,
  Bike,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Calendar,
  Camera,
  Car,
  Coffee,
  CreditCard,
  DollarSign,
  Droplets,
  Dumbbell,
  Film,
  Flame,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  Hammer,
  Heart,
  Hospital,
  Home,
  Key,
  Landmark,
  Laptop,
  Leaf,
  Lightbulb,
  Lock,
  Mail,
  MapPin,
  Moon,
  Music,
  Paintbrush,
  PawPrint,
  Pencil,
  Phone,
  PieChart,
  PiggyBank,
  Pill,
  Plane,
  Pizza,
  Receipt,
  Scissors,
  Shirt,
  Ship,
  ShoppingBasket,
  ShoppingCart,
  Smartphone,
  Star,
  Stethoscope,
  Sun,
  Tag,
  Target,
  Ticket,
  Train,
  TrendingDown,
  TrendingUp,
  Users,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type IconGroup =
  | "all"
  | "food"
  | "school"
  | "transport"
  | "market"
  | "travel"
  | "home"
  | "bills"
  | "health"
  | "leisure"
  | "work"
  | "gym"
  | "family"
  | "other";

type IconOption = {
  name: string;
  group: IconGroup;
  Icon: LucideIcon;
};

const ICON_GROUPS: Array<{ id: IconGroup; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "food", label: "Comida" },
  { id: "school", label: "Escola" },
  { id: "transport", label: "Transporte" },
  { id: "market", label: "Mercado" },
  { id: "travel", label: "Viagem" },
  { id: "home", label: "Casa" },
  { id: "bills", label: "Contas" },
  { id: "health", label: "Saúde" },
  { id: "leisure", label: "Lazer" },
  { id: "work", label: "Trabalho" },
  { id: "gym", label: "Academia" },
  { id: "family", label: "Família" },
  { id: "other", label: "Outros" },
];

const ICONS: IconOption[] = [
  { name: "Utensils", group: "food", Icon: Utensils },
  { name: "Pizza", group: "food", Icon: Pizza },
  { name: "Coffee", group: "food", Icon: Coffee },
  { name: "ShoppingBasket", group: "market", Icon: ShoppingBasket },
  { name: "ShoppingCart", group: "market", Icon: ShoppingCart },
  { name: "Receipt", group: "market", Icon: Receipt },
  { name: "GraduationCap", group: "school", Icon: GraduationCap },
  { name: "BookOpen", group: "school", Icon: BookOpen },
  { name: "Pencil", group: "school", Icon: Pencil },
  { name: "Car", group: "transport", Icon: Car },
  { name: "Bus", group: "transport", Icon: Bus },
  { name: "Train", group: "transport", Icon: Train },
  { name: "Bike", group: "transport", Icon: Bike },
  { name: "Plane", group: "travel", Icon: Plane },
  { name: "Ship", group: "travel", Icon: Ship },
  { name: "MapPin", group: "travel", Icon: MapPin },
  { name: "Home", group: "home", Icon: Home },
  { name: "Lightbulb", group: "bills", Icon: Lightbulb },
  { name: "CreditCard", group: "bills", Icon: CreditCard },
  { name: "Wallet", group: "bills", Icon: Wallet },
  { name: "Banknote", group: "bills", Icon: Banknote },
  { name: "Pill", group: "health", Icon: Pill },
  { name: "Hospital", group: "health", Icon: Hospital },
  { name: "Stethoscope", group: "health", Icon: Stethoscope },
  { name: "Heart", group: "family", Icon: Heart },
  { name: "Baby", group: "family", Icon: Baby },
  { name: "Users", group: "family", Icon: Users },
  { name: "Gamepad2", group: "leisure", Icon: Gamepad2 },
  { name: "Music", group: "leisure", Icon: Music },
  { name: "Film", group: "leisure", Icon: Film },
  { name: "Ticket", group: "leisure", Icon: Ticket },
  { name: "Camera", group: "leisure", Icon: Camera },
  { name: "Briefcase", group: "work", Icon: Briefcase },
  { name: "Laptop", group: "work", Icon: Laptop },
  { name: "Building2", group: "work", Icon: Building2 },
  { name: "Landmark", group: "work", Icon: Landmark },
  { name: "Dumbbell", group: "gym", Icon: Dumbbell },
  { name: "Flame", group: "gym", Icon: Flame },
  { name: "TrendingUp", group: "work", Icon: TrendingUp },
  { name: "TrendingDown", group: "work", Icon: TrendingDown },
  { name: "PieChart", group: "other", Icon: PieChart },
  { name: "BarChart3", group: "other", Icon: BarChart3 },
  { name: "Target", group: "other", Icon: Target },
  { name: "PiggyBank", group: "other", Icon: PiggyBank },
  { name: "DollarSign", group: "other", Icon: DollarSign },
  { name: "Tag", group: "other", Icon: Tag },
  { name: "Gift", group: "other", Icon: Gift },
  { name: "Shirt", group: "other", Icon: Shirt },
  { name: "Scissors", group: "other", Icon: Scissors },
  { name: "Paintbrush", group: "other", Icon: Paintbrush },
  { name: "Leaf", group: "other", Icon: Leaf },
  { name: "PawPrint", group: "other", Icon: PawPrint },
  { name: "Smartphone", group: "other", Icon: Smartphone },
  { name: "Phone", group: "other", Icon: Phone },
  { name: "Mail", group: "other", Icon: Mail },
  { name: "Wifi", group: "other", Icon: Wifi },
  { name: "Lock", group: "other", Icon: Lock },
  { name: "Key", group: "other", Icon: Key },
  { name: "Wrench", group: "other", Icon: Wrench },
  { name: "Hammer", group: "other", Icon: Hammer },
  { name: "Droplets", group: "other", Icon: Droplets },
  { name: "Sun", group: "other", Icon: Sun },
  { name: "Moon", group: "other", Icon: Moon },
  { name: "Star", group: "other", Icon: Star },
  { name: "Globe", group: "other", Icon: Globe },
  { name: "Calendar", group: "other", Icon: Calendar },
];

const ICON_BY_NAME = new Map<string, LucideIcon>(ICONS.map((i) => [i.name, i.Icon]));

export function getLucideIconByName(name?: string | null) {
  if (!name) return null;
  return ICON_BY_NAME.get(name) ?? null;
}

type Props = {
  value?: string | null;
  onChange: (value: string) => void;
  className?: string;
};

export function IconPicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<IconGroup>("all");

  const selected = useMemo(() => {
    if (!value) return null;
    return ICONS.find((i) => i.name === value) ?? null;
  }, [value]);

  const filtered = useMemo(() => {
    if (group === "all") return ICONS;
    return ICONS.filter((i) => i.group === group);
  }, [group]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" className={cn("justify-start gap-2", className)}>
            <span className="size-4 shrink-0 text-muted-foreground">
              {selected ? <selected.Icon className="size-4" /> : <Tag className="size-4" />}
            </span>
            <span className="flex-1 text-left">{value ? "Ícone selecionado" : "Selecionar ícone"}</span>
          </Button>
        }
      />
      <PopoverContent className="w-[360px] p-3">
        <div className="flex flex-wrap gap-1.5">
          {ICON_GROUPS.map((g) => (
            <Button
              key={g.id}
              type="button"
              variant={group === g.id ? "default" : "outline"}
              size="sm"
              onClick={() => setGroup(g.id)}
              className="h-8 px-2"
            >
              {g.label}
            </Button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-9 gap-1.5">
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-xl border bg-background/40 text-muted-foreground transition-colors hover:bg-muted/40"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            title="Sem ícone"
          >
            <span className="text-[10px] font-medium">Ø</span>
          </button>
          {filtered.map((i) => (
            <button
              key={i.name}
              type="button"
              className={cn(
                "flex size-9 items-center justify-center rounded-xl border bg-background/40 text-foreground transition-colors hover:bg-muted/40",
                value === i.name ? "ring-2 ring-sky-400/40" : ""
              )}
              onClick={() => {
                onChange(i.name);
                setOpen(false);
              }}
              title={i.name}
            >
              <i.Icon className="size-4" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
