import type { DateGrain, FieldFormat } from "./types";

const CURRENCY = process.env.NEXT_PUBLIC_MOSAIC_CURRENCY || "USD";
const LOCALE = process.env.NEXT_PUBLIC_MOSAIC_LOCALE || "en-US";

const compact = new Intl.NumberFormat(LOCALE, {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(LOCALE, options).format(value);
}

export function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "–";
  if (Math.abs(value) < 1000) {
    return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(value);
  }
  return compact.format(value);
}

export function formatCurrency(value: number, { short = false } = {}) {
  if (short && Math.abs(value) >= 10_000) {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency: CURRENCY,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0,
  }).format(value);
}

const dateFormatters: Partial<Record<DateGrain, Intl.DateTimeFormat>> = {};

function dateFormatter(grain: DateGrain) {
  if (!dateFormatters[grain]) {
    const options: Intl.DateTimeFormatOptions =
      grain === "year"
        ? { year: "numeric" }
        : grain === "quarter" || grain === "month"
          ? { year: "numeric", month: "short" }
          : grain === "hour"
            ? { month: "short", day: "numeric", hour: "numeric" }
            : { year: "numeric", month: "short", day: "numeric" };
    dateFormatters[grain] = new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" });
  }
  return dateFormatters[grain]!;
}

export function formatDate(value: string | number | Date, grain: DateGrain = "day") {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  if (grain === "quarter") {
    const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
    return `Q${quarter} ${date.getUTCFullYear()}`;
  }
  if (grain === "week") {
    return `Week of ${dateFormatter("day").format(date)}`;
  }
  return dateFormatter(grain).format(date);
}

export function formatRelative(value: string | number | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(date, "day");
}

/** Formats a cell using the format the agent inferred for that field. */
export function formatValue(
  value: unknown,
  format: FieldFormat = "text",
  options: { grain?: DateGrain; short?: boolean } = {},
): string {
  if (value === null || value === undefined || value === "") return "—";

  switch (format) {
    case "currency":
      return typeof value === "number" ? formatCurrency(value, { short: options.short }) : String(value);
    case "percent":
      return typeof value === "number"
        ? `${formatNumber(value > 1 ? value : value * 100, { maximumFractionDigits: 1 })}%`
        : String(value);
    case "integer":
      return typeof value === "number"
        ? options.short
          ? formatCompact(value)
          : formatNumber(Math.round(value))
        : String(value);
    case "number":
      return typeof value === "number"
        ? options.short
          ? formatCompact(value)
          : formatNumber(value, { maximumFractionDigits: 2 })
        : String(value);
    case "date":
      return formatDate(value as string, options.grain ?? "day");
    case "datetime":
      return formatDate(value as string, options.grain ?? "day");
    case "boolean":
      return value === true ? "Yes" : value === false ? "No" : String(value);
    case "id":
      return String(value);
    default:
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
  }
}

export function pluralize(count: number, singular: string, plural?: string) {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/* ------------------------------------------------------------------ */
/* Chart palettes                                                      */
/* ------------------------------------------------------------------ */

export const palettes: Record<string, string[]> = {
  iris: ["#6366f1", "#22d3ee", "#f472b6", "#f59e0b", "#34d399", "#a78bfa", "#fb7185", "#38bdf8"],
  ocean: ["#0ea5e9", "#14b8a6", "#6366f1", "#0891b2", "#2dd4bf", "#818cf8", "#38bdf8", "#5eead4"],
  sunset: ["#f97316", "#f43f5e", "#f59e0b", "#ec4899", "#ef4444", "#fb923c", "#e879f9", "#fbbf24"],
  forest: ["#10b981", "#65a30d", "#0d9488", "#84cc16", "#059669", "#4d7c0f", "#14b8a6", "#a3e635"],
  slate: ["#475569", "#64748b", "#94a3b8", "#334155", "#0f172a", "#cbd5e1", "#1e293b", "#e2e8f0"],
};

export function paletteColors(name = "iris") {
  return palettes[name] ?? palettes.iris;
}
