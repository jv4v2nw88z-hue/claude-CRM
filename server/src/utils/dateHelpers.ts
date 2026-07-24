const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Whole days elapsed between two dates, counted from midnight to midnight. */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** "2026-07" — the key used by the MRR trend series. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** The last `count` months, oldest first, as first-of-month dates. */
export function lastNMonths(count: number, from: Date = new Date()): Date[] {
  const months: Date[] = [];
  for (let i = count - 1; i >= 0; i--) {
    months.push(new Date(from.getFullYear(), from.getMonth() - i, 1));
  }
  return months;
}

export function endOfWeek(date: Date): Date {
  const d = startOfDay(date);
  // Week runs through the coming Sunday, so "due this week" means "before I get a weekend".
  const daysUntilSunday = (7 - d.getDay()) % 7;
  return endOfDay(addDays(d, daysUntilSunday));
}
