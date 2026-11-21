const MONTHS = [
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Formats "YYYY-MM-DD" to "DD Mon YYYY" (e.g. "05 Dec 2026") without local Date parsing
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes("-")) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const monthIdx = parseInt(m, 10) - 1;
  const monthName = MONTHS[monthIdx] || m;
  return `${d.padStart(2, "0")} ${monthName} ${y}`;
}

/**
 * Formats a range: "05 Dec – 08 Dec 2026" (or single date if start === end)
 */
export function formatDateRange(startStr: string, endStr: string): string {
  if (!startStr) return "";
  if (!endStr || startStr === endStr) return formatDisplayDate(startStr);
  const sParts = startStr.split("-");
  const eParts = endStr.split("-");
  if (sParts.length === 3 && eParts.length === 3 && sParts[0] === eParts[0]) {
    const sMonth = MONTHS[parseInt(sParts[1], 10) - 1] || sParts[1];
    const eMonth = MONTHS[parseInt(eParts[1], 10) - 1] || eParts[1];
    return `${sParts[2].padStart(2, "0")} ${sMonth} – ${eParts[2].padStart(2, "0")} ${eMonth} ${sParts[0]}`;
  }
  return `${formatDisplayDate(startStr)} – ${formatDisplayDate(endStr)}`;
}

/**
 * Returns weekday name ("Sun", "Mon", ...) using Date.UTC(y, m-1, d)
 */
export function getWeekdayName(dateStr: string): string {
  if (!dateStr || !dateStr.includes("-")) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts.map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  return WEEKDAYS[utcDate.getUTCDay()] || "";
}

/**
 * Computes inclusive day count between startStr and endStr ("YYYY-MM-DD") using Date.UTC
 */
export function getInclusiveDays(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  const [y1, m1, d1] = startStr.split("-").map(Number);
  const [y2, m2, d2] = endStr.split("-").map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  const diffMs = utc2 - utc1;
  if (diffMs < 0) return 0;
  return Math.round(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * For a month string "YYYY-MM", returns { from: "YYYY-MM-01", to: "YYYY-MM-<lastDay>" }
 * Computed with Date.UTC
 */
export function getMonthRange(yearMonth: string): { from: string; to: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  // Last day of month is Day 0 of next month in UTC
  const lastDayUtc = new Date(Date.UTC(y, m, 0));
  const lastDay = lastDayUtc.getUTCDate();
  const dStr = String(lastDay).padStart(2, "0");
  const mStr = String(m).padStart(2, "0");
  return {
    from: `${y}-${mStr}-01`,
    to: `${y}-${mStr}-${dStr}`,
  };
}

/**
 * Returns "YYYY-MM-DD" for today in UTC calendar
 */
export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns "YYYY-MM-DD" N days from today in UTC calendar
 */
export function getFutureDateString(daysAhead: number): string {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysAhead));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
