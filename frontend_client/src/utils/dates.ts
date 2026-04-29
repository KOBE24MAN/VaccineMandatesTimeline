/**
 * Parse an ISO date string ("YYYY-MM-DD") to a JS Date.
 * Using noon UTC avoids timezone-boundary issues.
 * Returns epoch (Jan 1 1970) for any string that doesn't parse cleanly.
 */
export function parseDate(iso: string): Date {
  const d = new Date(`${iso}T12:00:00Z`);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

/** Duration in days between two dates */
export function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

/** Duration in years between two dates (fractional) */
export function yearsBetween(a: Date, b: Date): number {
  return daysBetween(a, b) / 365.25;
}
