/**
 * Date utility functions for bunki
 */

const pacificDateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});
const pacificYear = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
});

/**
 * Converts a date to Pacific Time (America/Los_Angeles timezone)
 * This is used consistently across the codebase for date handling
 *
 * @param date - Date string or Date object to convert
 * @returns Date object in Pacific timezone
 */
export function toPacificTime(date: string | Date): Date {
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? value : new Date(pacificDateTime.format(value));
}

/**
 * Gets the year from a date in Pacific timezone
 *
 * @param date - Date string or Date object
 * @returns Year as number
 */
export function getPacificYear(date: string | Date): number {
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? NaN : Number(pacificYear.format(value));
}
