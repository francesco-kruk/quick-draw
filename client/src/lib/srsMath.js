/**
 * SRS Math Helpers for SM-2 algorithm
 */

// Rating values - keep in sync with RATING enum in srsService.js
// Note: Cannot import from srsService.js due to circular dependency
const RATING_AGAIN = 1;
const RATING_HARD = 2;
const RATING_GOOD = 3;
const RATING_EASY = 4;

/**
 * Apply fuzz to interval to prevent cards from clustering
 * @param {number} intervalDays - The interval in days
 * @param {Object} options - Options object
 * @param {boolean} options.disabled - If true, skip fuzz for deterministic results
 * @returns {number} Fuzzed interval in days
 */
export const applyFuzz = (intervalDays, { disabled = false } = {}) => {
  if (disabled || intervalDays < 2) {
    return intervalDays < 2 ? intervalDays : Math.round(intervalDays);
  }

  let fuzzRange;
  if (intervalDays < 7) {
    // Short intervals: ±1 day max
    fuzzRange = Math.min(1, intervalDays * 0.15);
  } else if (intervalDays < 30) {
    // Medium intervals: ±5%
    fuzzRange = intervalDays * 0.05;
  } else {
    // Long intervals: ±10%
    fuzzRange = intervalDays * 0.10;
  }

  // Random value between -fuzzRange and +fuzzRange
  const fuzz = (Math.random() * 2 - 1) * fuzzRange;
  return Math.max(1, Math.round(intervalDays + fuzz));
};

/**
 * Map rating to SM-2 quality (q) for ease factor calculation
 * SM-2 uses q from 0-5, we map: Again=0, Hard=2, Good=3, Easy=5
 * @param {number} rating - RATING enum value (1=Again, 2=Hard, 3=Good, 4=Easy)
 * @returns {number} SM-2 quality value
 */
export const ratingToQuality = (rating) => {
  switch (rating) {
    case RATING_AGAIN: return 0;
    case RATING_HARD: return 2;
    case RATING_GOOD: return 3;
    case RATING_EASY: return 5;
    default: return 3;
  }
};

/**
 * Calculate new ease factor using SM-2 formula
 * EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 * @param {number} easeFactor - Current ease factor
 * @param {number} rating - RATING enum value
 * @returns {number} New ease factor (minimum 1.3)
 */
export const calculateNewEaseFactor = (easeFactor, rating) => {
  const q = ratingToQuality(rating);
  const delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  const newEF = easeFactor + delta;
  return Math.max(1.3, newEF);
};
