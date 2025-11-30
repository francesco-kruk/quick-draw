/**
 * Date utility functions for SRS scheduling
 */

/**
 * Convert a Date to UTC ISO string
 * @param {Date} date - The date to convert
 * @returns {string} ISO string in UTC
 */
export const toUTC = (date = new Date()) => {
  return date.toISOString();
};

/**
 * Compute local midnight for a target day, returned as UTC ISO string.
 * Used for review-phase scheduling so cards become due at the start of the target day.
 * @param {number} daysFromToday - Number of days from today (0 = today, 1 = tomorrow, etc.)
 * @returns {string} UTC ISO string representing local midnight of the target day
 */
export const computeLocalMidnight = (daysFromToday) => {
  const now = new Date();
  const target = new Date(now);
  target.setDate(target.getDate() + daysFromToday);
  // Normalize to local midnight
  target.setHours(0, 0, 0, 0);
  return target.toISOString();
};
