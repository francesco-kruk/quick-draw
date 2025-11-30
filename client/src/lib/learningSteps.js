/**
 * Learning steps parser for SRS scheduling
 */

/**
 * Parse learning steps string into array of minutes
 * @param {string} stepsStr - e.g., '10m,1d' or '1m,10m,1d'
 * @returns {number[]} Array of step durations in minutes
 */
export const parseLearningSteps = (stepsStr) => {
  if (!stepsStr) return [10, 1440]; // Default: 10m, 1d

  const steps = stepsStr.split(',').map((step) => {
    step = step.trim().toLowerCase();
    const value = parseFloat(step);
    
    // Handle invalid/NaN values
    if (isNaN(value) || value <= 0) {
      return null;
    }
    
    if (step.endsWith('d')) {
      return value * 24 * 60; // days to minutes
    } else if (step.endsWith('h')) {
      return value * 60; // hours to minutes
    } else {
      // Default to minutes (including 'm' suffix)
      return value;
    }
  }).filter((v) => v !== null);
  
  // Return default if all steps were invalid
  return steps.length > 0 ? steps : [10, 1440];
};
