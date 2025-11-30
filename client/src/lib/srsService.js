import { supabase } from './supabaseClient';
import { getDeckOptions } from './decksService';

/**
 * Spaced Repetition Service
 * Implements classic SM-2 algorithm with learning steps, lapses, and fuzz
 */

// Rating enum: Again=1, Hard=2, Good=3, Easy=4
export const RATING = {
  AGAIN: 1,
  HARD: 2,
  GOOD: 3,
  EASY: 4,
};

// Legacy quality grades (for backward compatibility)
export const QUALITY = {
  HARD: 3,
  GOOD: 4,
  EASY: 5,
};

// Card states
export const CARD_STATE = {
  NEW: 'new',
  LEARNING: 'learning',
  REVIEW: 'review',
};

/**
 * Convert a Date to UTC ISO string
 * @param {Date} date - The date to convert
 * @returns {string} ISO string in UTC
 */
export const toUTC = (date = new Date()) => {
  return date.toISOString();
};

/**
 * Parse learning steps string into array of minutes
 * @param {string} stepsStr - e.g., '10m,1d' or '1m,10m,1d'
 * @returns {number[]} Array of step durations in minutes
 */
export const parseLearningSteps = (stepsStr) => {
  if (!stepsStr) return [10, 1440]; // Default: 10m, 1d

  return stepsStr.split(',').map((step) => {
    step = step.trim().toLowerCase();
    const value = parseFloat(step);
    if (step.endsWith('d')) {
      return value * 24 * 60; // days to minutes
    } else if (step.endsWith('h')) {
      return value * 60; // hours to minutes
    } else {
      // Default to minutes (including 'm' suffix)
      return value;
    }
  });
};

/**
 * Apply fuzz to interval to prevent cards from clustering
 * @param {number} intervalDays - The interval in days
 * @returns {number} Fuzzed interval in days
 */
export const applyFuzz = (intervalDays) => {
  if (intervalDays < 2) {
    return intervalDays; // No fuzz for very short intervals
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
 * @param {number} rating - RATING enum value
 * @returns {number} SM-2 quality value
 */
const ratingToQuality = (rating) => {
  switch (rating) {
    case RATING.AGAIN: return 0;
    case RATING.HARD: return 2;
    case RATING.GOOD: return 3;
    case RATING.EASY: return 5;
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
const calculateNewEaseFactor = (easeFactor, rating) => {
  const q = ratingToQuality(rating);
  const delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  const newEF = easeFactor + delta;
  return Math.max(1.3, newEF);
};

/**
 * Schedule next review based on SM-2 algorithm with deck options
 * @param {Object} progress - Current card progress
 * @param {number} rating - RATING enum value (1-4)
 * @param {Object} deckOptions - Deck SM-2 options
 * @returns {Object} Updated progress values
 */
export const scheduleNextReview = (progress, rating, deckOptions) => {
  const {
    easyBonus = 1.3,
    hardIntervalFactor = 1.2,
    lapseIntervalPercent = 10,
    intervalModifier = 1.0,
    maxIntervalDays = 36500,
    learningSteps = '10m,1d',
  } = deckOptions || {};

  const steps = parseLearningSteps(learningSteps);
  const now = new Date();

  let {
    state = CARD_STATE.NEW,
    ease_factor = 2.5,
    interval_days = 0,
    repetitions = 0,
    lapses = 0,
    learning_step_index = 0,
  } = progress;

  let newState = state;
  let newEaseFactor = ease_factor;
  let newIntervalDays = interval_days;
  let newRepetitions = repetitions;
  let newLapses = lapses;
  let newStepIndex = learning_step_index;
  let dueAt;

  // Handle based on current state and rating
  if (state === CARD_STATE.NEW || state === CARD_STATE.LEARNING) {
    // Card is in learning phase
    if (rating === RATING.AGAIN) {
      // Reset to first learning step
      newStepIndex = 0;
      newState = CARD_STATE.LEARNING;
      const stepMinutes = steps[0] || 10;
      dueAt = new Date(now.getTime() + stepMinutes * 60 * 1000);
    } else if (rating === RATING.HARD) {
      // Stay at current step (or first step if new)
      newState = CARD_STATE.LEARNING;
      const stepMinutes = steps[newStepIndex] || steps[0] || 10;
      // Hard in learning: repeat same step with 1.5x delay
      dueAt = new Date(now.getTime() + stepMinutes * 1.5 * 60 * 1000);
    } else if (rating === RATING.GOOD) {
      // Advance to next step or graduate
      newStepIndex = (state === CARD_STATE.NEW ? 0 : learning_step_index) + 1;
      if (newStepIndex >= steps.length) {
        // Graduate to review
        newState = CARD_STATE.REVIEW;
        newIntervalDays = 1; // Graduate with 1 day interval
        newRepetitions = 1;
        newEaseFactor = calculateNewEaseFactor(ease_factor, rating);
        dueAt = new Date(now.getTime() + newIntervalDays * 24 * 60 * 60 * 1000);
      } else {
        // Move to next learning step
        newState = CARD_STATE.LEARNING;
        const stepMinutes = steps[newStepIndex] || 1440;
        dueAt = new Date(now.getTime() + stepMinutes * 60 * 1000);
      }
    } else if (rating === RATING.EASY) {
      // Graduate immediately with bonus
      newState = CARD_STATE.REVIEW;
      newIntervalDays = 4; // Easy graduate: 4 days
      newRepetitions = 1;
      newEaseFactor = calculateNewEaseFactor(ease_factor, rating);
      dueAt = new Date(now.getTime() + newIntervalDays * 24 * 60 * 60 * 1000);
    }
  } else {
    // Card is in review phase
    if (rating === RATING.AGAIN) {
      // Lapse: reset to learning with reduced interval
      newLapses = lapses + 1;
      newEaseFactor = Math.max(1.3, ease_factor - 0.2);
      newState = CARD_STATE.LEARNING;
      newStepIndex = 0;
      // New interval after lapse
      newIntervalDays = Math.max(1, Math.round(interval_days * lapseIntervalPercent / 100));
      const stepMinutes = steps[0] || 10;
      dueAt = new Date(now.getTime() + stepMinutes * 60 * 1000);
    } else {
      // Successful review
      newRepetitions = repetitions + 1;
      newEaseFactor = calculateNewEaseFactor(ease_factor, rating);

      // Calculate new interval
      let baseInterval;
      if (repetitions === 0) {
        baseInterval = 1;
      } else if (repetitions === 1) {
        baseInterval = 6;
      } else {
        baseInterval = interval_days * newEaseFactor;
      }

      // Apply modifiers based on rating
      if (rating === RATING.HARD) {
        baseInterval = interval_days * hardIntervalFactor;
      } else if (rating === RATING.EASY) {
        baseInterval = baseInterval * easyBonus;
      }

      // Apply global interval modifier
      baseInterval = baseInterval * intervalModifier;

      // Apply fuzz and cap
      newIntervalDays = Math.min(
        maxIntervalDays,
        applyFuzz(Math.round(baseInterval))
      );
      newIntervalDays = Math.max(1, newIntervalDays);

      dueAt = new Date(now.getTime() + newIntervalDays * 24 * 60 * 60 * 1000);
    }
  }

  return {
    state: newState,
    ease_factor: newEaseFactor,
    interval_days: newIntervalDays,
    repetitions: newRepetitions,
    lapses: newLapses,
    learning_step_index: newStepIndex,
    due_at: toUTC(dueAt),
    last_reviewed_at: toUTC(now),
  };
};

/**
 * Calculate new SM-2 parameters based on quality grade (legacy)
 * @param {Object} progress - Current progress state
 * @param {number} quality - Quality grade (3=Hard, 4=Good, 5=Easy)
 * @returns {Object} New progress values
 */
export const calculateSM2 = (progress, quality) => {
  let { repetitions, ease_factor, interval_days } = progress;

  // Calculate new ease factor
  // EF' = EF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  const q = quality;
  const efDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  let newEaseFactor = ease_factor + efDelta;

  // Clamp minimum EF to 1.3
  if (newEaseFactor < 1.3) {
    newEaseFactor = 1.3;
  }

  // Calculate new interval
  let newIntervalDays;
  if (repetitions === 0) {
    newIntervalDays = 1;
  } else if (repetitions === 1) {
    newIntervalDays = 6;
  } else {
    newIntervalDays = Math.round(interval_days * newEaseFactor);
  }

  // Increment repetitions (all current buttons are grade >= 3)
  const newRepetitions = repetitions + 1;

  // Calculate due_at
  const now = new Date();
  const dueAt = new Date(now.getTime() + newIntervalDays * 24 * 60 * 60 * 1000);

  return {
    repetitions: newRepetitions,
    ease_factor: newEaseFactor,
    interval_days: newIntervalDays,
    due_at: toUTC(dueAt),
    last_reviewed_at: toUTC(now),
  };
};

/**
 * Ensure progress rows exist for all cards in a deck
 * Missing rows are created with due_at = now (immediately due)
 * @param {string} userId - The user ID
 * @param {string} deckId - The deck ID
 * @param {string} nowUTC - Current time in UTC ISO string (optional)
 */
export const ensureProgressForDeck = async (userId, deckId, nowUTC = toUTC()) => {
  // Get all cards in the deck
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('id')
    .eq('deck_id', deckId);

  if (cardsError) {
    console.error('Error fetching cards:', cardsError);
    return { error: cardsError };
  }

  if (!cards || cards.length === 0) {
    return { data: [], error: null };
  }

  const cardIds = cards.map((c) => c.id);

  // Get existing progress rows for this user and these cards
  const { data: existingProgress, error: progressError } = await supabase
    .from('card_progress')
    .select('card_id')
    .eq('user_id', userId)
    .in('card_id', cardIds);

  if (progressError) {
    console.error('Error fetching progress:', progressError);
    return { error: progressError };
  }

  const existingCardIds = new Set((existingProgress || []).map((p) => p.card_id));
  const missingCardIds = cardIds.filter((id) => !existingCardIds.has(id));

  // Insert missing progress rows
  if (missingCardIds.length > 0) {
    const newRows = missingCardIds.map((cardId) => ({
      user_id: userId,
      card_id: cardId,
      repetitions: 0,
      ease_factor: 2.5,
      interval_days: 0,
      due_at: nowUTC,
      state: CARD_STATE.NEW,
      lapses: 0,
      learning_step_index: 0,
    }));

    const { error: insertError } = await supabase
      .from('card_progress')
      .insert(newRows);

    if (insertError) {
      console.error('Error inserting progress rows:', insertError);
      return { error: insertError };
    }
  }

  return { data: cardIds, error: null };
};

/**
 * Get all decks that have at least one due card for the user
 * @param {string} userId - The user ID
 * @param {string} nowUTC - Current time in UTC ISO string
 * @returns {Object} { data: decks[], error }
 */
export const getDueDecks = async (userId, nowUTC = toUTC()) => {
  // Get all user's decks
  const { data: decks, error: decksError } = await supabase
    .from('decks')
    .select('id, name, language, cards_count, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (decksError) {
    console.error('Error fetching decks:', decksError);
    return { data: null, error: decksError };
  }

  if (!decks || decks.length === 0) {
    return { data: [], error: null };
  }

  // For each deck, ensure progress and count due cards
  const dueDecks = [];

  for (const deck of decks) {
    // Ensure progress rows exist (use same nowUTC for consistent comparison)
    await ensureProgressForDeck(userId, deck.id, nowUTC);

    // Get cards in this deck
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('id')
      .eq('deck_id', deck.id);

    if (cardsError) {
      console.error('Error fetching cards for deck:', deck.id, cardsError);
      continue;
    }

    if (!cards || cards.length === 0) {
      continue;
    }

    const cardIds = cards.map((c) => c.id);

    // Count due cards
    const { count, error: countError } = await supabase
      .from('card_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('card_id', cardIds)
      .lte('due_at', nowUTC);

    if (countError) {
      console.error('Error counting due cards:', countError);
      continue;
    }

    if (count > 0) {
      dueDecks.push({
        ...deck,
        dueCount: count,
      });
    }
  }

  return { data: dueDecks, error: null };
};

/**
 * Get all due cards for a specific deck
 * Includes both review cards and learning cards that are due
 * @param {string} userId - The user ID
 * @param {string} deckId - The deck ID
 * @param {string} nowUTC - Current time in UTC ISO string
 * @returns {Object} { data: [{ card, progress }], error }
 */
export const getDueCards = async (userId, deckId, nowUTC = toUTC()) => {
  // Get all cards in the deck
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('*')
    .eq('deck_id', deckId);

  if (cardsError) {
    console.error('Error fetching cards:', cardsError);
    return { data: null, error: cardsError };
  }

  if (!cards || cards.length === 0) {
    return { data: [], error: null };
  }

  const cardIds = cards.map((c) => c.id);

  // Get progress for these cards (only due ones)
  // Include new, learning, and review cards where due_at <= now
  const { data: progressRows, error: progressError } = await supabase
    .from('card_progress')
    .select('*')
    .eq('user_id', userId)
    .in('card_id', cardIds)
    .lte('due_at', nowUTC)
    .order('due_at', { ascending: true });

  if (progressError) {
    console.error('Error fetching progress:', progressError);
    return { data: null, error: progressError };
  }

  // Build card + progress pairs
  // Sort: learning cards first (they have minute-level due times), then by due_at
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const dueCards = (progressRows || [])
    .map((progress) => ({
      card: cardMap.get(progress.card_id),
      progress,
    }))
    .sort((a, b) => {
      // Prioritize learning cards
      const aIsLearning = a.progress.state === CARD_STATE.LEARNING;
      const bIsLearning = b.progress.state === CARD_STATE.LEARNING;
      if (aIsLearning && !bIsLearning) return -1;
      if (!aIsLearning && bIsLearning) return 1;
      // Then by due_at
      return new Date(a.progress.due_at) - new Date(b.progress.due_at);
    });

  return { data: dueCards, error: null };
};

/**
 * Grade a card and update its progress using SM-2 algorithm
 * @param {string} userId - The user ID
 * @param {string} cardId - The card ID
 * @param {number} quality - Quality grade (3=Hard, 4=Good, 5=Easy)
 * @returns {Object} { data: updatedProgress, error }
 * @deprecated Use gradeCardWithRating instead
 */
export const gradeCard = async (userId, cardId, quality) => {
  // Map legacy quality to new rating
  let rating;
  if (quality === QUALITY.HARD) {
    rating = RATING.HARD;
  } else if (quality === QUALITY.GOOD) {
    rating = RATING.GOOD;
  } else if (quality === QUALITY.EASY) {
    rating = RATING.EASY;
  } else {
    rating = RATING.GOOD;
  }

  return gradeCardWithRating(userId, cardId, rating);
};

/**
 * Grade a card with new rating system (Again/Hard/Good/Easy)
 * @param {string} userId - The user ID
 * @param {string} cardId - The card ID
 * @param {number} rating - RATING enum value (1=Again, 2=Hard, 3=Good, 4=Easy)
 * @param {string} deckId - Optional deck ID to load deck options
 * @returns {Object} { data: updatedProgress, error }
 */
export const gradeCardWithRating = async (userId, cardId, rating, deckId = null) => {
  // Fetch current progress
  const { data: progress, error: fetchError } = await supabase
    .from('card_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('card_id', cardId)
    .single();

  if (fetchError) {
    console.error('Error fetching progress:', fetchError);
    return { data: null, error: fetchError };
  }

  // Get deck ID from card if not provided
  let actualDeckId = deckId;
  if (!actualDeckId) {
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('deck_id')
      .eq('id', cardId)
      .single();

    if (cardError) {
      console.error('Error fetching card:', cardError);
      return { data: null, error: cardError };
    }
    actualDeckId = card.deck_id;
  }

  // Load deck options
  const { data: deckOptions, error: optionsError } = await getDeckOptions(actualDeckId);
  if (optionsError) {
    console.error('Error fetching deck options:', optionsError);
    // Continue with defaults
  }

  // Calculate new values using SM-2
  const newValues = scheduleNextReview(progress, rating, deckOptions);

  // Update progress
  const { data: updated, error: updateError } = await supabase
    .from('card_progress')
    .update(newValues)
    .eq('id', progress.id)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating progress:', updateError);
    return { data: null, error: updateError };
  }

  return { data: updated, error: null };
};

/**
 * Session persistence key generator
 * @param {string} userId - The user ID
 * @param {string} deckId - The deck ID
 * @returns {string} localStorage key
 */
export const getSessionKey = (userId, deckId) => {
  return `studySession:${userId}:${deckId}`;
};

/**
 * Save study session to localStorage
 * @param {string} userId - The user ID
 * @param {string} deckId - The deck ID
 * @param {string[]} cardIds - Array of card IDs in the queue
 * @param {number} currentIndex - Current position in queue
 */
export const saveSession = (userId, deckId, cardIds, currentIndex) => {
  const session = {
    version: 1,
    deckId,
    userId,
    cardIds,
    currentIndex,
    createdAt: toUTC(),
  };
  localStorage.setItem(getSessionKey(userId, deckId), JSON.stringify(session));
};

/**
 * Load study session from localStorage
 * @param {string} userId - The user ID
 * @param {string} deckId - The deck ID
 * @returns {Object|null} Session object or null if expired/missing
 */
export const loadSession = (userId, deckId) => {
  const key = getSessionKey(userId, deckId);
  const stored = localStorage.getItem(key);

  if (!stored) {
    return null;
  }

  try {
    const session = JSON.parse(stored);

    // Validate session structure
    if (session.version !== 1 || session.userId !== userId || session.deckId !== deckId) {
      localStorage.removeItem(key);
      return null;
    }

    // Check if session is older than 24 hours
    const sessionTime = new Date(session.createdAt).getTime();
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (now - sessionTime > maxAge) {
      localStorage.removeItem(key);
      return null;
    }

    return session;
  } catch (e) {
    console.error('Error parsing session:', e);
    localStorage.removeItem(key);
    return null;
  }
};

/**
 * Clear study session from localStorage
 * @param {string} userId - The user ID
 * @param {string} deckId - The deck ID
 */
export const clearSession = (userId, deckId) => {
  localStorage.removeItem(getSessionKey(userId, deckId));
};

/**
 * Get the earliest upcoming due_at for the user (after nowUTC)
 * @param {string} userId - The user ID
 * @param {string} nowUTC - Current time in UTC ISO string
 * @returns {Object} { data: nextDueAt | null, error }
 */
export const getNextDueAt = async (userId, nowUTC = toUTC()) => {
  const { data, error } = await supabase
    .from('card_progress')
    .select('due_at')
    .eq('user_id', userId)
    .gt('due_at', nowUTC)
    .order('due_at', { ascending: true })
    .limit(1);

  if (error) {
    console.error('Error fetching next due at:', error);
    return { data: null, error };
  }

  const nextDueAt = data && data.length > 0 ? data[0].due_at : null;
  return { data: nextDueAt, error: null };
};
