import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";

export function parseDateOnly(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function toDateOnly(date?: Date | string | null) {
  if (!date) return "";
  const value = typeof date === "string" ? new Date(date) : date;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
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
