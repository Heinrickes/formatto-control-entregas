import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";

export function parseDateOnly(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function toDateOnly(date?: Date | string | null) {
  if (!date) return "";
  const value = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function shortDate(date?: Date | string | null) {
  if (!date) return "-";
  return format(typeof date === "string" ? new Date(date) : date, "d MMM", { locale: es });
}

export function dayDiff(scheduledAt: Date | string, actualAt?: Date | string | null) {
  if (!actualAt) return null;
  return differenceInCalendarDays(new Date(actualAt), new Date(scheduledAt));
}
