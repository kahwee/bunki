/**
 * Date utility functions for bunki
 */

/**
 * Converts a date to Pacific Time (America/Los_Angeles timezone)
 * This is used consistently across the codebase for date handling
 *
 * @param date - Date string or Date object to convert
 * @returns Date object in Pacific timezone
 */
export function toPacificTime(date: string | Date): Date {
  return new Date(
    new Date(date).toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
    }),
  );
}

/**
 * Gets the year from a date in Pacific timezone
 *
 * @param date - Date string or Date object
 * @returns Year as number
 */
export function getPacificYear(date: string | Date): number {
  return toPacificTime(date).getFullYear();
}
