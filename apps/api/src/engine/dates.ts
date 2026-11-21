/**
 * Pure date utilities for the roster engine.
 * All dates are "YYYY-MM-DD" strings.
 * Weekday via new Date(Date.UTC(y, m-1, d)).getUTCDay() (0=Sunday, 1=Monday ... 6=Saturday).
 * Never use local time or new Date(string).
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

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Week = ISO week, Monday to Sunday.
 * A "week segment" = that week's days inside the roster month.
 */
export function weekSegments(dates: string[]): string[][] {
  const segments: string[][] = [];
  let currentSegment: string[] = [];

  for (const date of dates) {
    if (weekdayOf(date) === 1 && currentSegment.length > 0) {
      segments.push(currentSegment);
      currentSegment = [];
    }
    currentSegment.push(date);
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

export function isInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}
