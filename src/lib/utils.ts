import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * The user's current IANA time zone (e.g. "America/New_York"), read from the
 * browser. This is what makes "today" follow wherever they open the app.
 */
export function getUserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format an instant as a "YYYY-MM-DD" calendar date in a given time zone.
 * Defaults to the user's local time zone, so calling it with no arguments
 * yields *their* current date regardless of where the server or data lives.
 * A specific `timeZone` can be passed to format the same instant elsewhere.
 */
export function formatDateInputValue(date: Date = new Date(), timeZone: string = getUserTimeZone()): string {
  // formatToParts avoids locale-dependent ordering, so the output is always
  // year-month-day even if the runtime's default locale formats differently.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Parse a "YYYY-MM-DD" calendar date into a local Date at midnight. Building
 * the Date from explicit numeric parts (rather than `new Date(str)`, which
 * parses as UTC) keeps it timezone-neutral and avoids off-by-one-day drift.
 */
export function parseDateInputValue(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
