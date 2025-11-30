import { supabase } from './supabaseClient';
import { getDeckOptions } from './decksService';
import { toUTC, computeLocalMidnight } from './dateUtils';
import { parseLearningSteps } from './learningSteps';
import { applyFuzz, calculateNewEaseFactor } from './srsMath';

// Re-export utilities for backward compatibility
export { toUTC, computeLocalMidnight } from './dateUtils';
export { parseLearningSteps } from './learningSteps';
export { applyFuzz } from './srsMath';
export { getDeckOptions } from './decksService';

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

// Card states
export const CARD_STATE = {
  NEW: 'new',
  LEARNING: 'learning',
  REVIEW: 'review',
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

  // Fixed intervals for learning phase (in minutes)
  const LEARNING_INTERVALS = {
    AGAIN: 2,      // 2 minutes
    HARD: 10,      // 10 minutes
    GOOD: 1440,    // 1 day
    EASY: 4 * 1440 // 4 days
  };

  // Handle based on current state and rating
  if (state === CARD_STATE.NEW || state === CARD_STATE.LEARNING) {
    // Card is in learning phase - use fixed intervals
    if (rating === RATING.AGAIN) {
      // Reset to first learning step
      newStepIndex = 0;
      newState = CARD_STATE.LEARNING;
      dueAt = new Date(now.getTime() + LEARNING_INTERVALS.AGAIN * 60 * 1000);
    } else if (rating === RATING.HARD) {
      // Stay in learning with fixed 15 min interval
      newState = CARD_STATE.LEARNING;
      dueAt = new Date(now.getTime() + LEARNING_INTERVALS.HARD * 60 * 1000);
    } else if (rating === RATING.GOOD) {
      // Graduate to review with 1 day interval
      newStepIndex = 1;
      newState = CARD_STATE.REVIEW;
      newIntervalDays = 1;
      newRepetitions = 1;
      newEaseFactor = calculateNewEaseFactor(ease_factor, rating);
      // Schedule for local midnight of target day
      return {
        state: newState,
        ease_factor: newEaseFactor,
        interval_days: newIntervalDays,
        repetitions: newRepetitions,
        lapses: newLapses,
        learning_step_index: newStepIndex,
        due_at: computeLocalMidnight(newIntervalDays),
        last_reviewed_at: toUTC(now),
      };
    } else if (rating === RATING.EASY) {
      // Graduate immediately with 4 day interval
      newState = CARD_STATE.REVIEW;
      newIntervalDays = 4;
      newRepetitions = 1;
      newEaseFactor = calculateNewEaseFactor(ease_factor, rating);
      // Schedule for local midnight of target day
      return {
        state: newState,
        ease_factor: newEaseFactor,
        interval_days: newIntervalDays,
        repetitions: newRepetitions,
        lapses: newLapses,
        learning_step_index: newStepIndex,
        due_at: computeLocalMidnight(newIntervalDays),
        last_reviewed_at: toUTC(now),
      };
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
      dueAt = new Date(now.getTime() + LEARNING_INTERVALS.AGAIN * 60 * 1000);
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

      // Successful review: use local midnight scheduling
      return {
        state: newState,
        ease_factor: newEaseFactor,
        interval_days: newIntervalDays,
        repetitions: newRepetitions,
        lapses: newLapses,
        learning_step_index: newStepIndex,
        due_at: computeLocalMidnight(newIntervalDays),
        last_reviewed_at: toUTC(now),
      };
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
 * Check if a card has sub-day (minutes-level) scheduling
 * Cards in LEARNING state are scheduled in minutes, not days
 * @param {Object} progress - Card progress object
 * @returns {boolean} True if card is scheduled in sub-day intervals
 */
export const isSubDayScheduled = (progress) => {
  return progress?.state === CARD_STATE.LEARNING;
};

/**
 * Format an interval for display
 * @param {number} minutes - Interval in minutes
 * @returns {string} Formatted interval string (e.g., "10m", "1h", "2d", "1mo")
 */
export const formatInterval = (minutes) => {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  } else if (minutes < 1440) {
    const hours = Math.round(minutes / 60);
    return `${hours}h`;
  } else {
    const days = Math.round(minutes / 1440);
    if (days >= 30) {
      const months = Math.round(days / 30);
      return `${months}mo`;
    }
    return `${days}d`;
  }
};

/**
 * Preview next intervals for all ratings without applying changes
 * @param {Object} progress - Current card progress
 * @param {Object} deckOptions - Deck SM-2 options
 * @returns {Object} Preview intervals in minutes for each rating { again, hard, good, easy }
 */
export const previewNextIntervals = (progress, deckOptions) => {
  const {
    easyBonus = 1.3,
    hardIntervalFactor = 1.2,
    lapseIntervalPercent = 10,
    intervalModifier = 1.0,
    maxIntervalDays = 36500,
    learningSteps = '10m,1d',
  } = deckOptions || {};

  const steps = parseLearningSteps(learningSteps);

  const {
    state = CARD_STATE.NEW,
    ease_factor = 2.5,
    interval_days = 0,
    repetitions = 0,
    learning_step_index = 0,
  } = progress || {};

  const intervals = {};

  // Fixed intervals for learning phase (in minutes)
  const LEARNING_INTERVALS = {
    AGAIN: 2,      // 2 minutes
    HARD: 10,      // 10 minutes
    GOOD: 1440,    // 1 day
    EASY: 4 * 1440 // 4 days
  };

  // Calculate for each rating
  [RATING.AGAIN, RATING.HARD, RATING.GOOD, RATING.EASY].forEach((rating) => {
    let intervalMinutes;

    if (state === CARD_STATE.NEW || state === CARD_STATE.LEARNING) {
      // Card is in learning phase - use fixed intervals
      if (rating === RATING.AGAIN) {
        intervalMinutes = LEARNING_INTERVALS.AGAIN;
      } else if (rating === RATING.HARD) {
        intervalMinutes = LEARNING_INTERVALS.HARD;
      } else if (rating === RATING.GOOD) {
        intervalMinutes = LEARNING_INTERVALS.GOOD;
      } else if (rating === RATING.EASY) {
        intervalMinutes = LEARNING_INTERVALS.EASY;
      }
    } else {
      // Card is in review phase
      if (rating === RATING.AGAIN) {
        // Lapse: reset to first learning step
        intervalMinutes = LEARNING_INTERVALS.AGAIN;
      } else {
        // Successful review - calculate new interval
        const newEaseFactor = calculateNewEaseFactor(ease_factor, rating);
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

        // Cap at max interval
        const intervalDays = Math.min(maxIntervalDays, Math.max(1, Math.round(baseInterval)));
        intervalMinutes = intervalDays * 1440;
      }
    }

    intervals[rating] = intervalMinutes;
  });

  return {
    again: intervals[RATING.AGAIN],
    hard: intervals[RATING.HARD],
    good: intervals[RATING.GOOD],
    easy: intervals[RATING.EASY],
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

  const deckIds = decks.map((d) => d.id);

  // Fetch all cards for all decks in a single query
  const { data: allCards, error: cardsError } = await supabase
    .from('cards')
    .select('id, deck_id')
    .in('deck_id', deckIds);

  if (cardsError) {
    console.error('Error fetching cards:', cardsError);
    return { data: null, error: cardsError };
  }

  if (!allCards || allCards.length === 0) {
    return { data: [], error: null };
  }

  // Build card ID to deck ID mapping
  const cardToDeck = new Map(allCards.map((c) => [c.id, c.deck_id]));
  const allCardIds = allCards.map((c) => c.id);

  // Ensure progress exists for all cards (single batch operation)
  const { data: existingProgress, error: progressFetchError } = await supabase
    .from('card_progress')
    .select('card_id')
    .eq('user_id', userId)
    .in('card_id', allCardIds);

  if (progressFetchError) {
    console.error('Error fetching progress:', progressFetchError);
    return { data: null, error: progressFetchError };
  }

  const existingCardIds = new Set((existingProgress || []).map((p) => p.card_id));
  const missingCardIds = allCardIds.filter((id) => !existingCardIds.has(id));

  // Insert missing progress rows in batch
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
      // Continue anyway - we can still count existing progress
    }
  }

  // Get all due progress in a single query
  const { data: dueProgress, error: dueError } = await supabase
    .from('card_progress')
    .select('card_id')
    .eq('user_id', userId)
    .in('card_id', allCardIds)
    .lte('due_at', nowUTC);

  if (dueError) {
    console.error('Error fetching due progress:', dueError);
    return { data: null, error: dueError };
  }

  // Count due cards per deck
  const deckDueCounts = new Map();
  for (const progress of dueProgress || []) {
    const deckId = cardToDeck.get(progress.card_id);
    if (deckId) {
      deckDueCounts.set(deckId, (deckDueCounts.get(deckId) || 0) + 1);
    }
  }

  // Build result with only decks that have due cards
  const dueDecks = decks
    .filter((deck) => deckDueCounts.has(deck.id))
    .map((deck) => ({
      ...deck,
      dueCount: deckDueCounts.get(deck.id),
    }));

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

// Re-export session functions for backward compatibility
export { getSessionKey, saveSession, loadSession, clearSession } from './sessionService';

/**
 * Get ALL learning cards for a deck (regardless of due time)
 * Use this to ensure sessions don't end while cards are still in learning state
 * @param {string} userId - The user ID
 * @param {string} deckId - The deck ID
 * @returns {Object} { data: [{ card, progress }], error }
 */
export const getAllLearningCards = async (userId, deckId) => {
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

  // Get ALL cards in learning state (regardless of due_at)
  const { data: progressRows, error: progressError } = await supabase
    .from('card_progress')
    .select('*')
    .eq('user_id', userId)
    .in('card_id', cardIds)
    .eq('state', CARD_STATE.LEARNING)
    .order('due_at', { ascending: true });

  if (progressError) {
    console.error('Error fetching learning cards:', progressError);
    return { data: null, error: progressError };
  }

  // Build card + progress pairs
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const learningCards = (progressRows || [])
    .map((progress) => ({
      card: cardMap.get(progress.card_id),
      progress,
    }));

  return { data: learningCards, error: null };
};

/**
 * Get sub-day (learning) cards that are not yet due but scheduled soon
 * These are cards in LEARNING state with due_at in the future
 * @param {string} userId - The user ID
 * @param {string} deckId - The deck ID
 * @param {string} nowUTC - Current time in UTC ISO string
 * @returns {Object} { data: [{ card, progress }], error }
 */
export const getSubDayCards = async (userId, deckId, nowUTC = toUTC()) => {
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

  // Get learning cards that are not yet due (due_at > now, state = learning)
  const { data: progressRows, error: progressError } = await supabase
    .from('card_progress')
    .select('*')
    .eq('user_id', userId)
    .in('card_id', cardIds)
    .eq('state', CARD_STATE.LEARNING)
    .gt('due_at', nowUTC)
    .order('due_at', { ascending: true });

  if (progressError) {
    console.error('Error fetching sub-day progress:', progressError);
    return { data: null, error: progressError };
  }

  // Build card + progress pairs
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const subDayCards = (progressRows || [])
    .map((progress) => ({
      card: cardMap.get(progress.card_id),
      progress,
    }));

  return { data: subDayCards, error: null };
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
