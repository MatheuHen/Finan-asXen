import { formatBRL } from "@/lib/currency";

export function sanitizeMoneyTyping(raw: string) {
  let s = String(raw ?? "");
  s = s.replace(/\s/g, "");
  s = s.replace(/[R$]/gi, "");
  s = s.replace(/[^\d,.-]/g, "");
  if (s.length === 0) return "";

  const hasMinus = s.includes("-");
  if (hasMinus) {
    s = s.replace(/-/g, "");
    s = `-${s}`;
  }

  return s;
}

export function parseMoneyInput(raw: string): number | null {
  let normalized = sanitizeMoneyTyping(raw).trim();
  if (normalized.length === 0) return null;

  const minusCount = (normalized.match(/-/g) ?? []).length;
  if (minusCount > 1) return null;
  if (minusCount === 1 && !normalized.startsWith("-")) return null;

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, "");
      const idx = normalized.lastIndexOf(",");
      normalized = normalized.slice(0, idx).replace(/,/g, "") + "." + normalized.slice(idx + 1);
    } else {
      normalized = normalized.replace(/,/g, "");
      const idx = normalized.lastIndexOf(".");
      normalized = normalized.slice(0, idx).replace(/\./g, "") + "." + normalized.slice(idx + 1);
    }
  } else if (hasComma) {
    const idx = normalized.lastIndexOf(",");
    normalized = normalized.slice(0, idx).replace(/,/g, "") + "." + normalized.slice(idx + 1);
  } else if (hasDot) {
    const idx = normalized.lastIndexOf(".");
    normalized = normalized.slice(0, idx).replace(/\./g, "") + "." + normalized.slice(idx + 1);
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function normalizeMoney(value: number) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(2));
}

export function formatMoneyForEdit(value: number) {
  const normalized = normalizeMoney(value);
  if (normalized === null) return "";
  return normalized.toFixed(2).replace(".", ",");
}

export function formatMoneyForDisplay(value: number) {
  const normalized = normalizeMoney(value);
  if (normalized === null) return "";
  return formatBRL(normalized);
}

