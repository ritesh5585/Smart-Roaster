const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Returns all dates of a given month as "YYYY-MM-DD" strings using UTC.
 */
export function monthDates(year: number, month: number): string[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const res: string[] = [];
  const mStr = String(month).padStart(2, "0");
  for (let d = 1; d <= daysInMonth; d++) {
    res.push(`${year}-${mStr}-${String(d).padStart(2, "0")}`);
  }
  return res;
}

/**
 * Returns weekday index: 0 = Sunday, 1 = Monday, ..., 6 = Saturday (UTC).
 */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Single letter for weekday: S, M, T, W, T, F, S
 */
export function weekdayLetter(weekday: number): string {
  return WEEKDAY_LETTERS[weekday] || "";
}

/**
 * Three letter weekday name: Sun, Mon, ...
 */
export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday] || "";
}

/**
 * Extract 2-digit day number: "01", "02", ...
 */
export function formatDayNumber(dateStr: string): string {
  const parts = dateStr.split("-");
  return parts[2] ? parts[2].padStart(2, "0") : dateStr;
}

/**
 * Formats "YYYY-MM-DD" to "05 Dec 2026" without local Date parsing
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes("-")) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const monthIdx = parseInt(m, 10) - 1;
  const monthName = MONTH_NAMES[monthIdx] || m;
  return `${d.padStart(2, "0")} ${monthName} ${y}`;
}

/**
 * Current UTC month as "YYYY-MM"
 */
export function getCurrentMonthString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Parses "YYYY-MM" into { year, month }
 */
export function parseYearMonth(monthStr: string): { year: number; month: number } {
  const parts = monthStr.split("-");
  if (parts.length === 2) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (!isNaN(year) && !isNaN(month)) {
      return { year, month };
    }
  }
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/**
 * Returns inclusive days count between two YYYY-MM-DD strings using UTC.
 */
export function getInclusiveDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  const [y1, m1, d1] = startDateStr.split("-").map(Number);
  const [y2, m2, d2] = endDateStr.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  const diff = Math.round((t2 - t1) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 0;
}

/**
 * Returns { from: "YYYY-MM-01", to: "YYYY-MM-lastDay" } for a "YYYY-MM" string using UTC.
 */
export function getMonthRange(monthStr: string): { from: string; to: string } {
  const [y, m] = monthStr.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mStr = String(m).padStart(2, "0");
  return {
    from: `${y}-${mStr}-01`,
    to: `${y}-${mStr}-${String(lastDay).padStart(2, "0")}`,
  };
}

/**
 * Returns today's date as "YYYY-MM-DD" using local date parts.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns 3-letter weekday name for a "YYYY-MM-DD" date string (UTC).
 */
export function getWeekdayName(dateStr: string): string {
  if (!dateStr || !dateStr.includes("-")) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "";
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAY_NAMES[day] || "";
}

